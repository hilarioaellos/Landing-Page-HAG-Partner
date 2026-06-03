"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import {
  IconDashboard, IconUsers, IconUser, IconWallet,
  IconLedger, IconTruck, IconFolder, IconChat, IconContacts,
} from "@/components/icons";

const ACTIVE_MODULES = [
  { key: "dashboard", label: "Dashboard", href: "/private",        icon: IconDashboard },
  { key: "users",     label: "Users",      href: "/private/users",  icon: IconUsers },
  { key: "profile",   label: "My Profile", href: "/private/profile",icon: IconUser },
];

const COMING_SOON = [
  { key: "finance",    label: "Finance",    icon: IconWallet },
  { key: "accounting", label: "Accounting", icon: IconLedger },
  { key: "suppliers",  label: "Suppliers",  icon: IconTruck },
  { key: "documents",  label: "Documents",  icon: IconFolder },
  { key: "messaging",  label: "Messaging",  icon: IconChat },
  { key: "crm",        label: "CRM",        icon: IconContacts },
];

export default function Sidebar() {
  const pathname = usePathname();
  const me = useQuery(api.users.currentUser);
  const role = me?.profile?.role;

  const visibleActive = ACTIVE_MODULES.filter((m) => {
    if (m.key === "users") return ["super_admin", "admin", "manager"].includes(role ?? "");
    return true;
  });

  return (
    <aside className="portal-sidebar">
      <div className="sidebar-logo">
        <Link href="/">
          <Image
            src="/images/logo-hag-trim.png"
            alt="HAG Partner"
            width={822}
            height={559}
            style={{ height: "28px", width: "auto" }}
          />
        </Link>
      </div>

      <nav className="sidebar-nav">
        <span className="sidebar-section-label">Menu</span>
        {visibleActive.map(({ key, label, href, icon: Icon }) => {
          const active = pathname === href || (href !== "/private" && pathname.startsWith(href));
          return (
            <Link key={key} href={href} className={`sidebar-item${active ? " sidebar-item--active" : ""}`}>
              <Icon size={18} />
              {label}
            </Link>
          );
        })}

        <span className="sidebar-section-label" style={{ marginTop: "20px" }}>Coming soon</span>
        {COMING_SOON.map(({ key, label, icon: Icon }) => (
          <div key={key} className="sidebar-item sidebar-item--locked">
            <Icon size={18} />
            {label}
            <span className="sidebar-badge">Soon</span>
          </div>
        ))}
      </nav>

      <style>{`
        .portal-sidebar {
          width: 220px;
          min-height: 100vh;
          background: var(--bg-2);
          border-right: 1px solid var(--border);
          display: flex;
          flex-direction: column;
          padding: 20px 0;
          flex-shrink: 0;
        }
        .sidebar-logo {
          padding: 0 16px 20px;
          border-bottom: 1px solid var(--border);
          margin-bottom: 16px;
        }
        .sidebar-nav {
          display: flex;
          flex-direction: column;
          gap: 2px;
          padding: 0 8px;
          flex: 1;
        }
        .sidebar-section-label {
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--text-3);
          padding: 0 8px;
          margin-bottom: 4px;
        }
        .sidebar-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 10px;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 500;
          color: var(--text-2);
          text-decoration: none;
          transition: background 140ms ease, color 140ms ease;
        }
        .sidebar-item:hover { background: var(--surface); color: var(--text); }
        .sidebar-item--active { background: var(--accent-soft); color: var(--accent); }
        .sidebar-item--locked {
          opacity: 0.45;
          cursor: default;
          pointer-events: none;
        }
        .sidebar-badge {
          margin-left: auto;
          font-size: 10px;
          font-weight: 600;
          padding: 2px 6px;
          border-radius: 4px;
          background: var(--surface);
          color: var(--text-3);
          letter-spacing: 0.04em;
        }
      `}</style>
    </aside>
  );
}
