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
