import { ConvexError } from "convex/values";
import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { requireUserId } from "./_auth";

const SYSTEM_CATEGORIES = [
  // Expenses
  { name: "Groceries",       icon: "🛒", color: "#2ecc71" },
  { name: "Restaurants",     icon: "🍽️", color: "#f39c12" },
  { name: "Transportation",  icon: "🚗", color: "#3498db" },
  { name: "Allowance",       icon: "💰", color: "#e67e22" },
  { name: "Utilities",       icon: "⚡", color: "#e74c3c" },
  { name: "Entertainment",   icon: "🎬", color: "#9b59b6" },
  { name: "Shopping",        icon: "🛍️", color: "#1abc9c" },
  { name: "Healthcare",      icon: "🏥", color: "#c0392b" },
  { name: "Insurance",       icon: "🛡️", color: "#34495e" },
  { name: "Mortgage/Rent",   icon: "🏠", color: "#16a085" },
  { name: "Home",            icon: "🏡", color: "#27ae60" },
  { name: "Travel",          icon: "✈️", color: "#8e44ad" },
  { name: "Gifts",           icon: "🎁", color: "#d35400" },
  { name: "Education",       icon: "📚", color: "#2980b9" },
  { name: "Personal Care",   icon: "💅", color: "#e91e8c" },
  { name: "Other",           icon: "🏷️", color: "#7f8c8d" },
  { name: "Technology",         icon: "🖥️", color: "#0ea5e9" },
  { name: "Finances",           icon: "💳", color: "#64748b" },
  // Income
  { name: "Salary",             icon: "💼", color: "#27ae60" },
  { name: "Freelance",          icon: "💻", color: "#2980b9" },
  { name: "Gift Income",        icon: "🎁", color: "#e74c3c" },
  { name: "Bonus",              icon: "🎉", color: "#f39c12" },
  { name: "Investment Returns", icon: "📈", color: "#16a085" },
  { name: "Rental Income",      icon: "🏘️", color: "#8e44ad" },
  { name: "Business Income",    icon: "🏢", color: "#0891b2" },
  { name: "IRIS",               icon: "👤", color: "#7c3aed" },
  // Neutral — used to tag imported transactions that are internal transfers
  { name: "Transfers",          icon: "🔄", color: "#0ea5e9" },
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

// Returns categories with their settings merged (isActive, excludeFromReports from DB)
export const listWithSettings = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);

    const cats = await ctx.db
      .query("fintrack_categories")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const settings = await ctx.db
      .query("fintrack_category_settings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const settingsMap = new Map(settings.map((s) => [s.categoryId as string, s]));

    return cats.map((cat) => ({
      ...cat,
      isActive: settingsMap.get(cat._id)?.isActive ?? true,
      excludeFromReports: settingsMap.get(cat._id)?.excludeFromReports ?? false,
    }));
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
// Skips entirely if the user has already reviewed their categories.
export const seed = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);

    const settings = await ctx.db
      .query("fintrack_user_settings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (settings?.categoriesReviewed === true) return;

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

// Idempotent — ensures all SYSTEM_CATEGORIES exist for the user, even if they
// were added after the initial seed. Safe to call on every session start.
// Unlike `seed`, does NOT skip when categoriesReviewed === true.
export const ensureSystemCategories = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);

    const existing = await ctx.db
      .query("fintrack_categories")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const byName = new Map(existing.map((c) => [c.name, c]));

    for (const cat of SYSTEM_CATEGORIES) {
      const match = byName.get(cat.name);
      if (!match) {
        // Create missing system category
        const catId = await ctx.db.insert("fintrack_categories", {
          userId,
          name: cat.name,
          icon: cat.icon,
          color: cat.color,
          isSystem: true,
        });
        await ctx.db.insert("fintrack_category_settings", {
          userId,
          categoryId: catId,
          isActive: true,
          excludeFromReports: false,
        });
      } else if (!match.isSystem) {
        // Promote existing custom category with same name to system
        await ctx.db.patch(match._id, { isSystem: true, icon: cat.icon, color: cat.color });
        const setting = await ctx.db
          .query("fintrack_category_settings")
          .withIndex("by_user_category", (q) =>
            q.eq("userId", userId).eq("categoryId", match._id)
          )
          .first();
        if (!setting) {
          await ctx.db.insert("fintrack_category_settings", {
            userId,
            categoryId: match._id,
            isActive: true,
            excludeFromReports: false,
          });
        }
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

export const update = mutation({
  args: {
    id: v.id("fintrack_categories"),
    name: v.optional(v.string()),
    icon: v.optional(v.string()),
    color: v.optional(v.string()),
  },
  handler: async (ctx, { id, name, icon, color }) => {
    const userId = await requireUserId(ctx);
    const cat = await ctx.db.get(id);
    if (!cat || cat.userId !== userId)
      throw new ConvexError({ code: 403, message: "Forbidden" });
    if (cat.isSystem)
      throw new ConvexError("System categories cannot be renamed");
    if (name !== undefined && !name.trim())
      throw new ConvexError("Name is required");

    const patch: Record<string, unknown> = {};
    if (name !== undefined) patch.name = name.trim();
    if (icon !== undefined) patch.icon = icon;
    if (color !== undefined) patch.color = color;
    if (Object.keys(patch).length > 0) await ctx.db.patch(id, patch);
  },
});

async function _deleteCategory(
  ctx: { db: { get: Function; query: Function; patch: Function; delete: Function } },
  userId: string,
  id: string
) {
  // 1. Transactions: clear optional categoryId
  const txs = await ctx.db
    .query("fintrack_transactions")
    .withIndex("by_category", (q: any) => q.eq("userId", userId).eq("categoryId", id))
    .collect();
  for (const tx of txs) await ctx.db.patch(tx._id, { categoryId: undefined });

  // 2. Budgets: delete (categoryId is required — row has no meaning without category)
  const budgets = await ctx.db
    .query("fintrack_budgets")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .collect();
  for (const b of budgets) {
    if (b.categoryId === id) await ctx.db.delete(b._id);
  }

  // 3. Transaction splits: delete splits where categoryId matches; clear subcategoryId
  const splits = await ctx.db
    .query("fintrack_transaction_splits")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .collect();
  for (const s of splits) {
    if (s.categoryId === id) { await ctx.db.delete(s._id); continue; }
    if (s.subcategoryId === id) await ctx.db.patch(s._id, { subcategoryId: undefined });
  }

  // 4. Subscriptions: clear optional categoryId
  const subs = await ctx.db
    .query("fintrack_subscriptions")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .collect();
  for (const s of subs) {
    if (s.categoryId === id) await ctx.db.patch(s._id, { categoryId: undefined });
  }

  // 5. Merchants: clear optional defaultCategoryId
  const merchants = await ctx.db
    .query("fintrack_merchants")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .collect();
  for (const m of merchants) {
    if (m.defaultCategoryId === id) await ctx.db.patch(m._id, { defaultCategoryId: undefined });
  }

  // 6. Child categories: clear parentId (reparent to root)
  const children = await ctx.db
    .query("fintrack_categories")
    .withIndex("by_parent", (q: any) => q.eq("parentId", id))
    .collect();
  for (const c of children) await ctx.db.patch(c._id, { parentId: undefined });

  // 7. Category settings
  const catSettings = await ctx.db
    .query("fintrack_category_settings")
    .withIndex("by_user_category", (q: any) => q.eq("userId", userId).eq("categoryId", id))
    .first();
  if (catSettings) await ctx.db.delete(catSettings._id);

  await ctx.db.delete(id);
}

export const remove = mutation({
  args: { id: v.id("fintrack_categories") },
  handler: async (ctx, { id }) => {
    const userId = await requireUserId(ctx);
    const cat = await ctx.db.get(id);
    if (!cat || cat.userId !== userId)
      throw new ConvexError({ code: 403, message: "Forbidden" });
    if (cat.isSystem)
      throw new ConvexError("System categories cannot be deleted");

    await _deleteCategory(ctx, userId, id);
  },
});

// Removes isSystem categories that are no longer in the canonical SYSTEM_CATEGORIES list.
// Idempotent — safe to call on every session start.
export const cleanLegacySystemCategories = mutation({
  args: {},
  handler: async (ctx): Promise<{ deleted: number }> => {
    const userId = await requireUserId(ctx);

    const all = await ctx.db
      .query("fintrack_categories")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const canonicalNames = new Set(SYSTEM_CATEGORIES.map((c) => c.name));
    const legacy = all.filter((c) => c.isSystem && !canonicalNames.has(c.name));

    for (const cat of legacy) {
      await _deleteCategory(ctx, userId, cat._id);
    }

    return { deleted: legacy.length };
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
