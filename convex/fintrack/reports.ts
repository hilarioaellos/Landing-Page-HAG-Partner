import { ConvexError } from "convex/values";
import { query } from "../_generated/server";
import { v } from "convex/values";
import { requireUserId } from "./_auth";
import type { Id } from "../_generated/dataModel";

// Fix 3: input validation helpers
function validateReportPeriod(year: number, month: number): void {
  if (!Number.isInteger(month) || month < 1 || month > 12)
    throw new ConvexError("month must be an integer between 1 and 12");
  if (!Number.isInteger(year) || year < 2000 || year > 2100)
    throw new ConvexError("year must be an integer between 2000 and 2100");
}

function validateMonths(months: number): void {
  if (!Number.isInteger(months) || months < 1 || months > 24)
    throw new ConvexError("months must be an integer between 1 and 24");
}

export const incomeVsExpenses = query({
  args: { months: v.optional(v.number()) },
  handler: async (ctx, { months = 6 }) => {
    validateMonths(months);
    const userId = await requireUserId(ctx);

    // Fix 1: filter by user's default currency
    const settings = await ctx.db
      .query("fintrack_user_settings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    const currency = settings?.defaultCurrency ?? "USD";

    const now = new Date();
    const endMs = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();
    const startMs = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1).getTime();

    const allTxs = await ctx.db
      .query("fintrack_transactions")
      .withIndex("by_date", (q) =>
        q.eq("userId", userId).gte("date", startMs).lt("date", endMs)
      )
      .collect();

    const buckets: Record<string, { year: number; month: number; income: number; expenses: number }> = {};
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
      buckets[key] = { year: d.getFullYear(), month: d.getMonth() + 1, income: 0, expenses: 0 };
    }

    for (const tx of allTxs) {
      if (tx.type === "transfer" || tx.currencyCode !== currency) continue;
      const d = new Date(tx.date);
      const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
      if (!buckets[key]) continue;
      if (tx.type === "income") buckets[key].income += tx.amountCents;
      else if (tx.type === "expense") buckets[key].expenses += Math.abs(tx.amountCents);
    }

    return Object.values(buckets);
  },
});

export const expensesByCategory = query({
  args: { year: v.number(), month: v.number() },
  handler: async (ctx, { year, month }) => {
    validateReportPeriod(year, month);
    const userId = await requireUserId(ctx);

    // Fix 1: filter by user's default currency
    const settings = await ctx.db
      .query("fintrack_user_settings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    const currency = settings?.defaultCurrency ?? "USD";

    const startMs = new Date(year, month - 1, 1).getTime();
    const endMs = new Date(year, month, 1).getTime();

    const txs = await ctx.db
      .query("fintrack_transactions")
      .withIndex("by_date", (q) =>
        q.eq("userId", userId).gte("date", startMs).lt("date", endMs)
      )
      .collect();

    const totals: Record<string, number> = {};
    for (const tx of txs) {
      if (tx.type !== "expense" || !tx.categoryId || tx.currencyCode !== currency) continue;
      totals[tx.categoryId] = (totals[tx.categoryId] ?? 0) + Math.abs(tx.amountCents);
    }

    const entries = await Promise.all(
      Object.entries(totals).map(async ([catId, totalCents]) => {
        const cat = await ctx.db.get(catId as Id<"fintrack_categories">);
        return {
          categoryId: catId,
          name: cat?.name ?? "Unknown",
          icon: cat?.icon ?? "📦",
          color: cat?.color ?? "#94a3b8",
          totalCents,
        };
      })
    );

    return entries.sort((a, b) => b.totalCents - a.totalCents);
  },
});

export const cashFlowByDay = query({
  args: { year: v.number(), month: v.number() },
  handler: async (ctx, { year, month }) => {
    validateReportPeriod(year, month);
    const userId = await requireUserId(ctx);

    // Fix 1: filter by user's default currency
    const settings = await ctx.db
      .query("fintrack_user_settings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    const currency = settings?.defaultCurrency ?? "USD";

    const startMs = new Date(year, month - 1, 1).getTime();
    const endMs = new Date(year, month, 1).getTime();
    const daysInMonth = new Date(year, month, 0).getDate();

    const txs = await ctx.db
      .query("fintrack_transactions")
      .withIndex("by_date", (q) =>
        q.eq("userId", userId).gte("date", startMs).lt("date", endMs)
      )
      .collect();

    const byDay: Record<number, { income: number; expenses: number }> = {};
    for (let d = 1; d <= daysInMonth; d++) byDay[d] = { income: 0, expenses: 0 };

    for (const tx of txs) {
      if (tx.type === "transfer" || tx.currencyCode !== currency) continue;
      const day = new Date(tx.date).getDate();
      if (tx.type === "income") byDay[day].income += tx.amountCents;
      else if (tx.type === "expense") byDay[day].expenses += Math.abs(tx.amountCents);
    }

    return Array.from({ length: daysInMonth }, (_, i) => ({
      day: i + 1,
      incomeCents: byDay[i + 1].income,
      expenseCents: byDay[i + 1].expenses,
    }));
  },
});

export const netWorthSnapshot = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);

    // Fix 1: filter by user's default currency
    const settings = await ctx.db
      .query("fintrack_user_settings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    const currency = settings?.defaultCurrency ?? "USD";

    const accounts = await ctx.db
      .query("fintrack_accounts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    let totalCents = 0;
    let accountCount = 0;
    for (const acc of accounts) {
      if (acc.currencyCode !== currency) continue;
      // Fix 2: balanceCents is already signed — credit accounts carry negative balance (debt).
      // No sign inversion needed: adding balanceCents directly gives correct net worth.
      totalCents += acc.balanceCents;
      accountCount++;
    }

    return { totalCents, accountCount };
  },
});
