"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "../../../convex/_generated/api";
import { IconLogout } from "@/components/icons";

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  manager: "Manager",
  partner: "Partner",
  viewer: "Viewer",
};

export default function Header() {
  const { signOut } = useAuthActions();
  const router = useRouter();
  const me = useQuery(api.users.currentUser);

  const profile = me?.profile;
  const firstName = profile?.firstName || "";
  const lastName = profile?.lastName || "";
  const initials = firstName && lastName
    ? `${firstName[0]}${lastName[0]}`.toUpperCase()
    : (me?.email?.[0] ?? "?").toUpperCase();
  const displayName = firstName ? `${firstName} ${lastName}`.trim() : (me?.email ?? "");
  const role = profile?.role ? ROLE_LABELS[profile.role] : "";

  async function handleLogout() {
    await signOut();
    router.push("/sign-in");
  }

  return (
    <header className="portal-header">
      <div className="header-user">
        <div className="header-avatar">{initials}</div>
        <div className="header-info">
          <span className="header-name">{displayName}</span>
          {role && <span className="header-role">{role}</span>}
        </div>
      </div>

      <button className="header-logout" onClick={handleLogout} title="Sign out">
        <IconLogout size={18} />
        <span>Sign out</span>
      </button>

      <style>{`
        .portal-header {
          height: 56px;
          border-bottom: 1px solid var(--border);
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 24px;
          background: var(--bg);
          flex-shrink: 0;
        }
        .header-user { display: flex; align-items: center; gap: 12px; }
        .header-avatar {
          width: 34px;
          height: 34px;
          border-radius: 50%;
          background: var(--accent);
          color: #fff;
          font-size: 13px;
          font-weight: 600;
          display: grid;
          place-items: center;
          flex-shrink: 0;
        }
        .header-info { display: flex; flex-direction: column; gap: 1px; }
        .header-name { font-size: 14px; font-weight: 500; color: var(--text); line-height: 1.2; }
        .header-role { font-size: 12px; color: var(--text-3); }
        .header-logout {
          display: flex;
          align-items: center;
          gap: 6px;
          background: none;
          border: 1px solid var(--border);
          border-radius: 6px;
          padding: 6px 12px;
          color: var(--text-2);
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: border-color 140ms ease, color 140ms ease;
        }
        .header-logout:hover { border-color: var(--border-strong); color: var(--text); }
      `}</style>
    </header>
  );
}
