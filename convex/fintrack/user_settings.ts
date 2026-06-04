import { ConvexError } from "convex/values";
import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { requireUserId } from "./_auth";

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
