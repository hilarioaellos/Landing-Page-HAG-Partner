import { ConvexError } from "convex/values";
import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { requireUserId } from "./_auth";

export const clearUserData = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);

    // Delete in dependency order to keep data consistent
    // 1. Splits before transactions
    const splits = await ctx.db.query("fintrack_transaction_splits").withIndex("by_user", (q) => q.eq("userId", userId)).collect();
    for (const r of splits) await ctx.db.delete(r._id);

    // 2. Transactions before accounts
    const transactions = await ctx.db.query("fintrack_transactions").withIndex("by_user", (q) => q.eq("userId", userId)).collect();
    for (const r of transactions) await ctx.db.delete(r._id);

    // 3. Reconciliations before accounts
    const reconciliations = await ctx.db.query("fintrack_reconciliations").withIndex("by_user", (q) => q.eq("userId", userId)).collect();
    for (const r of reconciliations) await ctx.db.delete(r._id);

    // 4. Credit cards before accounts
    const cards = await ctx.db.query("fintrack_credit_cards").withIndex("by_user", (q) => q.eq("userId", userId)).collect();
    for (const r of cards) await ctx.db.delete(r._id);

    // 5. Cash pockets before accounts
    const pockets = await ctx.db.query("fintrack_cash_pockets").withIndex("by_user", (q) => q.eq("userId", userId)).collect();
    for (const r of pockets) await ctx.db.delete(r._id);

    // 6. Accounts
    const accounts = await ctx.db.query("fintrack_accounts").withIndex("by_user", (q) => q.eq("userId", userId)).collect();
    for (const r of accounts) await ctx.db.delete(r._id);

    // 7. Budgets
    const budgets = await ctx.db.query("fintrack_budgets").withIndex("by_user", (q) => q.eq("userId", userId)).collect();
    for (const r of budgets) await ctx.db.delete(r._id);

    // 8. Debts
    const debts = await ctx.db.query("fintrack_debts").withIndex("by_user", (q) => q.eq("userId", userId)).collect();
    for (const r of debts) await ctx.db.delete(r._id);

    // 9. Subscriptions (accountId FK already deleted above — OK in Convex)
    const subs = await ctx.db.query("fintrack_subscriptions").withIndex("by_user", (q) => q.eq("userId", userId)).collect();
    for (const r of subs) await ctx.db.delete(r._id);

    // 10. Receivable payments before receivables
    const payments = await ctx.db.query("fintrack_receivable_payments").withIndex("by_user", (q) => q.eq("userId", userId)).collect();
    for (const r of payments) await ctx.db.delete(r._id);

    // 11. Receivables
    const receivables = await ctx.db.query("fintrack_receivables").withIndex("by_user", (q) => q.eq("userId", userId)).collect();
    for (const r of receivables) await ctx.db.delete(r._id);

    // 12. Notifications
    const notifications = await ctx.db.query("fintrack_notifications").withIndex("by_user", (q) => q.eq("userId", userId)).collect();
    for (const r of notifications) await ctx.db.delete(r._id);

    // 13. Merchants
    const merchants = await ctx.db.query("fintrack_merchants").withIndex("by_user", (q) => q.eq("userId", userId)).collect();
    for (const r of merchants) await ctx.db.delete(r._id);

    // 14. Category settings (user preferences for which categories are active/excluded)
    const catSettings = await ctx.db.query("fintrack_category_settings").withIndex("by_user", (q) => q.eq("userId", userId)).collect();
    for (const r of catSettings) await ctx.db.delete(r._id);

    // 15. User-created categories (isSystem === false only; system seed categories are kept)
    const categories = await ctx.db.query("fintrack_categories").withIndex("by_user", (q) => q.eq("userId", userId)).collect();
    for (const r of categories) {
      if (!r.isSystem) await ctx.db.delete(r._id);
    }

    // 16. Reset categoriesReviewed so wizard re-opens on next session
    const userSettings = await ctx.db
      .query("fintrack_user_settings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (userSettings) {
      await ctx.db.patch(userSettings._id, { categoriesReviewed: false });
    }

    // Kept intentionally:
    // - fintrack_user_settings (language/currency/theme preferences)
    // - fintrack_categories where isSystem === true (system seed categories)
  },
});

function validateCurrencyCode(code: string): string {
  const normalized = code.toUpperCase().trim();
  if (!/^[A-Z]{3}$/.test(normalized))
    throw new ConvexError("currencyCode must be a 3-letter ISO code (e.g. USD, EUR, MXN)");
  try {
    new Intl.NumberFormat("en-US", { style: "currency", currency: normalized });
  } catch {
    throw new ConvexError(`currencyCode "${normalized}" is not a supported currency`);
  }
  return normalized;
}

function validateTheme(theme: string): string {
  const normalized = theme.toLowerCase().trim();
  if (!["light", "dark", "system"].includes(normalized))
    throw new ConvexError('theme must be "light", "dark", or "system"');
  return normalized;
}

export const get = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const settings = await ctx.db
      .query("fintrack_user_settings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    return settings || { userId, defaultCurrency: "USD" };
  },
});

export const markCategoriesReviewed = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const existing = await ctx.db
      .query("fintrack_user_settings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { categoriesReviewed: true });
    } else {
      await ctx.db.insert("fintrack_user_settings", {
        userId,
        defaultCurrency: "USD",
        categoriesReviewed: true,
      });
    }
  },
});

export const update = mutation({
  args: {
    defaultCurrency: v.optional(v.string()),
    theme: v.optional(v.string()),
  },
  handler: async (ctx, { defaultCurrency, theme }) => {
    const userId = await requireUserId(ctx);
    const existing = await ctx.db
      .query("fintrack_user_settings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    const updates: Record<string, unknown> = {};
    if (defaultCurrency) updates.defaultCurrency = validateCurrencyCode(defaultCurrency);
    if (theme) updates.theme = validateTheme(theme);

    if (existing) {
      if (Object.keys(updates).length > 0) {
        await ctx.db.patch(existing._id, updates);
      }
      return existing._id;
    } else {
      return ctx.db.insert("fintrack_user_settings", {
        userId,
        defaultCurrency: defaultCurrency ? validateCurrencyCode(defaultCurrency) : "USD",
        theme: theme ? validateTheme(theme) : "system",
      });
    }
  },
});
