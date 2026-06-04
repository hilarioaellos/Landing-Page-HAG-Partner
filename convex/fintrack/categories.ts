import { ConvexError } from "convex/values";
import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { requireUserId } from "./_auth";

const SYSTEM_CATEGORIES = [
  { name: "Food & Dining",     icon: "🍽️", color: "#f59e0b" },
  { name: "Transportation",    icon: "🚗", color: "#3b82f6" },
  { name: "Shopping",          icon: "🛍️", color: "#ec4899" },
  { name: "Bills & Utilities", icon: "💡", color: "#8b5cf6" },
  { name: "Health",            icon: "❤️", color: "#ef4444" },
  { name: "Entertainment",     icon: "🎬", color: "#06b6d4" },
  { name: "Income",            icon: "💰", color: "#10b981" },
  { name: "Transfer",          icon: "↔️", color: "#6b7280" },
  { name: "Other",             icon: "📦", color: "#94a3b8" },
];

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    return ctx.db
      .query("fintrack_categories")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
  },
});

// Idempotent — safe to call on every mount; no-ops if already seeded
export const seed = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const existing = await ctx.db
      .query("fintrack_categories")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (existing) return;
    for (const cat of SYSTEM_CATEGORIES) {
      await ctx.db.insert("fintrack_categories", {
        userId,
        name: cat.name,
        icon: cat.icon,
        color: cat.color,
        isSystem: true,
      });
    }
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    icon: v.optional(v.string()),
    color: v.optional(v.string()),
    parentId: v.optional(v.id("fintrack_categories")),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    if (!args.name.trim()) throw new ConvexError("Name is required");

    if (args.parentId !== undefined) {
      const parent = await ctx.db.get(args.parentId);
      if (!parent || parent.userId !== userId)
        throw new ConvexError({ code: 403, message: "Forbidden" });
    }

    return ctx.db.insert("fintrack_categories", {
      userId,
      name: args.name.trim(),
      icon: args.icon,
      color: args.color,
      parentId: args.parentId,
      isSystem: false,
    });
  },
});
