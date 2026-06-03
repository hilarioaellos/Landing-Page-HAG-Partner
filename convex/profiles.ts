import { mutation, query } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { requireUser, requireProfile, requireRole } from "./lib/guards";
import { sha256hex } from "./lib/crypto";

export const initializeProfile = mutation({
  args: { inviteToken: v.optional(v.string()) },
  handler: async (ctx, { inviteToken }) => {
    const userId = await requireUser(ctx);

    const existing = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (existing) return existing._id;

    if (inviteToken) {
      const tokenHash = await sha256hex(inviteToken);
      const now = Date.now();

      const invitation = await ctx.db
        .query("invitations")
        .withIndex("by_token_hash", (q) => q.eq("tokenHash", tokenHash))
        .first();

      if (invitation && invitation.expiresAt > now && !invitation.usedAt) {
        const user = await ctx.db.get(userId);
        if (!user || user.email !== invitation.email) {
          throw new ConvexError({ code: 403, message: "Email does not match invitation" });
        }

        const profileId = await ctx.db.insert("profiles", {
          userId,
          orgId: invitation.orgId,
          role: invitation.role,
          firstName: "",
          lastName: "",
          isActive: true,
        });

        await ctx.db.patch(invitation._id, { usedAt: now });
        return profileId;
      }
    }

    // No valid token → inactive profile pending super_admin assignment
    return ctx.db.insert("profiles", {
      userId,
      orgId: undefined,
      role: "partner",
      firstName: "",
      lastName: "",
      isActive: false,
    });
  },
});

export const getMyProfile = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUser(ctx);
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (!profile) return null;
    const org = profile.orgId ? await ctx.db.get(profile.orgId) : null;
    return { ...profile, org };
  },
});

export const getOrgUsers = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, { orgId }) => {
    await requireRole(ctx, orgId, ["super_admin", "admin", "manager"]);
    const profiles = await ctx.db
      .query("profiles")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();

    return Promise.all(
      profiles.map(async (p) => {
        const user = await ctx.db.get(p.userId);
        return { ...p, email: user?.email ?? "" };
      })
    );
  },
});

export const updateUserRole = mutation({
  args: {
    profileId: v.id("profiles"),
    newRole: v.union(
      v.literal("admin"),
      v.literal("manager"),
      v.literal("partner"),
      v.literal("viewer")
    ),
  },
  handler: async (ctx, { profileId, newRole }) => {
    const target = await ctx.db.get(profileId);
    if (!target || !target.orgId) throw new ConvexError({ code: 404, message: "Profile not found" });

    const { profile: caller } = await requireRole(ctx, target.orgId, ["super_admin", "admin"]);

    if (target._id === caller._id) {
      throw new ConvexError({ code: 400, message: "Cannot change your own role" });
    }

    const roleRank: Record<string, number> = {
      super_admin: 4, admin: 3, manager: 2, partner: 1, viewer: 0,
    };

    // admin cannot promote to equal or higher than their own rank
    if (roleRank[newRole] >= roleRank[caller.role]) {
      throw new ConvexError({ code: 403, message: "Cannot assign a role equal to or higher than your own" });
    }

    // Protect last admin: if demoting an admin, ensure at least one remains
    if (target.role === "admin" || target.role === "super_admin") {
      const admins = await ctx.db
        .query("profiles")
        .withIndex("by_org", (q) => q.eq("orgId", target.orgId!))
        .filter((q) =>
          q.or(q.eq(q.field("role"), "admin"), q.eq(q.field("role"), "super_admin"))
        )
        .collect();
      if (admins.length <= 1) {
        throw new ConvexError({ code: 400, message: "Cannot remove the last admin from the organization" });
      }
    }

    await ctx.db.patch(profileId, { role: newRole });
  },
});

export const setUserActive = mutation({
  args: { profileId: v.id("profiles"), isActive: v.boolean() },
  handler: async (ctx, { profileId, isActive }) => {
    const target = await ctx.db.get(profileId);
    if (!target || !target.orgId) throw new ConvexError({ code: 404, message: "Profile not found" });

    const { profile: caller } = await requireRole(ctx, target.orgId, ["super_admin", "admin"]);

    if (target._id === caller._id) {
      throw new ConvexError({ code: 400, message: "Cannot deactivate your own account" });
    }

    // Protect last admin from deactivation
    if (!isActive && (target.role === "admin" || target.role === "super_admin")) {
      const activeAdmins = await ctx.db
        .query("profiles")
        .withIndex("by_org", (q) => q.eq("orgId", target.orgId!))
        .filter((q) =>
          q.and(
            q.or(q.eq(q.field("role"), "admin"), q.eq(q.field("role"), "super_admin")),
            q.eq(q.field("isActive"), true)
          )
        )
        .collect();
      if (activeAdmins.length <= 1) {
        throw new ConvexError({ code: 400, message: "Cannot deactivate the last active admin" });
      }
    }

    await ctx.db.patch(profileId, { isActive });
  },
});

export const updateUserProfile = mutation({
  args: {
    profileId: v.id("profiles"),
    firstName: v.string(),
    lastName: v.string(),
    phone: v.optional(v.string()),
  },
  handler: async (ctx, { profileId, firstName, lastName, phone }) => {
    const target = await ctx.db.get(profileId);
    if (!target || !target.orgId) throw new ConvexError({ code: 404, message: "Profile not found" });
    await requireRole(ctx, target.orgId, ["super_admin", "admin", "manager"]);
    await ctx.db.patch(profileId, { firstName, lastName, phone: phone ?? undefined });
  },
});

export const updateProfile = mutation({
  args: {
    firstName: v.string(),
    lastName: v.string(),
    phone: v.optional(v.string()),
    avatar: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { profile } = await requireProfile(ctx);
    await ctx.db.patch(profile._id, {
      firstName: args.firstName,
      lastName: args.lastName,
      phone: args.phone ?? undefined,
    });
  },
});
