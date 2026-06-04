import { ConvexError } from "convex/values";
import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { requireUserId } from "./_auth";
import { validatePositiveCents } from "./_money";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const cards = await ctx.db
      .query("fintrack_credit_cards")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    return Promise.all(
      cards.map(async (card) => {
        const account = await ctx.db.get(card.accountId);
        return { ...card, account };
      })
    );
  },
});

export const create = mutation({
  args: {
    accountId: v.id("fintrack_accounts"),
    closingDay: v.number(),
    paymentDueDay: v.number(),
    creditLimitCents: v.number(),
    minimumPaymentCents: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const account = await ctx.db.get(args.accountId);
    if (!account || account.userId !== userId)
      throw new ConvexError({ code: 403, message: "Forbidden" });
    if (account.type !== "credit")
      throw new ConvexError("Account must be of type 'credit'");
    // Fix 3: one card per account
    const existingCard = await ctx.db
      .query("fintrack_credit_cards")
      .withIndex("by_account", (q) => q.eq("accountId", args.accountId))
      .first();
    if (existingCard)
      throw new ConvexError("A credit card already exists for this account");
    validatePositiveCents(args.creditLimitCents, "creditLimitCents");
    validatePositiveCents(args.minimumPaymentCents, "minimumPaymentCents");
    // Fix 2: reject non-integer days
    if (!Number.isInteger(args.closingDay) || args.closingDay < 1 || args.closingDay > 28)
      throw new ConvexError("closingDay must be an integer between 1 and 28");
    if (!Number.isInteger(args.paymentDueDay) || args.paymentDueDay < 1 || args.paymentDueDay > 28)
      throw new ConvexError("paymentDueDay must be an integer between 1 and 28");
    return ctx.db.insert("fintrack_credit_cards", { userId, ...args });
  },
});

export const update = mutation({
  args: {
    id: v.id("fintrack_credit_cards"),
    closingDay: v.optional(v.number()),
    paymentDueDay: v.optional(v.number()),
    creditLimitCents: v.optional(v.number()),
    minimumPaymentCents: v.optional(v.number()),
  },
  handler: async (ctx, { id, ...fields }) => {
    const userId = await requireUserId(ctx);
    const card = await ctx.db.get(id);
    if (!card || card.userId !== userId)
      throw new ConvexError({ code: 403, message: "Forbidden" });
    if (fields.creditLimitCents !== undefined)
      validatePositiveCents(fields.creditLimitCents, "creditLimitCents");
    if (fields.minimumPaymentCents !== undefined)
      validatePositiveCents(fields.minimumPaymentCents, "minimumPaymentCents");
    if (fields.closingDay !== undefined &&
        (!Number.isInteger(fields.closingDay) || fields.closingDay < 1 || fields.closingDay > 28))
      throw new ConvexError("closingDay must be an integer between 1 and 28");
    if (fields.paymentDueDay !== undefined &&
        (!Number.isInteger(fields.paymentDueDay) || fields.paymentDueDay < 1 || fields.paymentDueDay > 28))
      throw new ConvexError("paymentDueDay must be an integer between 1 and 28");
    const patch = Object.fromEntries(
      Object.entries(fields).filter(([, val]) => val !== undefined)
    );
    if (Object.keys(patch).length > 0) await ctx.db.patch(id, patch);
  },
});

export const remove = mutation({
  args: { id: v.id("fintrack_credit_cards") },
  handler: async (ctx, { id }) => {
    const userId = await requireUserId(ctx);
    const card = await ctx.db.get(id);
    if (!card || card.userId !== userId)
      throw new ConvexError({ code: 403, message: "Forbidden" });
    await ctx.db.delete(id);
  },
});
