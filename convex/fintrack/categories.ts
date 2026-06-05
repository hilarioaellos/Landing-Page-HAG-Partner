import { ConvexError } from "convex/values";
import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { requireUserId } from "./_auth";

const SYSTEM_CATEGORIES = [
  // Gastos
  { name: "Groceries",          icon: "🛒", color: "#2ecc71" },
  { name: "Restaurants",        icon: "🍽️", color: "#f39c12" },
  { name: "Transportation",     icon: "🚗", color: "#3498db" },
  { name: "Utilities",          icon: "⚡", color: "#e74c3c" },
  { name: "Entertainment",      icon: "🎮", color: "#9b59b6" },
  { name: "Shopping",           icon: "🛍️", color: "#1abc9c" },
  { name: "Healthcare",         icon: "🏥", color: "#c0392b" },
  { name: "Insurance",          icon: "🛡️", color: "#34495e" },
  { name: "Rent",               icon: "🏠", color: "#16a085" },
  { name: "Gym",                icon: "💪", color: "#e67e22" },
  { name: "Phone",              icon: "📱", color: "#2980b9" },
  { name: "Travel",             icon: "✈️", color: "#8e44ad" },
  { name: "Subscriptions",      icon: "🔄", color: "#1bbc9b" },
  { name: "Gifts",              icon: "🎁", color: "#d35400" },
  { name: "Pets",               icon: "🐕", color: "#27ae60" },
  { name: "Books",              icon: "📚", color: "#3498db" },
  { name: "Other",              icon: "🏷️", color: "#7f8c8d" },
  // Ingresos
  { name: "Salary",             icon: "💼", color: "#27ae60" },
  { name: "Freelance",          icon: "💻", color: "#2980b9" },
  { name: "Bonus",              icon: "🎉", color: "#f39c12" },
  { name: "Investment Returns", icon: "📈", color: "#16a085" },
  { name: "Gift Income",        icon: "🎁", color: "#e74c3c" },
  { name: "Rental Income",      icon: "🏠", color: "#8e44ad" },
  { name: "Other Income",       icon: "🏷️", color: "#95a5a6" },
];

// Returns all categories for the current user
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

// Returns categories the user has marked active.
// Falls back to all categories if settings have never been initialized
// (backward compat for existing users).
export const listActive = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);

    const allCats = await ctx.db
      .query("fintrack_categories")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const settings = await ctx.db
      .query("fintrack_category_settings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // Not initialized yet — return everything so the UI isn't broken
    if (settings.length === 0) return allCats;

    const activeCatIds = new Set(
      settings.filter((s) => s.isActive).map((s) => s.categoryId)
    );

    return allCats.filter((cat) => activeCatIds.has(cat._id));
  },
});

// Idempotent — seeds only categories not yet present by name.
// Safe to call on every mount.
export const seed = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const existing = await ctx.db
      .query("fintrack_categories")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const existingNames = new Set(existing.map((c) => c.name));

    for (const cat of SYSTEM_CATEGORIES) {
      if (!existingNames.has(cat.name)) {
        await ctx.db.insert("fintrack_categories", {
          userId,
          name: cat.name,
          icon: cat.icon,
          color: cat.color,
          isSystem: true,
        });
      }
    }
  },
});

// Idempotent — creates fintrack_category_settings for every category that
// doesn't have a record yet. Safe to call on every mount / for existing users.
export const initializeSettings = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);

    const allCats = await ctx.db
      .query("fintrack_categories")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const existingSettings = await ctx.db
      .query("fintrack_category_settings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const settledCatIds = new Set(existingSettings.map((s) => s.categoryId));

    for (const cat of allCats) {
      if (!settledCatIds.has(cat._id)) {
        await ctx.db.insert("fintrack_category_settings", {
          userId,
          categoryId: cat._id,
          isActive: true,
          excludeFromReports: false,
        });
      }
    }
  },
});

// Update a single category setting. Cannot override forceExclude categories.
export const updateSetting = mutation({
  args: {
    categoryId: v.id("fintrack_categories"),
    isActive: v.boolean(),
    excludeFromReports: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);

    const cat = await ctx.db.get(args.categoryId);
    if (!cat || cat.userId !== userId)
      throw new ConvexError({ code: 404, message: "Category not found" });
    if (cat.forceExclude)
      throw new ConvexError("This system category cannot be modified");

    const existing = await ctx.db
      .query("fintrack_category_settings")
      .withIndex("by_user_category", (q) =>
        q.eq("userId", userId).eq("categoryId", args.categoryId)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        isActive: args.isActive,
        ...(args.excludeFromReports !== undefined && {
          excludeFromReports: args.excludeFromReports,
        }),
      });
    } else {
      await ctx.db.insert("fintrack_category_settings", {
        userId,
        categoryId: args.categoryId,
        isActive: args.isActive,
        excludeFromReports: args.excludeFromReports ?? false,
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

    const catId = await ctx.db.insert("fintrack_categories", {
      userId,
      name: args.name.trim(),
      icon: args.icon,
      color: args.color,
      parentId: args.parentId,
      isSystem: false,
    });

    // Auto-create settings for newly user-created categories
    await ctx.db.insert("fintrack_category_settings", {
      userId,
      categoryId: catId,
      isActive: true,
      excludeFromReports: false,
    });

    return catId;
  },
});
