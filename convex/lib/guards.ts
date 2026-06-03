import { ConvexError } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Id } from "../_generated/dataModel";
import type { QueryCtx, MutationCtx } from "../_generated/server";

type Ctx = QueryCtx | MutationCtx;

type Role = "super_admin" | "admin" | "manager" | "partner" | "viewer";

export async function requireUser(ctx: Ctx): Promise<Id<"users">> {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new ConvexError({ code: 401, message: "Unauthenticated" });
  return userId;
}

export async function requireProfile(ctx: Ctx, orgId?: Id<"organizations">) {
  const userId = await requireUser(ctx);

  const profile = await ctx.db
    .query("profiles")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();

  if (!profile) throw new ConvexError({ code: 403, message: "No profile found" });
  if (!profile.isActive) throw new ConvexError({ code: 403, message: "Account inactive" });
  if (orgId && profile.role !== "super_admin" && profile.orgId !== orgId) {
    throw new ConvexError({ code: 403, message: "Not a member of this organization" });
  }

  return { userId, profile };
}

export async function requireRole(
  ctx: Ctx,
  orgId: Id<"organizations">,
  allowedRoles: Role[]
) {
  const { userId, profile } = await requireProfile(ctx, orgId);

  if (profile.role !== "super_admin" && !allowedRoles.includes(profile.role as Role)) {
    throw new ConvexError({ code: 403, message: "Insufficient permissions" });
  }

  return { userId, profile };
}

export async function requireSuperAdmin(ctx: Ctx) {
  const userId = await requireUser(ctx);

  const profile = await ctx.db
    .query("profiles")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();

  if (!profile) throw new ConvexError({ code: 403, message: "No profile found" });
  if (!profile.isActive) throw new ConvexError({ code: 403, message: "Account inactive" });
  if (profile.role !== "super_admin") {
    throw new ConvexError({ code: 403, message: "Super admin access required" });
  }

  return { userId, profile };
}
