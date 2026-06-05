import { ConvexError } from "convex/values";
import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { requireUserId } from "./_auth";
import { validatePositiveCents } from "./_money";
import type { Id } from "../_generated/dataModel";
import type { GenericDatabaseReader } from "convex/server";
import type { DataModel } from "../_generated/dataModel";

// Mirrors the same helper in reports.ts — keeps budget estimates consistent with report exclusions.
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
    if (cat?.forceExclude || s.excludeFromReports) excluded.add(s.categoryId);
  }
  const forcedCats = await db
    .query("fintrack_categories")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .filter((q) => q.eq(q.field("forceExclude"), true))
    .collect();
  for (const cat of forcedCats) excluded.add(cat._id);
  return excluded;
}

function validateBudgetPeriod(year: number, month: number): void {
  if (!Number.isInteger(month) || month < 1 || month > 12)
    throw new ConvexError("month must be an integer between 1 and 12");
  if (!Number.isInteger(year) || year < 2000 || year > 2100)
    throw new ConvexError("year must be an integer between 2000 and 2100");
}

function validatePlannedCents(value: number): void {
  validatePositiveCents(value, "amountPlannedCents");
  if (value === 0)
    throw new ConvexError("amountPlannedCents must be greater than 0");
}

export const listWithActuals = query({
  args: { year: v.number(), month: v.number() },
  handler: async (ctx, { year, month }) => {
    validateBudgetPeriod(year, month);
    const userId = await requireUserId(ctx);

    const startMs = new Date(year, month - 1, 1).getTime();
    const endMs = new Date(year, month, 1).getTime();

    const [budgets, monthTransactions] = await Promise.all([
      ctx.db
        .query("fintrack_budgets")
        .withIndex("by_period", (q) =>
          q.eq("userId", userId).eq("year", year).eq("month", month)
        )
        .collect(),
      ctx.db
        .query("fintrack_transactions")
        .withIndex("by_date", (q) =>
          q.eq("userId", userId).gte("date", startMs).lt("date", endMs)
        )
        .filter((q) => q.eq(q.field("type"), "expense"))
        .collect(),
    ]);

    // Pre-fetch all unique categories to avoid N+1 in the rollup loop
    const usedCatIds = new Set(
      monthTransactions.map((tx) => tx.categoryId).filter(Boolean)
    );
    const catCache: Record<string, { parentId?: string }> = {};
    for (const id of usedCatIds) {
      if (!id) continue;
      const cat = await ctx.db.get(id as typeof monthTransactions[0]["categoryId"] & string);
      if (cat) catCache[id] = { parentId: cat.parentId ?? undefined };
    }

    // Build category → actual spending map with parent rollup.
    // A transaction in a subcategory also accumulates to its parent so that
    // budget lines defined at the parent level show the correct actuals.
    const actualMap: Record<string, number> = {};
    for (const tx of monthTransactions) {
      if (!tx.categoryId) continue;
      actualMap[tx.categoryId] = (actualMap[tx.categoryId] ?? 0) + Math.abs(tx.amountCents);
      const parent = catCache[tx.categoryId]?.parentId;
      if (parent) {
        actualMap[parent] = (actualMap[parent] ?? 0) + Math.abs(tx.amountCents);
      }
    }

    const rows = await Promise.all(
      budgets.map(async (b) => {
        const category = await ctx.db.get(b.categoryId);
        return { ...b, category, actualCents: actualMap[b.categoryId] ?? 0 };
      })
    );

    // Sort: parents before their children, then alphabetically within each level
    const parentOrder = new Map(
      rows
        .filter((r) => !r.category?.parentId)
        .map((r, i) => [r.categoryId, i])
    );
    return rows.sort((a, b) => {
      const aParent = a.category?.parentId ?? a.categoryId;
      const bParent = b.category?.parentId ?? b.categoryId;
      const aOrder = parentOrder.get(aParent) ?? 999;
      const bOrder = parentOrder.get(bParent) ?? 999;
      if (aOrder !== bOrder) return aOrder - bOrder;
      // Within same parent group: parent row first, then children alphabetically
      if (aParent !== a.categoryId && bParent === b.categoryId) return 1;
      if (aParent === a.categoryId && bParent !== b.categoryId) return -1;
      return (a.category?.name ?? "").localeCompare(b.category?.name ?? "");
    });
  },
});

export const create = mutation({
  args: {
    categoryId: v.id("fintrack_categories"),
    year: v.number(),
    month: v.number(),
    amountPlannedCents: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const category = await ctx.db.get(args.categoryId);
    if (!category || category.userId !== userId)
      throw new ConvexError({ code: 403, message: "Forbidden" });
    validateBudgetPeriod(args.year, args.month);
    validatePlannedCents(args.amountPlannedCents);

    // One budget per category per period
    const existing = await ctx.db
      .query("fintrack_budgets")
      .withIndex("by_period", (q) =>
        q.eq("userId", userId).eq("year", args.year).eq("month", args.month)
      )
      .filter((q) => q.eq(q.field("categoryId"), args.categoryId))
      .first();
    if (existing)
      throw new ConvexError("A budget already exists for this category and month");

    return ctx.db.insert("fintrack_budgets", { userId, ...args });
  },
});

export const update = mutation({
  args: {
    id: v.id("fintrack_budgets"),
    amountPlannedCents: v.number(),
  },
  handler: async (ctx, { id, amountPlannedCents }) => {
    const userId = await requireUserId(ctx);
    const budget = await ctx.db.get(id);
    if (!budget || budget.userId !== userId)
      throw new ConvexError({ code: 403, message: "Forbidden" });
    validatePlannedCents(amountPlannedCents);
    await ctx.db.patch(id, { amountPlannedCents });
  },
});

export const remove = mutation({
  args: { id: v.id("fintrack_budgets") },
  handler: async (ctx, { id }) => {
    const userId = await requireUserId(ctx);
    const budget = await ctx.db.get(id);
    if (!budget || budget.userId !== userId)
      throw new ConvexError({ code: 403, message: "Forbidden" });
    await ctx.db.delete(id);
  },
});

// Returns per-category average spending for the N months BEFORE (year, month).
// Only expense transactions in the user's defaultCurrency are counted.
// Excludes categories marked excludeFromReports / forceExclude (same rule as reports).
// averageCents = total / lookbackMonths  (conservative: counts zero-spend months too)
export const historyEstimate = query({
  args: {
    year: v.number(),
    month: v.number(),
    lookbackMonths: v.number(),
  },
  handler: async (ctx, { year, month, lookbackMonths }) => {
    validateBudgetPeriod(year, month);
    if (!Number.isInteger(lookbackMonths) || lookbackMonths < 1 || lookbackMonths > 24)
      throw new ConvexError("lookbackMonths must be an integer between 1 and 24");
    const userId = await requireUserId(ctx);

    const userSettings = await ctx.db
      .query("fintrack_user_settings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    const currency = userSettings?.defaultCurrency ?? "USD";

    const excluded = await getExcludedCategoryIds(ctx.db, userId);

    const windowEnd = new Date(year, month - 1, 1);
    const windowStart = new Date(year, month - 1 - lookbackMonths, 1);

    const transactions = await ctx.db
      .query("fintrack_transactions")
      .withIndex("by_date", (q) =>
        q.eq("userId", userId)
          .gte("date", windowStart.getTime())
          .lt("date", windowEnd.getTime())
      )
      .filter((q) => q.eq(q.field("type"), "expense"))
      .collect();

    // Aggregate: only same-currency, non-excluded categories
    const totals: Record<string, number> = {};
    for (const tx of transactions) {
      if (!tx.categoryId) continue;
      if (tx.currencyCode !== currency) continue;
      if (excluded.has(tx.categoryId as string)) continue;
      totals[tx.categoryId as string] = (totals[tx.categoryId as string] ?? 0) + Math.abs(tx.amountCents);
    }

    const entries = await Promise.all(
      Object.entries(totals).map(async ([categoryId, totalCents]) => {
        const category = await ctx.db.get(categoryId as Id<"fintrack_categories">);
        return {
          categoryId,
          categoryName: category?.name ?? categoryId,
          parentId: (category?.parentId as string | null) ?? null,
          averageCents: Math.round(totalCents / lookbackMonths),
          totalCents,
        };
      })
    );

    return {
      currencyCode: currency,
      rows: entries.sort((a, b) => {
        if (!a.parentId && b.parentId) return -1;
        if (a.parentId && !b.parentId) return 1;
        return a.categoryName.localeCompare(b.categoryName);
      }),
    };
  },
});

// Upsert budget entries from history estimates.
// overwrite=true: updates existing budgets; overwrite=false: skips categories already budgeted.
export const applyHistoryEstimate = mutation({
  args: {
    year: v.number(),
    month: v.number(),
    entries: v.array(
      v.object({
        categoryId: v.id("fintrack_categories"),
        amountPlannedCents: v.number(),
      })
    ),
    overwrite: v.boolean(),
  },
  handler: async (ctx, { year, month, entries, overwrite }) => {
    validateBudgetPeriod(year, month);
    const userId = await requireUserId(ctx);

    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const entry of entries) {
      if (!Number.isInteger(entry.amountPlannedCents) || entry.amountPlannedCents <= 0) continue;

      const category = await ctx.db.get(entry.categoryId);
      if (!category || category.userId !== userId) continue;

      const existing = await ctx.db
        .query("fintrack_budgets")
        .withIndex("by_period", (q) =>
          q.eq("userId", userId).eq("year", year).eq("month", month)
        )
        .filter((q) => q.eq(q.field("categoryId"), entry.categoryId))
        .first();

      if (existing) {
        if (overwrite) {
          await ctx.db.patch(existing._id, { amountPlannedCents: entry.amountPlannedCents });
          updated++;
        } else {
          skipped++;
        }
      } else {
        await ctx.db.insert("fintrack_budgets", {
          userId,
          year,
          month,
          categoryId: entry.categoryId,
          amountPlannedCents: entry.amountPlannedCents,
        });
        created++;
      }
    }

    return { created, updated, skipped };
  },
});

export const copyFromPreviousMonth = mutation({
  args: { year: v.number(), month: v.number() },
  handler: async (ctx, { year, month }) => {
    validateBudgetPeriod(year, month);
    const userId = await requireUserId(ctx);

    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;

    const [previous, existing] = await Promise.all([
      ctx.db
        .query("fintrack_budgets")
        .withIndex("by_period", (q) =>
          q.eq("userId", userId).eq("year", prevYear).eq("month", prevMonth)
        )
        .collect(),
      ctx.db
        .query("fintrack_budgets")
        .withIndex("by_period", (q) =>
          q.eq("userId", userId).eq("year", year).eq("month", month)
        )
        .collect(),
    ]);

    const existingCategoryIds = new Set(existing.map((b) => b.categoryId));
    const toCreate = previous.filter((b) => !existingCategoryIds.has(b.categoryId));

    for (const b of toCreate) {
      await ctx.db.insert("fintrack_budgets", {
        userId,
        year,
        month,
        categoryId: b.categoryId,
        amountPlannedCents: b.amountPlannedCents,
      });
    }
    return toCreate.length;
  },
});
