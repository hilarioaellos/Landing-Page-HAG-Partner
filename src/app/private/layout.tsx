"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import Sidebar from "@/components/portal/Sidebar";
import Header from "@/components/portal/Header";

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const me = useQuery(api.users.currentUser);

  if (me === undefined) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", color: "var(--text-2)" }}>
        Loading…
      </div>
    );
  }

  if (me?.profile && !me.profile.isActive) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: "32px" }}>
        <div style={{ textAlign: "center", maxWidth: "420px" }}>
          <div style={{
            width: 52, height: 52, borderRadius: "50%",
            background: "rgba(248,113,113,0.12)", border: "1px solid rgba(248,113,113,0.3)",
            display: "grid", placeItems: "center", margin: "0 auto 20px", fontSize: "22px",
          }}>⚠</div>
          <h1 style={{ fontSize: "20px", fontWeight: 600, margin: "0 0 10px" }}>Account pending</h1>
          <p style={{ color: "var(--text-2)", fontSize: "15px", lineHeight: 1.6, margin: "0 0 24px" }}>
            Your account has been created but is not yet active.
            Contact HAG Partner to request access.
          </p>
          <a
            href="mailto:contact@hagpartner.com"
            className="btn btn-primary"
            style={{ display: "inline-flex" }}
          >
            Contact support
          </a>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <Sidebar />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <Header />
        <main style={{ flex: 1, padding: "28px 32px", overflowY: "auto" }}>
          {children}
        </main>
      </div>
    </div>
  );
}
