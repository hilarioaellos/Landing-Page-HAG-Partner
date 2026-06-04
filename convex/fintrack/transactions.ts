import { ConvexError } from "convex/values";
import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { requireUserId } from "./_auth";
import { validatePositiveCents } from "./_money";
import { applyBalanceDelta } from "./_balance";

// amountCents = signed delta for accountId:
//   income  → +|amount|  (account gains)
//   expense → -|amount|  (account loses)
//   transfer→ -|amount|  (source loses; destination gains separately)
function toStoredAmount(
  absAmount: number,
  type: "income" | "expense" | "transfer"
): number {
  return type === "income" ? Math.abs(absAmount) : -Math.abs(absAmount);
}

export const list = query({
  args: {
    accountId: v.optional(v.id("fintrack_accounts")),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { accountId, startDate, endDate, limit }) => {
    const userId = await requireUserId(ctx);

    let results = await ctx.db
      .query("fintrack_transactions")
      .withIndex("by_date", (q) => {
        const base = q.eq("userId", userId);
        if (startDate !== undefined && endDate !== undefined) {
          return base.gte("date", startDate).lte("date", endDate);
        }
        return base;
      })
      .order("desc")
      .collect();

    if (accountId) {
      results = results.filter((t) => t.accountId === accountId);
    }

    return limit ? results.slice(0, limit) : results;
  },
});

export const monthlyStats = query({
  args: {
    year: v.number(),
    month: v.number(), // 1–12
  },
  handler: async (ctx, { year, month }) => {
    const userId = await requireUserId(ctx);

    const startDate = new Date(year, month - 1, 1).getTime();
    const endDate = new Date(year, month, 0, 23, 59, 59, 999).getTime();

    const transactions = await ctx.db
      .query("fintrack_transactions")
      .withIndex("by_date", (q) =>
        q.eq("userId", userId).gte("date", startDate).lte("date", endDate)
      )
      .collect();

    let incomeCents = 0;
    let expensesCents = 0;

    for (const t of transactions) {
      if (t.type === "income") incomeCents += t.amountCents;
      else if (t.type === "expense") expensesCents += Math.abs(t.amountCents);
    }

    return {
      incomeCents,
      expensesCents,
      cashflowCents: incomeCents - expensesCents,
    };
  },
});

export const create = mutation({
  args: {
    accountId: v.id("fintrack_accounts"),
    amountCents: v.number(),           // absolute value from client
    currencyCode: v.string(),
    type: v.union(v.literal("income"), v.literal("expense"), v.literal("transfer")),
    categoryId: v.optional(v.id("fintrack_categories")),
    merchantId: v.optional(v.id("fintrack_merchants")),
    date: v.number(),
    notes: v.optional(v.string()),
    transferToAccountId: v.optional(v.id("fintrack_accounts")),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    validatePositiveCents(args.amountCents, "amountCents");

    // Source account ownership
    const account = await ctx.db.get(args.accountId);
    if (!account || account.userId !== userId)
      throw new ConvexError({ code: 403, message: "Forbidden" });

    // Transfer: destination required, must differ from source, must be owned
    if (args.type === "transfer") {
      if (!args.transferToAccountId)
        throw new ConvexError("transfer requires transferToAccountId");
      if (args.transferToAccountId === args.accountId)
        throw new ConvexError("transfer source and destination must differ");
      const toAccount = await ctx.db.get(args.transferToAccountId);
      if (!toAccount || toAccount.userId !== userId)
        throw new ConvexError({ code: 403, message: "Forbidden" });
    }

    // Cross-ref ownership
    if (args.categoryId !== undefined) {
      const cat = await ctx.db.get(args.categoryId);
      if (!cat || cat.userId !== userId)
        throw new ConvexError({ code: 403, message: "Forbidden" });
    }
    if (args.merchantId !== undefined) {
      const mer = await ctx.db.get(args.merchantId);
      if (!mer || mer.userId !== userId)
        throw new ConvexError({ code: 403, message: "Forbidden" });
    }

    const storedAmount = toStoredAmount(args.amountCents, args.type);

    const id = await ctx.db.insert("fintrack_transactions", {
      userId,
      accountId: args.accountId,
      amountCents: storedAmount,
      currencyCode: args.currencyCode,
      type: args.type,
      categoryId: args.categoryId,
      merchantId: args.merchantId,
      date: args.date,
      notes: args.notes,
      transferToAccountId: args.type === "transfer" ? args.transferToAccountId : undefined,
      isReconciled: false,
      source: "manual",
    });

    // Source effect: +income / -expense / -transfer (outflow)
    await applyBalanceDelta(ctx, args.accountId, userId, storedAmount);
    // Destination effect: +|amount| (inflow)
    if (args.type === "transfer" && args.transferToAccountId) {
      await applyBalanceDelta(ctx, args.transferToAccountId, userId, Math.abs(args.amountCents));
    }

    return id;
  },
});

export const update = mutation({
  args: {
    id: v.id("fintrack_transactions"),
    amountCents: v.optional(v.number()),  // absolute value from client
    type: v.optional(
      v.union(v.literal("income"), v.literal("expense"), v.literal("transfer"))
    ),
    categoryId: v.optional(v.id("fintrack_categories")),
    merchantId: v.optional(v.id("fintrack_merchants")),
    transferToAccountId: v.optional(v.id("fintrack_accounts")),
    date: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  handler: async (
    ctx,
    { id, amountCents, type, transferToAccountId, categoryId, merchantId, date, notes }
  ) => {
    const userId = await requireUserId(ctx);

    const existing = await ctx.db.get(id);
    if (!existing || existing.userId !== userId)
      throw new ConvexError({ code: 403, message: "Forbidden" });

    const newType = type ?? existing.type;

    // Resolve destination for transfers
    const newTransferToId =
      newType === "transfer"
        ? (transferToAccountId ?? existing.transferToAccountId)
        : undefined;

    // Transfer constraints
    if (newType === "transfer") {
      if (!newTransferToId)
        throw new ConvexError("transfer requires transferToAccountId");
      if (newTransferToId === existing.accountId)
        throw new ConvexError("transfer source and destination must differ");
      const toAccount = await ctx.db.get(newTransferToId);
      if (!toAccount || toAccount.userId !== userId)
        throw new ConvexError({ code: 403, message: "Forbidden" });
    }

    // Cross-ref ownership
    if (categoryId !== undefined) {
      const cat = await ctx.db.get(categoryId);
      if (!cat || cat.userId !== userId)
        throw new ConvexError({ code: 403, message: "Forbidden" });
    }
    if (merchantId !== undefined) {
      const mer = await ctx.db.get(merchantId);
      if (!mer || mer.userId !== userId)
        throw new ConvexError({ code: 403, message: "Forbidden" });
    }

    // Always recalculate stored amount — fixes sign when only type changes
    const newAbsCents =
      amountCents !== undefined ? amountCents : Math.abs(existing.amountCents);
    if (amountCents !== undefined) validatePositiveCents(amountCents, "amountCents");
    const newStoredAmount = toStoredAmount(newAbsCents, newType);

    // Revert all existing effects
    await applyBalanceDelta(ctx, existing.accountId, userId, -existing.amountCents);
    if (existing.type === "transfer" && existing.transferToAccountId) {
      await applyBalanceDelta(
        ctx,
        existing.transferToAccountId,
        userId,
        -Math.abs(existing.amountCents)
      );
    }

    // Apply all new effects
    await applyBalanceDelta(ctx, existing.accountId, userId, newStoredAmount);
    if (newType === "transfer" && newTransferToId) {
      await applyBalanceDelta(ctx, newTransferToId, userId, Math.abs(newStoredAmount));
    }

    // Build patch
    const patch: Record<string, unknown> = {
      amountCents: newStoredAmount,
      transferToAccountId: newTransferToId,   // undefined clears the field when not a transfer
    };
    if (type !== undefined) patch.type = type;
    if (categoryId !== undefined) patch.categoryId = categoryId;
    if (merchantId !== undefined) patch.merchantId = merchantId;
    if (date !== undefined) patch.date = date;
    if (notes !== undefined) patch.notes = notes;

    await ctx.db.patch(id, patch);
  },
});

export const remove = mutation({
  args: { id: v.id("fintrack_transactions") },
  handler: async (ctx, { id }) => {
    const userId = await requireUserId(ctx);
    const tx = await ctx.db.get(id);
    if (!tx || tx.userId !== userId)
      throw new ConvexError({ code: 403, message: "Forbidden" });

    // Revert source effect
    await applyBalanceDelta(ctx, tx.accountId, userId, -tx.amountCents);
    // Revert destination effect for transfers
    if (tx.type === "transfer" && tx.transferToAccountId) {
      await applyBalanceDelta(
        ctx,
        tx.transferToAccountId,
        userId,
        -Math.abs(tx.amountCents)
      );
    }

    await ctx.db.delete(id);
  },
});
