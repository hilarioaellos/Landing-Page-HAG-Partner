import { ConvexError } from "convex/values";
import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { requireUserId } from "./_auth";

// amount stored in cents (integers) for consistency with the rest of the app.

const PERIODICITY = v.union(
  v.literal("monthly"),
  v.literal("quarterly"),
  v.literal("annual"),
  v.literal("weekly")
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

function advanceRenewalDate(ts: number, periodicity: string): number {
  const d = new Date(ts);
  switch (periodicity) {
    case "weekly":
      d.setDate(d.getDate() + 7);
      break;
    case "monthly":
      d.setMonth(d.getMonth() + 1);
      break;
    case "quarterly":
      d.setMonth(d.getMonth() + 3);
      break;
    case "annual":
      d.setFullYear(d.getFullYear() + 1);
      break;
  }
  return d.getTime();
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    return ctx.db
      .query("fintrack_subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    amount: v.number(),
    currencyCode: v.string(),
    periodicity: PERIODICITY,
    nextRenewalDate: v.number(),
    accountId: v.id("fintrack_accounts"),
    categoryId: v.optional(v.id("fintrack_categories")),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const name = args.name.trim();
    if (!name) throw new ConvexError("Name is required");
    if (!Number.isInteger(args.amount) || args.amount <= 0)
      throw new ConvexError("amount must be a positive integer (cents)");
    const currencyCode = validateCurrencyCode(args.currencyCode);

    // Validate accountId ownership
    const account = await ctx.db.get(args.accountId);
    if (!account || account.userId !== userId || !account.isActive)
      throw new ConvexError("Invalid or inaccessible account");

    // Validate categoryId ownership if provided
    if (args.categoryId !== undefined) {
      const category = await ctx.db.get(args.categoryId);
      if (!category || category.userId !== userId)
        throw new ConvexError("Invalid or inaccessible category");
    }

    return ctx.db.insert("fintrack_subscriptions", {
      userId,
      name,
      amount: args.amount,
      currencyCode,
      periodicity: args.periodicity,
      nextRenewalDate: args.nextRenewalDate,
      accountId: args.accountId,
      categoryId: args.categoryId,
      isActive: true,
      notes: args.notes?.trim() || undefined,
      createdAt: Date.now(),
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("fintrack_subscriptions"),
    name: v.optional(v.string()),
    amount: v.optional(v.number()),
    currencyCode: v.optional(v.string()),
    periodicity: v.optional(PERIODICITY),
    nextRenewalDate: v.optional(v.number()),
    accountId: v.optional(v.id("fintrack_accounts")),
    categoryId: v.optional(v.union(v.id("fintrack_categories"), v.null())),
    notes: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, { id, ...fields }) => {
    const userId = await requireUserId(ctx);
    const sub = await ctx.db.get(id);
    if (!sub || sub.userId !== userId)
      throw new ConvexError({ code: 403, message: "Forbidden" });

    const patch: Record<string, unknown> = {};
    if (fields.name !== undefined) {
      const name = fields.name.trim();
      if (!name) throw new ConvexError("Name is required");
      patch.name = name;
    }
    if (fields.amount !== undefined) {
      if (!Number.isInteger(fields.amount) || fields.amount <= 0)
        throw new ConvexError("amount must be a positive integer (cents)");
      patch.amount = fields.amount;
    }
    if (fields.currencyCode !== undefined) {
      patch.currencyCode = validateCurrencyCode(fields.currencyCode);
    }
    if (fields.periodicity !== undefined) patch.periodicity = fields.periodicity;
    if (fields.nextRenewalDate !== undefined) patch.nextRenewalDate = fields.nextRenewalDate;
    if (fields.accountId !== undefined) {
      const account = await ctx.db.get(fields.accountId);
      if (!account || account.userId !== userId || !account.isActive)
        throw new ConvexError("Invalid or inaccessible account");
      patch.accountId = fields.accountId;
    }
    if (fields.categoryId !== undefined) {
      if (fields.categoryId !== null) {
        const category = await ctx.db.get(fields.categoryId);
        if (!category || category.userId !== userId)
          throw new ConvexError("Invalid or inaccessible category");
      }
      patch.categoryId = fields.categoryId ?? undefined;
    }
    if (fields.notes !== undefined) {
      const trimmed = typeof fields.notes === "string" ? fields.notes.trim() : null;
      patch.notes = trimmed || undefined;
    }

    if (Object.keys(patch).length > 0) await ctx.db.patch(id, patch);
  },
});

export const renew = mutation({
  args: { id: v.id("fintrack_subscriptions") },
  handler: async (ctx, { id }) => {
    const userId = await requireUserId(ctx);
    const sub = await ctx.db.get(id);
    if (!sub || sub.userId !== userId)
      throw new ConvexError({ code: 403, message: "Forbidden" });
    if (!sub.isActive)
      throw new ConvexError("Cannot renew a cancelled subscription");
    const nextDate = advanceRenewalDate(sub.nextRenewalDate, sub.periodicity);
    await ctx.db.patch(id, { nextRenewalDate: nextDate });
  },
});

export const cancel = mutation({
  args: { id: v.id("fintrack_subscriptions") },
  handler: async (ctx, { id }) => {
    const userId = await requireUserId(ctx);
    const sub = await ctx.db.get(id);
    if (!sub || sub.userId !== userId)
      throw new ConvexError({ code: 403, message: "Forbidden" });
    await ctx.db.patch(id, { isActive: false });
  },
});
