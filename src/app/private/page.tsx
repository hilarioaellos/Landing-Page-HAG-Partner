"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { can, type Role } from "@/lib/permissions";
import {
  IconUsers, IconUser, IconWallet, IconLedger,
  IconTruck, IconFolder, IconChat, IconContacts, IconArrow,
} from "@/components/icons";

const ACTIVE_MODULES = [
  {
    key: "users",
    label: "Users",
    description: "Manage team members, roles and invitations.",
    href: "/private/users",
    icon: IconUsers,
    action: "view_users" as const,
  },
  {
    key: "profile",
    label: "My Profile",
    description: "Update your name, phone and preferences.",
    href: "/private/profile",
    icon: IconUser,
    action: "edit_profile" as const,
  },
];

const FINTRACK_URL = process.env.NEXT_PUBLIC_FINTRACK_URL;

const EXTERNAL_MODULES = FINTRACK_URL
  ? [{
      key: "fintrack",
      label: "FinTrack",
      description: "Personal finance dashboard — accounts, transactions and budgets.",
      href: FINTRACK_URL,
      icon: IconWallet,
    }]
  : [];

const COMING_SOON = [
  ...(FINTRACK_URL ? [] : [{ key: "finance", label: "Finance", description: "Personal accounts, transactions and budgets.", icon: IconWallet }]),
  { key: "accounting", label: "Accounting", description: "Chart of accounts, journal entries and invoices.", icon: IconLedger },
  { key: "suppliers",  label: "Suppliers",  description: "Vendor management and purchase orders.", icon: IconTruck },
  { key: "documents",  label: "Documents",  description: "Shared file storage and folder management.", icon: IconFolder },
  { key: "messaging",  label: "Messaging",  description: "Internal team conversations.", icon: IconChat },
  { key: "crm",        label: "CRM",        description: "Contacts, deals and activity tracking.", icon: IconContacts },
];

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  manager: "Manager",
  partner: "Partner",
  viewer: "Viewer",
};

export default function DashboardPage() {
  const me = useQuery(api.users.currentUser);
  const profile = me?.profile;
  const role = profile?.role as Role | undefined;
  const firstName = profile?.firstName || me?.email?.split("@")[0] || "Partner";
  const orgName = (profile as any)?.org?.name;

  const visibleModules = ACTIVE_MODULES.filter((m) => can(role, m.action));

  if (me === undefined) {
    return <div style={{ color: "var(--text-2)", padding: "40px 0" }}>Loading…</div>;
  }

  return (
    <div className="dash">
      {/* Welcome */}
      <div className="dash-welcome">
        <h1 className="dash-title">
          Welcome back, <span style={{ color: "var(--accent)" }}>{firstName}</span>
        </h1>
        <p className="dash-subtitle">
          {orgName ? (
            <>
              {orgName} ·{" "}
              <span style={{ color: "var(--text-3)" }}>{ROLE_LABELS[role ?? ""] ?? role}</span>
            </>
          ) : (
            <span style={{ color: "var(--text-3)" }}>
              Your account is pending organization assignment.
            </span>
          )}
        </p>
      </div>

      {/* Active modules */}
      {visibleModules.length > 0 && (
        <section className="dash-section">
          <h2 className="dash-section-title">Your modules</h2>
          <div className="dash-grid">
            {visibleModules.map(({ key, label, description, href, icon: Icon }) => (
              <Link key={key} href={href} className="dash-card dash-card--active">
                <div className="dash-card-icon">
                  <Icon size={22} />
                </div>
                <div className="dash-card-body">
                  <span className="dash-card-label">{label}</span>
                  <span className="dash-card-desc">{description}</span>
                </div>
                <IconArrow size={16} className="dash-card-arrow" />
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* External apps (FinTrack) */}
      {EXTERNAL_MODULES.length > 0 && (
        <section className="dash-section">
          <h2 className="dash-section-title">Apps</h2>
          <div className="dash-grid">
            {EXTERNAL_MODULES.map(({ key, label, description, href, icon: Icon }) => (
              <a
                key={key}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${label} — opens in new tab`}
                className="dash-card dash-card--active"
              >
                <div className="dash-card-icon">
                  <Icon size={22} />
                </div>
                <div className="dash-card-body">
                  <span className="dash-card-label">{label}</span>
                  <span className="dash-card-desc">{description}</span>
                </div>
                <IconArrow size={16} className="dash-card-arrow" />
              </a>
            ))}
          </div>
        </section>
      )}

      {/* Coming soon */}
      {COMING_SOON.length > 0 && (
      <section className="dash-section">
        <h2 className="dash-section-title">Coming soon</h2>
        <div className="dash-grid">
          {COMING_SOON.map(({ key, label, description, icon: Icon }) => (
            <div key={key} className="dash-card dash-card--locked">
              <div className="dash-card-icon">
                <Icon size={22} />
              </div>
              <div className="dash-card-body">
                <span className="dash-card-label">
                  {label}
                  <span className="dash-soon-badge">Soon</span>
                </span>
                <span className="dash-card-desc">{description}</span>
              </div>
            </div>
          ))}
        </div>
      </section>
      )}

      <style>{`
        .dash { display: flex; flex-direction: column; gap: 36px; max-width: 900px; }
        .dash-welcome { display: flex; flex-direction: column; gap: 6px; }
        .dash-title { font-size: clamp(22px, 3vw, 28px); font-weight: 600; letter-spacing: -0.02em; margin: 0; }
        .dash-subtitle { font-size: 15px; color: var(--text-2); margin: 0; }
        .dash-section { display: flex; flex-direction: column; gap: 14px; }
        .dash-section-title { font-size: 13px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--text-3); margin: 0; }
        .dash-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 12px; }
        .dash-card {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 16px;
          border-radius: 10px;
          border: 1px solid var(--border);
          background: var(--surface);
          text-decoration: none;
          transition: border-color 150ms ease, background 150ms ease;
        }
        .dash-card--active:hover { border-color: var(--accent); background: var(--accent-soft); }
        .dash-card--locked { opacity: 0.45; cursor: default; }
        .dash-card-icon {
          width: 40px; height: 40px; border-radius: 8px;
          background: var(--surface-2); border: 1px solid var(--border);
          display: grid; place-items: center; flex-shrink: 0;
          color: var(--text-2);
        }
        .dash-card--active:hover .dash-card-icon { color: var(--accent); border-color: var(--accent); }
        .dash-card-body { display: flex; flex-direction: column; gap: 3px; flex: 1; min-width: 0; }
        .dash-card-label { font-size: 14px; font-weight: 600; color: var(--text); display: flex; align-items: center; gap: 8px; }
        .dash-card-desc { font-size: 13px; color: var(--text-2); line-height: 1.4; }
        .dash-card-arrow { color: var(--text-3); flex-shrink: 0; opacity: 0; transition: opacity 150ms ease; }
        .dash-card--active:hover .dash-card-arrow { opacity: 1; }
        .dash-soon-badge {
          font-size: 10px; font-weight: 600; padding: 2px 6px; border-radius: 4px;
          background: var(--surface-2); color: var(--text-3); letter-spacing: 0.04em;
        }
      `}</style>
    </div>
  );
}
