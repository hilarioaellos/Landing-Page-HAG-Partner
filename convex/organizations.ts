import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { requireSuperAdmin, requireProfile } from "./lib/guards";

export const createOrganization = mutation({
  args: {
    name: v.string(),
    slug: v.string(),
    plan: v.union(v.literal("free"), v.literal("pro"), v.literal("enterprise")),
  },
  handler: async (ctx, { name, slug, plan }) => {
    const { userId } = await requireSuperAdmin(ctx);

    const existing = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();
    if (existing) throw new ConvexError({ code: 409, message: "Slug already in use" });

    const orgId = await ctx.db.insert("organizations", {
      name,
      slug,
      plan,
      isActive: true,
    });

    return orgId;
  },
});

export const getOrganization = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, { orgId }) => {
    await requireProfile(ctx, orgId);
    return ctx.db.get(orgId);
  },
});

export const listOrganizations = query({
  args: {},
  handler: async (ctx) => {
    await requireSuperAdmin(ctx);
    return ctx.db.query("organizations").collect();
  },
});
