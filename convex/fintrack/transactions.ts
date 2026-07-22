import { ConvexError } from "convex/values";
import { action, internalMutation, mutation, query } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";
import { requireUserId } from "./_auth";
import { validatePositiveCents, validateCurrencyCode } from "./_money";
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

    let results;

    if (accountId) {
      results = await ctx.db
        .query("fintrack_transactions")
        .withIndex("by_account", (q) => q.eq("accountId", accountId))
        .order("desc")
        .collect();
      // Apply date filter in memory only when account is the primary filter
      if (startDate !== undefined && endDate !== undefined) {
        results = results.filter((t) => t.date >= startDate! && t.date <= endDate!);
      }
    } else {
      results = await ctx.db
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
    }

    return limit ? results.slice(0, limit) : results;
  },
});

export const monthlyStats = query({
  args: {
    year: v.number(),
    month: v.number(),
    currencyCode: v.optional(v.string()),
    // Client passes local-time boundaries so transactions near midnight UTC are
    // bucketed by the date the user sees, not by the server's UTC clock.
    startMs: v.optional(v.number()),
    endMs: v.optional(v.number()),
  },
  handler: async (ctx, { year, month, currencyCode, startMs: clientStart, endMs: clientEnd }) => {
    const userId = await requireUserId(ctx);

    let currency: string | null = null;
    if (currencyCode) {
      currency = validateCurrencyCode(currencyCode);
    } else {
      const settings = await ctx.db
        .query("fintrack_user_settings")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .first();
      currency = settings?.defaultCurrency ?? "USD";
    }

    const startDate = clientStart ?? new Date(year, month - 1, 1).getTime();
    const endDate   = clientEnd   ?? new Date(year, month, 0, 23, 59, 59, 999).getTime();

    const transactions = await ctx.db
      .query("fintrack_transactions")
      .withIndex("by_date", (q) =>
        q.eq("userId", userId).gte("date", startDate).lte("date", endDate)
      )
      .collect();

    let incomeCents = 0;
    let expensesCents = 0;

    for (const t of transactions) {
      if (t.currencyCode !== currency) continue;
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

// Creates an expense transaction and a receivable for the shared portion in one atomic step.
// The full amountCents is recorded as the expense; sharedAmountCents becomes a new receivable.
// sharedAmountCents must be > 0 and < amountCents.
export const createShared = mutation({
  args: {
    accountId: v.id("fintrack_accounts"),
    amountCents: v.number(),
    categoryId: v.optional(v.id("fintrack_categories")),
    date: v.number(),
    notes: v.optional(v.string()),
    sharedAmountCents: v.number(),
    debtorName: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    validatePositiveCents(args.amountCents, "amountCents");

    if (!Number.isInteger(args.sharedAmountCents) || args.sharedAmountCents <= 0)
      throw new ConvexError("sharedAmountCents must be a positive integer");
    if (args.sharedAmountCents >= args.amountCents)
      throw new ConvexError("sharedAmountCents must be less than the total amount");
    if (!args.debtorName.trim())
      throw new ConvexError("debtorName is required");

    const account = await ctx.db.get(args.accountId);
    if (!account || account.userId !== userId)
      throw new ConvexError({ code: 403, message: "Forbidden" });

    // currencyCode is derived from the account — not trusted from the client
    const currencyCode = account.currencyCode;

    if (args.categoryId !== undefined) {
      const cat = await ctx.db.get(args.categoryId);
      if (!cat || cat.userId !== userId)
        throw new ConvexError({ code: 403, message: "Forbidden" });
    }

    const storedAmount = -Math.abs(args.amountCents);

    await ctx.db.insert("fintrack_transactions", {
      userId,
      accountId: args.accountId,
      amountCents: storedAmount,
      currencyCode,
      type: "expense",
      categoryId: args.categoryId,
      date: args.date,
      notes: args.notes,
      isReconciled: false,
      source: "manual",
    });

    await applyBalanceDelta(ctx, args.accountId, userId, storedAmount);

    const description = args.notes?.trim()
      ? `${args.notes.trim()} — shared expense`
      : `Shared expense (${new Date(args.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })})`;

    await ctx.db.insert("fintrack_receivables", {
      userId,
      debtorName: args.debtorName.trim(),
      description,
      originalAmountCents: args.sharedAmountCents,
      outstandingBalanceCents: args.sharedAmountCents,
      currencyCode,
      originDate: args.date,
      status: "active",
      createdAt: Date.now(),
    });
  },
});

// Public action that clears all transactions for an account in batches of 200.
// Validates authentication before starting. Balance is reset when the last batch is processed.
export const clearByAccount = action({
  args: { accountId: v.id("fintrack_accounts") },
  handler: async (ctx, { accountId }) => {
    // Actions cannot use ctx.db — must use runQuery/runMutation
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ code: 401, message: "Not authenticated" });

    let totalDeleted = 0;
    let hasMore = true;
    while (hasMore) {
      const result: { deleted: number; hasMore: boolean } = await ctx.runMutation(
        internal.fintrack.transactions._clearBatch,
        { accountId, batchSize: 200 }
      );
      totalDeleted += result.deleted;
      hasMore = result.hasMore;
    }
    return { deleted: totalDeleted };
  },
});

// Internal mutation that deletes one page of transactions for an account.
// On the final batch (no more transactions), resets the account balance to initialBalanceCents.
export const _clearBatch = internalMutation({
  args: {
    accountId: v.id("fintrack_accounts"),
    batchSize: v.number(),
  },
  handler: async (ctx, { accountId, batchSize }) => {
    const account = await ctx.db.get(accountId);
    if (!account) throw new ConvexError({ code: 404, message: "Account not found" });

    const batch = await ctx.db
      .query("fintrack_transactions")
      .withIndex("by_account", (q) => q.eq("accountId", accountId))
      .take(batchSize);

    for (const tx of batch) await ctx.db.delete(tx._id);

    // If no more transactions, reset balance
    if (batch.length < batchSize) {
      await ctx.db.patch(accountId, { balanceCents: account.initialBalanceCents });
    }

    return { deleted: batch.length, hasMore: batch.length === batchSize };
  },
});

// Updates the categoryId on multiple transactions at once. Validates ownership for each.
export const bulkUpdateCategory = mutation({
  args: {
    ids: v.array(v.id("fintrack_transactions")),
    categoryId: v.optional(v.id("fintrack_categories")),
  },
  handler: async (ctx, { ids, categoryId }) => {
    const userId = await requireUserId(ctx);

    if (categoryId !== undefined) {
      const cat = await ctx.db.get(categoryId);
      if (!cat || cat.userId !== userId)
        throw new ConvexError({ code: 403, message: "Forbidden" });
    }

    let updated = 0;
    let skipped = 0;
    for (const id of ids) {
      const tx = await ctx.db.get(id);
      if (!tx || tx.userId !== userId) { skipped++; continue; }
      await ctx.db.patch(id, { categoryId });
      updated++;
    }
    return { updated, skipped };
  },
});

// Returns a map of { normalizedDescription → most-common categoryId } built from
// the user's existing categorized transactions. Used by the CSV import to pre-fill
// category suggestions before the user confirms the import.
export const suggestCategories = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);

    const txs = await ctx.db
      .query("fintrack_transactions")
      .withIndex("by_date", (q) => q.eq("userId", userId))
      .order("desc")
      .take(500);

    // Count how many times each (normalizedDesc, categoryId) pair appears
    const counts: Record<string, Record<string, number>> = {};
    for (const tx of txs) {
      if (!tx.categoryId || !tx.notes) continue;
      const desc = tx.notes.trim().toLowerCase();
      if (!counts[desc]) counts[desc] = {};
      const catId = tx.categoryId as string;
      counts[desc][catId] = (counts[desc][catId] ?? 0) + 1;
    }

    // Sort descriptions by total appearance count, keep top 1000 (Convex limit: 1024 object fields)
    const sorted = Object.entries(counts).sort((a, b) => {
      const sumA = Object.values(a[1]).reduce((s, n) => s + n, 0);
      const sumB = Object.values(b[1]).reduce((s, n) => s + n, 0);
      return sumB - sumA;
    });

    const result: Record<string, string> = {};
    for (const [desc, catCounts] of sorted.slice(0, 1000)) {
      const best = Object.entries(catCounts).sort((a, b) => b[1] - a[1])[0];
      if (best) result[desc] = best[0];
    }
    return result;
  },
});
