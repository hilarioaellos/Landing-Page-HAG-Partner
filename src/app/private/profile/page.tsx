"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin", admin: "Admin",
  manager: "Manager", partner: "Partner", viewer: "Viewer",
};

export default function ProfilePage() {
  const me = useQuery(api.users.currentUser);
  const updateProfile = useMutation(api.profiles.updateProfile);

  const profile = me?.profile;
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName]   = useState("");
  const [phone, setPhone]         = useState("");
  const [status, setStatus]       = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [errorMsg, setErrorMsg]   = useState("");

  useEffect(() => {
    if (profile) {
      setFirstName(profile.firstName ?? "");
      setLastName(profile.lastName ?? "");
      setPhone(profile.phone ?? "");
    }
  }, [profile]);

  const initials = firstName && lastName
    ? `${firstName[0]}${lastName[0]}`.toUpperCase()
    : (me?.email?.[0] ?? "?").toUpperCase();

  const canEdit = profile?.role !== "viewer";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("saving");
    try {
      await updateProfile({ firstName, lastName, phone: phone || undefined });
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 2500);
    } catch (err: any) {
      setErrorMsg(err?.data?.message ?? err?.message ?? "Unknown error");
      setStatus("error");
    }
  }

  if (me === undefined) return <div style={{ color: "var(--text-2)" }}>Loading…</div>;

  return (
    <div className="profile-page">
      <div className="profile-header">
        <div className="profile-avatar-lg">{initials}</div>
        <div>
          <h1 className="profile-title">
            {firstName ? `${firstName} ${lastName}`.trim() : "Your Profile"}
          </h1>
          <p className="profile-email">{me?.email}</p>
        </div>
      </div>

      <div className="profile-grid">
        {/* Editable info */}
        <section className="profile-card">
          <h2 className="profile-card-title">Personal information</h2>
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div className="profile-row">
              <div className="form-group">
                <label>First name</label>
                <input value={firstName} onChange={(e) => setFirstName(e.target.value)}
                  placeholder="First name" disabled={!canEdit} />
              </div>
              <div className="form-group">
                <label>Last name</label>
                <input value={lastName} onChange={(e) => setLastName(e.target.value)}
                  placeholder="Last name" disabled={!canEdit} />
              </div>
            </div>
            <div className="form-group">
              <label>Phone</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 (555) 000-0000" type="tel" disabled={!canEdit} />
            </div>

            {canEdit && (
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <button type="submit" className="btn btn-primary btn-sm" disabled={status === "saving"}>
                  {status === "saving" ? "Saving…" : "Save changes"}
                </button>
                {status === "saved" && <span style={{ fontSize: "13px", color: "#34d399" }}>Saved!</span>}
                {status === "error" && <span style={{ fontSize: "13px", color: "#f87171" }}>{errorMsg || "Error saving. Try again."}</span>}
              </div>
            )}
          </form>
        </section>

        {/* Read-only account info */}
        <section className="profile-card">
          <h2 className="profile-card-title">Account details</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div className="profile-field">
              <span className="profile-field-label">Email</span>
              <span className="profile-field-value">{me?.email ?? "—"}</span>
            </div>
            <div className="profile-field">
              <span className="profile-field-label">Role</span>
              <span className="profile-field-value">
                {profile?.role ? ROLE_LABELS[profile.role] : "—"}
              </span>
            </div>
            <div className="profile-field">
              <span className="profile-field-label">Organization</span>
              <span className="profile-field-value">
                {(profile as any)?.org?.name ?? (profile?.orgId ? "Loading…" : "No organization")}
              </span>
            </div>
            <div className="profile-field">
              <span className="profile-field-label">Account status</span>
              <span style={{ fontSize: "14px", display: "flex", alignItems: "center", gap: "6px",
                color: profile?.isActive ? "#34d399" : "#f87171" }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", flexShrink: 0,
                  background: profile?.isActive ? "#34d399" : "#f87171" }} />
                {profile?.isActive ? "Active" : "Inactive"}
              </span>
            </div>
          </div>
        </section>
      </div>

      <style>{`
        .profile-page { display: flex; flex-direction: column; gap: 28px; max-width: 760px; }
        .profile-header { display: flex; align-items: center; gap: 18px; }
        .profile-avatar-lg { width: 60px; height: 60px; border-radius: 50%; background: var(--accent);
          color: #fff; font-size: 20px; font-weight: 600; display: grid; place-items: center; flex-shrink: 0; }
        .profile-title { font-size: 22px; font-weight: 600; letter-spacing: -0.02em; margin: 0 0 4px; }
        .profile-email { font-size: 14px; color: var(--text-2); margin: 0; }
        .profile-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        @media (max-width: 640px) { .profile-grid { grid-template-columns: 1fr; } }
        .profile-card { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 20px 22px;
          display: flex; flex-direction: column; gap: 16px; }
        .profile-card-title { font-size: 13px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--text-3); margin: 0; }
        .profile-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .form-group { display: flex; flex-direction: column; gap: 5px; }
        .form-group label { font-size: 13px; font-weight: 500; color: var(--text-2); }
        .form-group input { background: var(--surface-2); border: 1px solid var(--border); border-radius: var(--r);
          padding: 9px 12px; color: var(--text); font-size: 14px; font-family: inherit; outline: none;
          transition: border-color 150ms ease; }
        .form-group input:focus { border-color: var(--accent); }
        .form-group input:disabled { opacity: 0.5; cursor: not-allowed; }
        .profile-field { display: flex; flex-direction: column; gap: 3px; }
        .profile-field-label { font-size: 12px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-3); }
        .profile-field-value { font-size: 14px; color: var(--text); }
      `}</style>
    </div>
  );
}
