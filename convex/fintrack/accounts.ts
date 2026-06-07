import { ConvexError } from "convex/values";
import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { requireUserId } from "./_auth";
import { validatePositiveCents, validateCurrencyCode } from "./_money";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    return ctx.db
      .query("fintrack_accounts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();
  },
});

export const netWorthCents = query({
  args: { currencyCode: v.optional(v.string()) },
  handler: async (ctx, { currencyCode }) => {
    const userId = await requireUserId(ctx);
    let currency: string;
    if (currencyCode) {
      currency = validateCurrencyCode(currencyCode);
    } else {
      const settings = await ctx.db
        .query("fintrack_user_settings")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .first();
      currency = settings?.defaultCurrency ?? "USD";
    }
    const accounts = await ctx.db
      .query("fintrack_accounts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();
    return accounts.reduce((sum, a) => {
      if (a.currencyCode !== currency) return sum;
      return a.type === "credit" ? sum - a.balanceCents : sum + a.balanceCents;
    }, 0);
  },
});

export const getDistinctCurrencies = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const accounts = await ctx.db
      .query("fintrack_accounts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();
    return [...new Set(accounts.map((a) => a.currencyCode))].sort();
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    type: v.union(
      v.literal("checking"),
      v.literal("savings"),
      v.literal("investment"),
      v.literal("credit"),
      v.literal("cash")
    ),
    currencyCode: v.string(),
    bankName: v.optional(v.string()),
    initialBalanceCents: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    validatePositiveCents(args.initialBalanceCents, "initialBalanceCents");
    const currencyCode = validateCurrencyCode(args.currencyCode);
    return ctx.db.insert("fintrack_accounts", {
      userId,
      ...args,
      currencyCode,
      balanceCents: args.initialBalanceCents,
      isActive: true,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("fintrack_accounts"),
    name: v.optional(v.string()),
    bankName: v.optional(v.string()),
  },
  handler: async (ctx, { id, ...fields }) => {
    const userId = await requireUserId(ctx);
    const account = await ctx.db.get(id);
    if (!account || account.userId !== userId)
      throw new ConvexError({ code: 403, message: "Forbidden" });
    const patch = Object.fromEntries(
      Object.entries(fields).filter(([, val]) => val !== undefined)
    );
    if (Object.keys(patch).length > 0) await ctx.db.patch(id, patch);
  },
});

// Creates a credit account + card record atomically in a single mutation.
export const createWithCard = mutation({
  args: {
    name: v.string(),
    currencyCode: v.string(),
    bankName: v.optional(v.string()),
    initialBalanceCents: v.number(),
    closingDay: v.number(),
    paymentDueDay: v.number(),
    creditLimitCents: v.number(),
    minimumPaymentCents: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const currencyCode = validateCurrencyCode(args.currencyCode);
    if (!Number.isInteger(args.closingDay) || args.closingDay < 1 || args.closingDay > 28)
      throw new ConvexError("closingDay must be an integer between 1 and 28");
    if (!Number.isInteger(args.paymentDueDay) || args.paymentDueDay < 1 || args.paymentDueDay > 28)
      throw new ConvexError("paymentDueDay must be an integer between 1 and 28");
    validatePositiveCents(args.creditLimitCents, "creditLimitCents");
    validatePositiveCents(args.minimumPaymentCents, "minimumPaymentCents");

    const accountId = await ctx.db.insert("fintrack_accounts", {
      userId,
      name: args.name,
      type: "credit",
      currencyCode,
      bankName: args.bankName,
      initialBalanceCents: args.initialBalanceCents,
      balanceCents: args.initialBalanceCents,
      isActive: true,
    });
    await ctx.db.insert("fintrack_credit_cards", {
      userId,
      accountId,
      closingDay: args.closingDay,
      paymentDueDay: args.paymentDueDay,
      creditLimitCents: args.creditLimitCents,
      minimumPaymentCents: args.minimumPaymentCents,
    });
    return accountId;
  },
});

// Updates a credit account + card record atomically in a single mutation.
export const updateWithCard = mutation({
  args: {
    id: v.id("fintrack_accounts"),
    name: v.optional(v.string()),
    bankName: v.optional(v.string()),
    closingDay: v.number(),
    paymentDueDay: v.number(),
    creditLimitCents: v.number(),
    minimumPaymentCents: v.number(),
  },
  handler: async (ctx, { id, closingDay, paymentDueDay, creditLimitCents, minimumPaymentCents, ...fields }) => {
    const userId = await requireUserId(ctx);
    const account = await ctx.db.get(id);
    if (!account || account.userId !== userId)
      throw new ConvexError({ code: 403, message: "Forbidden" });
    if (account.type !== "credit")
      throw new ConvexError("Account must be of type 'credit'");
    if (!Number.isInteger(closingDay) || closingDay < 1 || closingDay > 28)
      throw new ConvexError("closingDay must be an integer between 1 and 28");
    if (!Number.isInteger(paymentDueDay) || paymentDueDay < 1 || paymentDueDay > 28)
      throw new ConvexError("paymentDueDay must be an integer between 1 and 28");
    validatePositiveCents(creditLimitCents, "creditLimitCents");
    validatePositiveCents(minimumPaymentCents, "minimumPaymentCents");

    const patch = Object.fromEntries(
      Object.entries(fields).filter(([, val]) => val !== undefined)
    );
    if (Object.keys(patch).length > 0) await ctx.db.patch(id, patch);

    const existingCard = await ctx.db
      .query("fintrack_credit_cards")
      .withIndex("by_account", (q) => q.eq("accountId", id))
      .first();
    if (existingCard) {
      await ctx.db.patch(existingCard._id, { closingDay, paymentDueDay, creditLimitCents, minimumPaymentCents });
    } else {
      await ctx.db.insert("fintrack_credit_cards", {
        userId,
        accountId: id,
        closingDay,
        paymentDueDay,
        creditLimitCents,
        minimumPaymentCents,
      });
    }
  },
});

export const archive = mutation({
  args: { id: v.id("fintrack_accounts") },
  handler: async (ctx, { id }) => {
    const userId = await requireUserId(ctx);
    const account = await ctx.db.get(id);
    if (!account || account.userId !== userId)
      throw new ConvexError({ code: 403, message: "Forbidden" });
    await ctx.db.patch(id, { isActive: false });
  },
});
