import { ConvexError } from "convex/values";
import { query } from "../_generated/server";
import { v } from "convex/values";
import { requireUserId } from "./_auth";
import { validateCurrencyCode } from "./_money";
import type { Id } from "../_generated/dataModel";
import type { GenericDatabaseReader } from "convex/server";
import type { DataModel } from "../_generated/dataModel";

// effectiveExclude = category.forceExclude || setting.excludeFromReports
// Reportes filtran por exclusión efectiva, NO por is_active.
// Categorías inactivas siguen visibles en histórico — solo se excluyen
// las que el usuario marcó explícitamente para reportes.
async function getExcludedCategoryIds(
  db: GenericDatabaseReader<DataModel>,
  userId: Id<"users">
): Promise<Set<string>> {
  const settings = await db
    .query("fintrack_category_settings")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();

  const excluded = new Set<string>();
  for (const s of settings) {
    if (!s.excludeFromReports) continue;
    const cat = await db.get(s.categoryId);
    if (cat?.forceExclude || s.excludeFromReports) {
      excluded.add(s.categoryId);
    }
  }

  // Also exclude forceExclude categories that may lack settings records
  const forcedCats = await db
    .query("fintrack_categories")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .filter((q) => q.eq(q.field("forceExclude"), true))
    .collect();
  for (const cat of forcedCats) excluded.add(cat._id);

  return excluded;
}

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
  args: { months: v.optional(v.number()), currencyCode: v.optional(v.string()) },
  handler: async (ctx, { months = 6, currencyCode }) => {
    validateMonths(months);
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
  args: { year: v.number(), month: v.number(), currencyCode: v.optional(v.string()) },
  handler: async (ctx, { year, month, currencyCode }) => {
    validateReportPeriod(year, month);
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

    const startMs = new Date(year, month - 1, 1).getTime();
    const endMs = new Date(year, month, 1).getTime();

    const excluded = await getExcludedCategoryIds(ctx.db, userId);

    const txs = await ctx.db
      .query("fintrack_transactions")
      .withIndex("by_date", (q) =>
        q.eq("userId", userId).gte("date", startMs).lt("date", endMs)
      )
      .collect();

    const totals: Record<string, number> = {};
    for (const tx of txs) {
      if (tx.type !== "expense" || !tx.categoryId || tx.currencyCode !== currency) continue;
      if (excluded.has(tx.categoryId)) continue;
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
  args: { year: v.number(), month: v.number(), currencyCode: v.optional(v.string()) },
  handler: async (ctx, { year, month, currencyCode }) => {
    validateReportPeriod(year, month);
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

// Returns net worth per month for the last N months.
// Uses initialBalanceCents as baseline + income/expense transactions (transfers excluded — they net to 0).
// Accounts created after a given month's end are excluded from that month's calculation.
export const netWorthHistory = query({
  args: { currencyCode: v.string(), lookbackMonths: v.optional(v.number()) },
  handler: async (ctx, { currencyCode, lookbackMonths = 12 }) => {
    const userId = await requireUserId(ctx);
    const currency = validateCurrencyCode(currencyCode);

    const accounts = await ctx.db
      .query("fintrack_accounts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) =>
        q.and(
          q.eq(q.field("isActive"), true),
          q.eq(q.field("currencyCode"), currency)
        )
      )
      .collect();

    if (accounts.length === 0) return [];

    const accountIdSet = new Set(accounts.map((a) => a._id as string));

    // Fetch all transactions for this user — filter client-side to avoid N queries
    const allTxs = await ctx.db
      .query("fintrack_transactions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // Only income/expense for accounts in the target currency (transfers net to 0 for net worth).
    // Filter by tx.currencyCode as an extra guard against inconsistent data.
    const relevantTxs = allTxs.filter(
      (tx) =>
        accountIdSet.has(tx.accountId as string) &&
        tx.type !== "transfer" &&
        tx.currencyCode === currency
    );

    // Generate month end timestamps and labels
    const now = new Date();
    const result: Array<{ label: string; netWorthCents: number }> = [];

    for (let i = lookbackMonths - 1; i >= 0; i--) {
      // End of the month that is i months ago
      const endDate = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999);
      const endTs = endDate.getTime();
      const label = new Date(now.getFullYear(), now.getMonth() - i, 1).toLocaleDateString("en-US", {
        month: "short",
        year: "2-digit",
      });

      // Sum initial balances only for accounts that existed at this point.
      // credit: apply -Math.abs for defensive correctness (legacy accounts may have positive initial).
      const initialSum = accounts.reduce((sum, a) => {
        if (a._creationTime > endTs) return sum;
        const contrib = a.type === "credit" ? -Math.abs(a.initialBalanceCents) : a.initialBalanceCents;
        return sum + contrib;
      }, 0);

      // Sum signed transaction amounts up to end of this month
      const txSum = relevantTxs
        .filter((tx) => tx.date <= endTs)
        .reduce((sum, tx) => sum + tx.amountCents, 0);

      result.push({ label, netWorthCents: initialSum + txSum });
    }

    return result;
  },
});

export const netWorthSnapshot = query({
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

    let totalCents = 0;
    let accountCount = 0;
    for (const acc of accounts) {
      if (acc.currencyCode !== currency) continue;
      // credit: balanceCents should be negative (debt), but legacy accounts may have positive
      // initialBalanceCents. Use -Math.abs for defensive correctness.
      totalCents += acc.type === "credit" ? -Math.abs(acc.balanceCents) : acc.balanceCents;
      accountCount++;
    }

    return { totalCents, accountCount };
  },
});
