import { ConvexError } from "convex/values";
import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { requireUserId } from "./_auth";
import { validatePositiveCents } from "./_money";

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

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    return ctx.db
      .query("fintrack_debts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    lender: v.string(),
    type: v.union(v.literal("revolving"), v.literal("installment")),
    currencyCode: v.string(),
    balanceCents: v.number(),
    interestRateBps: v.number(),
    monthlyPaymentCents: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    // Fix 2: validate then normalize
    const name = args.name.trim();
    const lender = args.lender.trim();
    const currencyCode = validateCurrencyCode(args.currencyCode);
    if (!name) throw new ConvexError("Name is required");
    if (!lender) throw new ConvexError("Lender is required");
    validatePositiveCents(args.balanceCents, "balanceCents");
    if (args.balanceCents === 0) throw new ConvexError("balanceCents must be greater than 0");
    if (!Number.isInteger(args.interestRateBps) || args.interestRateBps < 0 || args.interestRateBps > 100_000)
      throw new ConvexError("interestRateBps must be an integer between 0 and 100000 (0–1000% APR)");
    validatePositiveCents(args.monthlyPaymentCents, "monthlyPaymentCents");
    if (args.monthlyPaymentCents === 0) throw new ConvexError("monthlyPaymentCents must be greater than 0");

    return ctx.db.insert("fintrack_debts", {
      userId,
      name,
      lender,
      type: args.type,
      currencyCode,
      balanceCents: args.balanceCents,
      interestRateBps: args.interestRateBps,
      monthlyPaymentCents: args.monthlyPaymentCents,
      isActive: true,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("fintrack_debts"),
    name: v.optional(v.string()),
    lender: v.optional(v.string()),
    currencyCode: v.optional(v.string()),
    balanceCents: v.optional(v.number()),
    interestRateBps: v.optional(v.number()),
    monthlyPaymentCents: v.optional(v.number()),
  },
  handler: async (ctx, { id, ...fields }) => {
    const userId = await requireUserId(ctx);
    const debt = await ctx.db.get(id);
    if (!debt || debt.userId !== userId)
      throw new ConvexError({ code: 403, message: "Forbidden" });

    // Fix 2: normalize strings before validation/storage
    const patch: Record<string, unknown> = {};
    if (fields.name !== undefined) {
      const name = fields.name.trim();
      if (!name) throw new ConvexError("Name is required");
      patch.name = name;
    }
    if (fields.lender !== undefined) {
      const lender = fields.lender.trim();
      if (!lender) throw new ConvexError("Lender is required");
      patch.lender = lender;
    }
    if (fields.currencyCode !== undefined) {
      patch.currencyCode = validateCurrencyCode(fields.currencyCode);
    }
    if (fields.balanceCents !== undefined) {
      validatePositiveCents(fields.balanceCents, "balanceCents");
      if (fields.balanceCents === 0) throw new ConvexError("balanceCents must be greater than 0");
      patch.balanceCents = fields.balanceCents;
    }
    if (fields.interestRateBps !== undefined) {
      if (!Number.isInteger(fields.interestRateBps) || fields.interestRateBps < 0 || fields.interestRateBps > 100_000)
        throw new ConvexError("interestRateBps must be an integer between 0 and 100000");
      patch.interestRateBps = fields.interestRateBps;
    }
    if (fields.monthlyPaymentCents !== undefined) {
      validatePositiveCents(fields.monthlyPaymentCents, "monthlyPaymentCents");
      if (fields.monthlyPaymentCents === 0) throw new ConvexError("monthlyPaymentCents must be greater than 0");
      patch.monthlyPaymentCents = fields.monthlyPaymentCents;
    }
    if (Object.keys(patch).length > 0) await ctx.db.patch(id, patch);
  },
});

export const archive = mutation({
  args: { id: v.id("fintrack_debts") },
  handler: async (ctx, { id }) => {
    const userId = await requireUserId(ctx);
    const debt = await ctx.db.get(id);
    if (!debt || debt.userId !== userId)
      throw new ConvexError({ code: 403, message: "Forbidden" });
    await ctx.db.patch(id, { isActive: false });
  },
});
