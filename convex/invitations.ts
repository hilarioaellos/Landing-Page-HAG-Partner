import { mutation, query, internalAction } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { internal } from "./_generated/api";
import { requireRole } from "./lib/guards";
import { sha256hex } from "./lib/crypto";

// ── Internal: send invitation email via Resend ────────────────────────────────
export const sendInvitationEmail = internalAction({
  args: {
    email: v.string(),
    rawToken: v.string(),
    orgName: v.string(),
    role: v.string(),
  },
  handler: async (_ctx, { email, rawToken, orgName, role }) => {
    // SITE_URL must be set in the Convex dashboard env vars (e.g. https://hagpartner.com)
    const siteUrl = process.env.SITE_URL ?? "";
    const inviteUrl = `${siteUrl}/sign-up?invite=${rawToken}`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "HAG Partner <noreply@hagpartner.com>",
        to: [email],
        subject: `You're invited to join ${orgName} on HAG Partner`,
        html: `
          <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px">
            <img src="https://hagpartner.com/images/logo-hag-trim.png" alt="HAG Partner" height="36" style="margin-bottom:24px" />
            <h2 style="font-size:22px;font-weight:600;margin:0 0 12px">You've been invited</h2>
            <p style="color:#64748b;margin:0 0 24px">
              You've been invited to join <strong>${orgName}</strong> on HAG Partner as <strong>${role}</strong>.
              This invitation expires in 72 hours.
            </p>
            <a href="${inviteUrl}" style="display:inline-block;background:#3b82f6;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:500">
              Accept invitation
            </a>
            <p style="color:#94a3b8;font-size:13px;margin-top:24px">
              If you weren't expecting this invitation, you can ignore this email.
            </p>
          </div>
        `,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Resend error ${res.status}: ${body}`);
    }
  },
});

// ── Create invitation (mutation) ──────────────────────────────────────────────
export const createInvitation = mutation({
  args: {
    orgId: v.id("organizations"),
    email: v.string(),
    role: v.union(
      v.literal("admin"),
      v.literal("manager"),
      v.literal("partner"),
      v.literal("viewer")
    ),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    phone: v.optional(v.string()),
  },
  handler: async (ctx, { orgId, email, role, firstName, lastName, phone }) => {
    const { profile } = await requireRole(ctx, orgId, ["super_admin", "admin", "manager"]);

    const normalizedEmail = email.trim().toLowerCase();

    // caller cannot invite with a role equal to or higher than their own
    const roleRank: Record<string, number> = {
      super_admin: 4, admin: 3, manager: 2, partner: 1, viewer: 0,
    };
    if (roleRank[role] >= roleRank[profile.role]) {
      throw new ConvexError({ code: 403, message: "Cannot invite with equal or higher role" });
    }

    // Soft-revoke any existing pending invitation for this email+org
    const allForOrg = await ctx.db
      .query("invitations")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();
    const existingPending = allForOrg.find(
      (inv) => inv.email === normalizedEmail && !inv.usedAt && !inv.revokedAt
    );
    if (existingPending) await ctx.db.patch(existingPending._id, { revokedAt: Date.now() });

    // Generate token
    const tokenBytes = new Uint8Array(32);
    crypto.getRandomValues(tokenBytes);
    const rawToken = Array.from(tokenBytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    const tokenHash = await sha256hex(rawToken);

    await ctx.db.insert("invitations", {
      orgId,
      email: normalizedEmail,
      role,
      firstName: firstName?.trim() || undefined,
      lastName: lastName?.trim() || undefined,
      phone: phone?.trim() || undefined,
      tokenHash,
      expiresAt: Date.now() + 72 * 60 * 60 * 1000,
      createdBy: profile.userId,
    });

    const org = await ctx.db.get(orgId);

    // Schedule email — fire-and-forget, invitation is already committed
    try {
      await ctx.scheduler.runAfter(0, internal.invitations.sendInvitationEmail, {
        email: normalizedEmail,
        rawToken,
        orgName: org?.name ?? "HAG Partner",
        role,
      });
    } catch {
      // Email scheduling failed (e.g. RESEND_API_KEY not configured); invitation still created
    }

    // Return raw token so the admin can share the link directly if email is unavailable
    return { inviteToken: rawToken };
  },
});

// ── Verify invitation (public, no auth) ──────────────────────────────────────
export const verifyInvitation = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const tokenHash = await sha256hex(token);
    const invitation = await ctx.db
      .query("invitations")
      .withIndex("by_token_hash", (q) => q.eq("tokenHash", tokenHash))
      .first();

    if (!invitation) return null;
    if (invitation.usedAt) return null;
    if (invitation.revokedAt) return null;
    if (invitation.expiresAt < Date.now()) return null;

    const org = await ctx.db.get(invitation.orgId);
    return {
      email: invitation.email,
      role: invitation.role,
      orgName: org?.name ?? "",
      firstName: invitation.firstName ?? "",
      lastName: invitation.lastName ?? "",
    };
  },
});

// ── Revoke invitation ─────────────────────────────────────────────────────────
export const revokeInvitation = mutation({
  args: { invitationId: v.id("invitations") },
  handler: async (ctx, { invitationId }) => {
    const invitation = await ctx.db.get(invitationId);
    if (!invitation) throw new ConvexError({ code: 404, message: "Invitation not found" });
    if (invitation.usedAt) throw new ConvexError({ code: 400, message: "Invitation already used" });

    const { userId, profile } = await requireRole(ctx, invitation.orgId, ["super_admin", "admin", "manager"]);

    // Managers can only revoke invitations they created
    if (profile.role === "manager" && invitation.createdBy !== userId) {
      throw new ConvexError({ code: 403, message: "Managers can only revoke their own invitations" });
    }

    await ctx.db.patch(invitationId, { revokedAt: Date.now() });
  },
});

// ── List pending invitations for an org ──────────────────────────────────────
export const listInvitations = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, { orgId }) => {
    await requireRole(ctx, orgId, ["super_admin", "admin", "manager"]);
    const all = await ctx.db
      .query("invitations")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();

    const now = Date.now();
    return all
      .filter((inv) => !inv.usedAt && !inv.revokedAt && inv.expiresAt > now)
      .map(({ tokenHash: _hash, ...safe }) => safe);
  },
});
