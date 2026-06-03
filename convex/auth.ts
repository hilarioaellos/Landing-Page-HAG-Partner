import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";
import { ConvexError } from "convex/values";
import type { MutationCtx } from "./_generated/server";
import { sha256hex } from "./lib/crypto";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password({
      profile(params) {
        // Build result without undefined values — Convex Value does not allow undefined
        const result: { [key: string]: string; email: string } = {
          email: params.email as string,
        };
        if (params.inviteToken) result.inviteToken = params.inviteToken as string;
        return result;
      },
    }),
  ],
  callbacks: {
    async createOrUpdateUser(ctx, args) {
      if (args.existingUserId) {
        return args.existingUserId;
      }

      const profile = args.profile as { email: string; inviteToken?: string };
      const db = (ctx as unknown as MutationCtx).db;

      if (!profile.inviteToken) {
        // Allow bootstrap only when no super_admin exists yet
        const hasAdmin = await db
          .query("profiles")
          .filter((q) => q.eq(q.field("role"), "super_admin"))
          .first();

        if (hasAdmin) {
          throw new ConvexError({ code: 403, message: "An invitation is required to register" });
        }

        const userId = await db.insert("users", {
          email: profile.email.toLowerCase(),
        });

        // Ensure the default org exists
        let org = await db
          .query("organizations")
          .withIndex("by_slug", (q) => q.eq("slug", "hag-partner"))
          .first();

        if (!org) {
          const orgId = await db.insert("organizations", {
            name: "HAG Partner LLC",
            slug: "hag-partner",
            plan: "enterprise",
            isActive: true,
          });
          org = await db.get(orgId);
        }

        await db.insert("profiles", {
          userId,
          orgId: org!._id,
          role: "super_admin",
          firstName: "",
          lastName: "",
          isActive: true,
        });

        return userId;
      }

      const tokenHash = await sha256hex(profile.inviteToken);
      const now = Date.now();

      const invitation = await db
        .query("invitations")
        .withIndex("by_token_hash", (q) => q.eq("tokenHash", tokenHash))
        .first();

      if (!invitation || invitation.usedAt || invitation.revokedAt || invitation.expiresAt < now) {
        throw new ConvexError({ code: 403, message: "Invalid or expired invitation" });
      }

      if (invitation.email.toLowerCase() !== profile.email.toLowerCase()) {
        throw new ConvexError({ code: 403, message: "Email does not match invitation" });
      }

      const userId = await db.insert("users", {
        email: profile.email.toLowerCase(),
      });

      await db.insert("profiles", {
        userId,
        orgId: invitation.orgId,
        role: invitation.role,
        firstName: invitation.firstName ?? "",
        lastName: invitation.lastName ?? "",
        phone: invitation.phone ?? undefined,
        isActive: true,
      });

      await db.patch(invitation._id, { usedAt: now });

      return userId;
    },
  },
});
