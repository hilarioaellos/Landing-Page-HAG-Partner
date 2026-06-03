"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { type Id } from "../../../../convex/_generated/dataModel";
import { type Role, can } from "@/lib/permissions";
import PermissionGate from "@/components/portal/PermissionGate";

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  manager: "Manager",
  partner: "Partner",
  viewer: "Viewer",
};

const ASSIGNABLE_ROLES = ["admin", "manager", "partner", "viewer"] as const;

function RoleBadge({ role }: { role: string }) {
  const colors: Record<string, string> = {
    super_admin: "#a78bfa", admin: "#60a5fa",
    manager: "#34d399", partner: "#fbbf24", viewer: "#94a3b8",
  };
  const c = colors[role] ?? "#94a3b8";
  return (
    <span style={{ fontSize: "12px", fontWeight: 600, padding: "3px 8px", borderRadius: "4px",
      background: `${c}18`, color: c, border: `1px solid ${c}30` }}>
      {ROLE_LABELS[role] ?? role}
    </span>
  );
}

function StatusDot({ active }: { active: boolean }) {
  return (
    <span style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px",
      color: active ? "#34d399" : "var(--text-3)" }}>
      <span style={{ width: 7, height: 7, borderRadius: "50%", flexShrink: 0,
        background: active ? "#34d399" : "var(--border-strong)" }} />
      {active ? "Active" : "Inactive"}
    </span>
  );
}

function InviteModal({ orgId, onClose }: { orgId: Id<"organizations">; onClose: () => void }) {
  const createInvitation = useMutation(api.invitations.createInvitation);
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<"admin" | "manager" | "partner" | "viewer">("partner");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [inviteUrl, setInviteUrl] = useState("");
  const [copied, setCopied] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    try {
      const result = await createInvitation({
        orgId, email, role,
        firstName: firstName || undefined,
        lastName: lastName || undefined,
        phone: phone || undefined,
      });
      const base = typeof window !== "undefined" ? window.location.origin : "";
      setInviteUrl(`${base}/sign-up?invite=${result.inviteToken}`);
      setStatus("sent");
    } catch (err: any) {
      setErrorMsg(err?.data?.message ?? err?.message ?? "Failed to send invitation.");
      setStatus("error");
    }
  }

  function copyLink() {
    navigator.clipboard.writeText(inviteUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="invite-overlay" onClick={onClose}>
      <div className="invite-box" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-title">Invite user</h2>
        {status === "sent" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <p style={{ color: "#34d399", margin: 0 }}>
              Invitation created for <strong>{email}</strong>
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-2)" }}>
                Invite link (valid 72 h)
              </label>
              <div style={{ display: "flex", gap: "8px" }}>
                <input
                  readOnly
                  value={inviteUrl}
                  style={{
                    flex: 1, background: "var(--surface-2)", border: "1px solid var(--border)",
                    borderRadius: "var(--r)", padding: "8px 10px", color: "var(--text-3)",
                    fontSize: "12px", fontFamily: "monospace", minWidth: 0,
                  }}
                />
                <button className="btn btn-ghost btn-sm" onClick={copyLink} style={{ flexShrink: 0 }}>
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
              <p style={{ fontSize: "12px", color: "var(--text-3)", margin: 0 }}>
                Share this link with the invitee. An email is sent automatically if RESEND_API_KEY is configured.
              </p>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button className="btn btn-primary btn-sm" onClick={onClose}>Done</button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div className="form-group">
              <label>Email address</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="partner@company.com" required />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", minWidth: 0 }}>
              <div className="form-group" style={{ minWidth: 0 }}>
                <label>First name</label>
                <input value={firstName} onChange={(e) => setFirstName(e.target.value)}
                  placeholder="John" style={{ width: "100%", boxSizing: "border-box" }} />
              </div>
              <div className="form-group" style={{ minWidth: 0 }}>
                <label>Last name</label>
                <input value={lastName} onChange={(e) => setLastName(e.target.value)}
                  placeholder="Doe" style={{ width: "100%", boxSizing: "border-box" }} />
              </div>
            </div>
            <div className="form-group">
              <label>Phone <span style={{ color: "var(--text-3)", fontWeight: 400 }}>(optional)</span></label>
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 (555) 000-0000" />
            </div>
            <div className="form-group">
              <label>Role</label>
              <select value={role} onChange={(e) => setRole(e.target.value as any)}>
                {ASSIGNABLE_ROLES.map((r) => (
                  <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                ))}
              </select>
            </div>
            {status === "error" && <p className="form-error">{errorMsg}</p>}
            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn btn-primary btn-sm" disabled={status === "sending"}>
                {status === "sending" ? "Sending…" : "Send invitation"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function UserActions({
  user,
  callerRole,
  isMe,
}: {
  user: { _id: Id<"profiles">; role: string; isActive: boolean; firstName: string; lastName: string; phone?: string };
  callerRole: Role | undefined;
  isMe: boolean;
}) {
  const changeRole = useMutation(api.profiles.updateUserRole);
  const toggleActive = useMutation(api.profiles.setUserActive);
  const [saving, setSaving] = useState<"role" | "active" | null>(null);
  const [showEdit, setShowEdit] = useState(false);

  if (isMe) return <span style={{ color: "var(--text-3)", fontSize: "13px" }}>—</span>;

  const roleRank: Record<string, number> = {
    super_admin: 4, admin: 3, manager: 2, partner: 1, viewer: 0,
  };
  const callerRank = roleRank[callerRole ?? "viewer"] ?? 0;
  const assignable = ASSIGNABLE_ROLES.filter((r) => roleRank[r] < callerRank);

  return (
    <>
      <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", alignItems: "center" }}>
        {assignable.length > 0 && (
          <select
            value={user.role}
            disabled={saving === "role"}
            className="action-select"
            onChange={async (e) => {
              if (e.target.value === user.role) return;
              setSaving("role");
              try { await changeRole({ profileId: user._id, newRole: e.target.value as any }); }
              catch {}
              finally { setSaving(null); }
            }}
          >
            <option value={user.role}>{ROLE_LABELS[user.role] ?? user.role}</option>
            {assignable.filter((r) => r !== user.role).map((r) => (
              <option key={r} value={r}>{ROLE_LABELS[r]}</option>
            ))}
          </select>
        )}
        <button
          className="btn btn-ghost btn-sm"
          style={{ fontSize: "12px", padding: "4px 10px" }}
          onClick={() => setShowEdit(true)}
        >
          Edit
        </button>
        <button
          className="btn btn-ghost btn-sm"
          style={{
            fontSize: "12px", padding: "4px 10px",
            color: user.isActive ? "#f87171" : "#34d399",
            borderColor: user.isActive ? "#f8717130" : "#34d39930",
          }}
          disabled={saving === "active"}
          onClick={async () => {
            setSaving("active");
            try { await toggleActive({ profileId: user._id, isActive: !user.isActive }); }
            catch {}
            finally { setSaving(null); }
          }}
        >
          {user.isActive ? "Deactivate" : "Activate"}
        </button>
      </div>
      {showEdit && <EditUserModal user={user} onClose={() => setShowEdit(false)} />}
    </>
  );
}

function EditUserModal({
  user,
  onClose,
}: {
  user: { _id: Id<"profiles">; firstName: string; lastName: string; phone?: string };
  onClose: () => void;
}) {
  const updateUserProfile = useMutation(api.profiles.updateUserProfile);
  const [firstName, setFirstName] = useState(user.firstName);
  const [lastName, setLastName] = useState(user.lastName);
  const [phone, setPhone] = useState(user.phone ?? "");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("saving");
    try {
      await updateUserProfile({ profileId: user._id, firstName, lastName, phone: phone || undefined });
      setStatus("saved");
      setTimeout(() => { setStatus("idle"); onClose(); }, 800);
    } catch (err: any) {
      setErrorMsg(err?.data?.message ?? err?.message ?? "Failed to save.");
      setStatus("error");
    }
  }

  return (
    <div className="invite-overlay" onClick={onClose}>
      <div className="invite-box" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-title">Edit user</h2>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", minWidth: 0 }}>
            <div className="form-group" style={{ minWidth: 0 }}>
              <label>First name</label>
              <input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="First name"
                style={{ width: "100%", boxSizing: "border-box" }} />
            </div>
            <div className="form-group" style={{ minWidth: 0 }}>
              <label>Last name</label>
              <input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Last name"
                style={{ width: "100%", boxSizing: "border-box" }} />
            </div>
          </div>
          <div className="form-group">
            <label>Phone <span style={{ color: "var(--text-3)", fontWeight: 400 }}>(optional)</span></label>
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 (555) 000-0000" />
          </div>
          {status === "error" && <p className="form-error">{errorMsg}</p>}
          <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
            <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={status === "saving" || status === "saved"}>
              {status === "saving" ? "Saving…" : status === "saved" ? "Saved!" : "Save changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function PendingInvitations({ orgId }: { orgId: Id<"organizations"> }) {
  const invitations = useQuery(api.invitations.listInvitations, { orgId });
  const revoke = useMutation(api.invitations.revokeInvitation);

  if (!invitations?.length) return null;

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <h2 className="users-section-title">Pending invitations</h2>
      <div className="users-table-wrap">
        <table className="users-table">
          <thead>
            <tr>
              <th>Email</th>
              <th>Role</th>
              <th>Expires</th>
              <th style={{ textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {invitations.map((inv) => (
              <tr key={inv._id}>
                <td style={{ fontSize: "14px", color: "var(--text)" }}>{inv.email}</td>
                <td><RoleBadge role={inv.role} /></td>
                <td style={{ fontSize: "13px", color: "var(--text-3)" }}>
                  {new Date(inv.expiresAt).toLocaleDateString()}
                </td>
                <td style={{ textAlign: "right" }}>
                  <button className="btn btn-ghost btn-sm"
                    style={{ fontSize: "12px", padding: "4px 10px", color: "#f87171", borderColor: "#f8717130" }}
                    onClick={() => revoke({ invitationId: inv._id })}>
                    Revoke
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function UsersPage() {
  const me = useQuery(api.users.currentUser);
  const orgId = me?.profile?.orgId as Id<"organizations"> | undefined;
  const users = useQuery(api.profiles.getOrgUsers, orgId ? { orgId } : "skip");
  const role = me?.profile?.role as Role | undefined;
  const [showInvite, setShowInvite] = useState(false);

  if (me === undefined) return null;
  if (!orgId) return <p style={{ color: "var(--text-2)" }}>No organization assigned to your account.</p>;

  return (
    <div className="users-page">
      <div className="users-header">
        <div>
          <h1 className="users-title">Users</h1>
          <p className="users-subtitle">{users ? `${users.length} member${users.length !== 1 ? "s" : ""}` : "Loading…"}</p>
        </div>
        <PermissionGate action="invite_user">
          <button className="btn btn-primary btn-sm" onClick={() => setShowInvite(true)}>
            + Invite user
          </button>
        </PermissionGate>
      </div>

      <div className="users-table-wrap">
        <table className="users-table">
          <thead>
            <tr>
              <th>Member</th>
              <th>Role</th>
              <th>Status</th>
              {can(role, "change_role") && <th style={{ textAlign: "right" }}>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {users === undefined && (
              <tr><td colSpan={4} style={{ color: "var(--text-3)", textAlign: "center", padding: "32px" }}>Loading…</td></tr>
            )}
            {users?.map((u) => {
              const isMe = me?.profile?._id === u._id;
              return (
                <tr key={u._id}>
                  <td>
                    <div className="user-cell">
                      <div className="user-avatar">
                        {u.firstName ? `${u.firstName[0]}${u.lastName?.[0] ?? ""}`.toUpperCase() : u.email[0].toUpperCase()}
                      </div>
                      <div>
                        <div className="user-name">
                          {u.firstName ? `${u.firstName} ${u.lastName}`.trim() : <span style={{ color: "var(--text-3)" }}>No name set</span>}
                        </div>
                        <div className="user-email">{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td><RoleBadge role={u.role} /></td>
                  <td><StatusDot active={u.isActive} /></td>
                  {can(role, "change_role") && (
                    <td style={{ textAlign: "right" }}>
                      <UserActions user={u} callerRole={role} isMe={isMe} />
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <PermissionGate action="invite_user">
        <PendingInvitations orgId={orgId} />
      </PermissionGate>

      {showInvite && <InviteModal orgId={orgId} onClose={() => setShowInvite(false)} />}

      <style>{`
        .users-page { display: flex; flex-direction: column; gap: 28px; max-width: 860px; }
        .users-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
        .users-title { font-size: 22px; font-weight: 600; letter-spacing: -0.02em; margin: 0 0 4px; }
        .users-subtitle { font-size: 14px; color: var(--text-2); margin: 0; }
        .users-section-title { font-size: 13px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--text-3); margin: 0; }
        .users-table-wrap { border: 1px solid var(--border); border-radius: 10px; overflow: hidden; }
        .users-table { width: 100%; border-collapse: collapse; }
        .users-table th { text-align: left; font-size: 12px; font-weight: 600; letter-spacing: 0.06em;
          text-transform: uppercase; color: var(--text-3); padding: 12px 16px;
          border-bottom: 1px solid var(--border); background: var(--surface-2); }
        .users-table td { padding: 14px 16px; border-bottom: 1px solid var(--border); vertical-align: middle; }
        .users-table tr:last-child td { border-bottom: none; }
        .users-table tr:hover td { background: var(--surface-2); }
        .user-cell { display: flex; align-items: center; gap: 12px; }
        .user-avatar { width: 34px; height: 34px; border-radius: 50%; background: var(--accent);
          color: #fff; font-size: 12px; font-weight: 600; display: grid; place-items: center; flex-shrink: 0; }
        .user-name { font-size: 14px; font-weight: 500; color: var(--text); }
        .user-email { font-size: 13px; color: var(--text-3); margin-top: 1px; }
        .invite-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: grid; place-items: center; z-index: 100; }
        .invite-box { background: var(--bg-3); border: 1px solid var(--border-strong); border-radius: 12px;
          padding: 28px 32px; width: 100%; max-width: 420px; }
        .modal-title { font-size: 18px; font-weight: 600; margin: 0 0 20px; }
        .form-group { display: flex; flex-direction: column; gap: 6px; }
        .form-group label { font-size: 13px; font-weight: 500; color: var(--text-2); }
        .form-group input, .form-group select { background: var(--surface-2); border: 1px solid var(--border);
          border-radius: var(--r); padding: 9px 12px; color: var(--text); font-size: 14px;
          font-family: inherit; outline: none; transition: border-color 150ms ease; }
        .form-group input:focus, .form-group select:focus { border-color: var(--accent); }
        .form-group select option { background: var(--bg-2); }
        .form-error { font-size: 13px; color: #f87171; margin: 0; padding: 8px 12px;
          background: rgba(248,113,113,0.08); border: 1px solid rgba(248,113,113,0.2); border-radius: var(--r); }
        .action-select { background: var(--surface-2); border: 1px solid var(--border); border-radius: var(--r);
          padding: 4px 8px; color: var(--text); font-size: 12px; font-family: inherit; cursor: pointer; }
        .action-select:disabled { opacity: 0.5; cursor: not-allowed; }
      `}</style>
    </div>
  );
}
