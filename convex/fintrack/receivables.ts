import { ConvexError } from "convex/values";
import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { requireUserId } from "./_auth";

// Amounts stored in cents (integers) for consistency with the rest of the app.
// interestRate stored as basis points (bps): 1000 = 10% annual.

const PERIODICITY = v.union(
  v.literal("monthly"),
  v.literal("one_time"),
  v.literal("irregular")
);

const STATUS = v.union(
  v.literal("active"),
  v.literal("partially_paid"),
  v.literal("fully_paid"),
  v.literal("written_off")
);

function validateCurrencyCode(code: string): string {
  const normalized = code.toUpperCase().trim();
  if (!/^[A-Z]{3}$/.test(normalized))
    throw new ConvexError("currencyCode must be a 3-letter ISO code");
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
      .query("fintrack_receivables")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
  },
});

export const listPayments = query({
  args: { receivableId: v.id("fintrack_receivables") },
  handler: async (ctx, { receivableId }) => {
    const userId = await requireUserId(ctx);
    const rec = await ctx.db.get(receivableId);
    if (!rec || rec.userId !== userId)
      throw new ConvexError({ code: 403, message: "Forbidden" });
    return ctx.db
      .query("fintrack_receivable_payments")
      .withIndex("by_receivable", (q) => q.eq("receivableId", receivableId))
      .order("desc")
      .collect();
  },
});

export const create = mutation({
  args: {
    debtorName: v.string(),
    description: v.string(),
    originalAmount: v.number(),
    currencyCode: v.string(),
    originDate: v.number(),
    dueDate: v.optional(v.number()),
    interestRate: v.optional(v.number()),
    paymentPeriodicity: v.optional(PERIODICITY),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const debtorName = args.debtorName.trim();
    const description = args.description.trim();
    const currencyCode = validateCurrencyCode(args.currencyCode);

    if (!debtorName) throw new ConvexError("Debtor name is required");
    if (!description) throw new ConvexError("Description is required");
    if (!Number.isInteger(args.originalAmount) || args.originalAmount <= 0)
      throw new ConvexError("originalAmount must be a positive integer (cents)");
    if (args.interestRate !== undefined) {
      if (!Number.isInteger(args.interestRate) || args.interestRate < 0 || args.interestRate > 100_000)
        throw new ConvexError("interestRate must be an integer between 0 and 100000 bps");
    }

    return ctx.db.insert("fintrack_receivables", {
      userId,
      debtorName,
      description,
      originalAmount: args.originalAmount,
      outstandingBalance: args.originalAmount,
      currencyCode,
      originDate: args.originDate,
      dueDate: args.dueDate,
      interestRate: args.interestRate,
      paymentPeriodicity: args.paymentPeriodicity,
      status: "active",
      notes: args.notes?.trim() || undefined,
      createdAt: Date.now(),
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("fintrack_receivables"),
    debtorName: v.optional(v.string()),
    description: v.optional(v.string()),
    // null = clear the field; undefined = do not touch
    dueDate: v.optional(v.union(v.number(), v.null())),
    interestRate: v.optional(v.union(v.number(), v.null())),
    paymentPeriodicity: v.optional(v.union(PERIODICITY, v.null())),
    notes: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, { id, ...fields }) => {
    const userId = await requireUserId(ctx);
    const rec = await ctx.db.get(id);
    if (!rec || rec.userId !== userId)
      throw new ConvexError({ code: 403, message: "Forbidden" });

    const patch: Record<string, unknown> = {};
    if (fields.debtorName !== undefined) {
      const name = fields.debtorName.trim();
      if (!name) throw new ConvexError("Debtor name is required");
      patch.debtorName = name;
    }
    if (fields.description !== undefined) {
      const desc = fields.description.trim();
      if (!desc) throw new ConvexError("Description is required");
      patch.description = desc;
    }
    // null → undefined removes the field from the document in Convex
    if (fields.dueDate !== undefined) patch.dueDate = fields.dueDate ?? undefined;
    if (fields.interestRate !== undefined) {
      if (fields.interestRate !== null) {
        if (!Number.isInteger(fields.interestRate) || fields.interestRate < 0 || fields.interestRate > 100_000)
          throw new ConvexError("interestRate must be an integer between 0 and 100000 bps");
      }
      patch.interestRate = fields.interestRate ?? undefined;
    }
    if (fields.paymentPeriodicity !== undefined) patch.paymentPeriodicity = fields.paymentPeriodicity ?? undefined;
    if (fields.notes !== undefined) {
      const trimmed = typeof fields.notes === "string" ? fields.notes.trim() : null;
      patch.notes = trimmed || undefined;
    }

    if (Object.keys(patch).length > 0) await ctx.db.patch(id, patch);
  },
});

export const recordPayment = mutation({
  args: {
    receivableId: v.id("fintrack_receivables"),
    amount: v.number(),
    paymentDate: v.number(),
    method: v.string(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const rec = await ctx.db.get(args.receivableId);
    if (!rec || rec.userId !== userId)
      throw new ConvexError({ code: 403, message: "Forbidden" });
    if (rec.status === "fully_paid")
      throw new ConvexError("This receivable is already fully paid");
    if (rec.status === "written_off")
      throw new ConvexError("Cannot record payment on a written-off receivable");
    if (!Number.isInteger(args.amount) || args.amount <= 0)
      throw new ConvexError("amount must be a positive integer (cents)");
    if (args.amount > rec.outstandingBalance)
      throw new ConvexError("Payment amount exceeds outstanding balance");

    const method = args.method.trim();
    if (!method) throw new ConvexError("Payment method is required");

    await ctx.db.insert("fintrack_receivable_payments", {
      receivableId: args.receivableId,
      userId,
      amount: args.amount,
      paymentDate: args.paymentDate,
      method,
      note: args.note?.trim() || undefined,
      createdAt: Date.now(),
    });

    const newBalance = rec.outstandingBalance - args.amount;
    const newStatus = newBalance === 0 ? "fully_paid" : "partially_paid";
    await ctx.db.patch(args.receivableId, {
      outstandingBalance: newBalance,
      status: newStatus,
    });
  },
});

export const writeOff = mutation({
  args: { id: v.id("fintrack_receivables") },
  handler: async (ctx, { id }) => {
    const userId = await requireUserId(ctx);
    const rec = await ctx.db.get(id);
    if (!rec || rec.userId !== userId)
      throw new ConvexError({ code: 403, message: "Forbidden" });
    if (rec.status === "fully_paid")
      throw new ConvexError("Cannot write off a fully paid receivable");
    await ctx.db.patch(id, { status: "written_off" });
  },
});
