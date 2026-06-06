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
      .query("fintrack_debts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();
  },
});

const PERIODICITY = v.union(
  v.literal("monthly"),
  v.literal("biweekly"),
  v.literal("weekly"),
  v.literal("one_time")
);

function validateA7Fields(args: {
  paymentDueDate?: number;
  totalTermMonths?: number;
  paidInstallments?: number;
}) {
  if (args.paymentDueDate !== undefined) {
    if (!Number.isInteger(args.paymentDueDate) || args.paymentDueDate < 1 || args.paymentDueDate > 31)
      throw new ConvexError("paymentDueDate must be an integer between 1 and 31");
  }
  if (args.totalTermMonths !== undefined) {
    if (!Number.isInteger(args.totalTermMonths) || args.totalTermMonths < 1)
      throw new ConvexError("totalTermMonths must be a positive integer");
  }
  if (args.paidInstallments !== undefined) {
    if (!Number.isInteger(args.paidInstallments) || args.paidInstallments < 0)
      throw new ConvexError("paidInstallments must be a non-negative integer");
    if (args.totalTermMonths !== undefined && args.paidInstallments > args.totalTermMonths)
      throw new ConvexError("paidInstallments cannot exceed totalTermMonths");
  }
}

export const create = mutation({
  args: {
    name: v.string(),
    lender: v.string(),
    type: v.union(v.literal("revolving"), v.literal("installment")),
    currencyCode: v.string(),
    balanceCents: v.number(),
    interestRateBps: v.number(),
    monthlyPaymentCents: v.number(),
    // A7 fields
    originDate: v.optional(v.number()),
    paymentDueDate: v.optional(v.number()),
    paymentPeriodicity: v.optional(PERIODICITY),
    totalTermMonths: v.optional(v.number()),
    paidInstallments: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
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
    validateA7Fields(args);

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
      originDate: args.originDate,
      paymentDueDate: args.paymentDueDate,
      paymentPeriodicity: args.paymentPeriodicity,
      totalTermMonths: args.totalTermMonths,
      paidInstallments: args.paidInstallments,
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
    // A7 fields
    originDate: v.optional(v.number()),
    paymentDueDate: v.optional(v.number()),
    paymentPeriodicity: v.optional(PERIODICITY),
    totalTermMonths: v.optional(v.number()),
    paidInstallments: v.optional(v.number()),
  },
  handler: async (ctx, { id, ...fields }) => {
    const userId = await requireUserId(ctx);
    const debt = await ctx.db.get(id);
    if (!debt || debt.userId !== userId)
      throw new ConvexError({ code: 403, message: "Forbidden" });

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
    // Usar valores efectivos (entrante ?? persistido) para que el cross-check detecte inconsistencias
    const effectiveTotalTermMonths = fields.totalTermMonths ?? debt.totalTermMonths;
    const effectivePaidInstallments = fields.paidInstallments ?? debt.paidInstallments;
    validateA7Fields({
      paymentDueDate: fields.paymentDueDate,
      totalTermMonths: effectiveTotalTermMonths,
      paidInstallments: effectivePaidInstallments,
    });
    if (fields.originDate !== undefined) patch.originDate = fields.originDate;
    if (fields.paymentDueDate !== undefined) patch.paymentDueDate = fields.paymentDueDate;
    if (fields.paymentPeriodicity !== undefined) patch.paymentPeriodicity = fields.paymentPeriodicity;
    if (fields.totalTermMonths !== undefined) patch.totalTermMonths = fields.totalTermMonths;
    if (fields.paidInstallments !== undefined) patch.paidInstallments = fields.paidInstallments;

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
