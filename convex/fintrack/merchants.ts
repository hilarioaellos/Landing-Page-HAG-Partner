import { ConvexError } from "convex/values";
import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { requireUserId } from "./_auth";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    return ctx.db
      .query("fintrack_merchants")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
  },
});

export const upsertByName = mutation({
  args: {
    name: v.string(),
    defaultCategoryId: v.optional(v.id("fintrack_categories")),
  },
  handler: async (ctx, { name, defaultCategoryId }) => {
    const userId = await requireUserId(ctx);
    const normalizedName = name.trim().toLowerCase();

    if (defaultCategoryId !== undefined) {
      const cat = await ctx.db.get(defaultCategoryId);
      if (!cat || cat.userId !== userId)
        throw new ConvexError({ code: 403, message: "Forbidden" });
    }

    const existing = await ctx.db
      .query("fintrack_merchants")
      .withIndex("by_normalized", (q) =>
        q.eq("userId", userId).eq("normalizedName", normalizedName)
      )
      .first();

    if (existing) {
      if (defaultCategoryId && !existing.defaultCategoryId) {
        await ctx.db.patch(existing._id, { defaultCategoryId });
      }
      return existing._id;
    }

    return ctx.db.insert("fintrack_merchants", {
      userId,
      name: name.trim(),
      normalizedName,
      defaultCategoryId,
    });
  },
});
