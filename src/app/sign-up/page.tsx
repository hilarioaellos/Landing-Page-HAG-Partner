"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuthActions } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import Image from "next/image";
import Link from "next/link";

// ── Bootstrap form — first super_admin, no invite token needed ─────────────────
function BootstrapForm() {
  const router = useRouter();
  const { signIn } = useAuthActions();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirm) { setError("Passwords do not match."); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    setLoading(true);
    try {
      await signIn("password", { email, password, flow: "signUp" });
      router.push("/private");
    } catch {
      setError("Could not create account. This email may already be registered.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="auth-header">
        <div className="eyebrow eyebrow-section" style={{ justifyContent: "center", marginBottom: "12px" }}>
          <span className="eyebrow-bar" />
          Initial Setup
        </div>
        <h1 className="auth-title">Create super admin</h1>
        <p style={{ color: "var(--text-2)", fontSize: "14px", margin: "8px 0 0" }}>
          No admin exists yet. This account will be the first <strong style={{ color: "var(--accent)" }}>Super Admin</strong>.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="auth-form">
        <div className="form-group">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@hagpartner.com"
            required
            autoComplete="email"
          />
        </div>

        <div className="form-group">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Min. 8 characters"
            required
            autoComplete="new-password"
          />
        </div>

        <div className="form-group">
          <label htmlFor="confirm">Confirm password</label>
          <input
            id="confirm"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="••••••••"
            required
            autoComplete="new-password"
          />
        </div>

        {error && <p className="auth-error">{error}</p>}

        <button
          type="submit"
          className="btn btn-primary"
          style={{ width: "100%", justifyContent: "center" }}
          disabled={loading}
        >
          {loading ? "Creating account…" : "Create super admin account"}
        </button>
      </form>

      <p className="auth-footer-text">
        Already have an account?{" "}
        <Link href="/sign-in" style={{ color: "var(--accent)" }}>Sign in</Link>
      </p>
    </>
  );
}

// ── Invite form — normal registration with invite token ────────────────────────
function InviteForm({ token }: { token: string }) {
  const router = useRouter();
  const { signIn } = useAuthActions();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const invitation = useQuery(api.invitations.verifyInvitation, { token });

  if (invitation === undefined) {
    return <div className="auth-status">Verifying invitation…</div>;
  }

  if (invitation === null) {
    return (
      <div className="auth-status auth-status--error">
        <p>This invitation is invalid or has expired.</p>
        <Link href="/sign-in" className="btn btn-primary" style={{ marginTop: "16px" }}>
          Go to sign in
        </Link>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirm) { setError("Passwords do not match."); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    setLoading(true);
    try {
      await signIn("password", { email: invitation!.email, password, flow: "signUp", inviteToken: token });
      router.push("/private");
    } catch {
      setError("Could not create account. This email may already be registered.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="auth-header">
        <div className="eyebrow eyebrow-section" style={{ justifyContent: "center", marginBottom: "12px" }}>
          <span className="eyebrow-bar" />
          Partner Portal
        </div>
        <h1 className="auth-title">Create your account</h1>
        <p style={{ color: "var(--text-2)", fontSize: "14px", margin: "8px 0 0" }}>
          Joining <strong style={{ color: "var(--text)" }}>{invitation.orgName}</strong> as{" "}
          <strong style={{ color: "var(--accent)" }}>{invitation.role}</strong>
        </p>
      </div>

      <form onSubmit={handleSubmit} className="auth-form">
        <div className="form-group">
          <label>Email</label>
          <input
            type="email"
            value={invitation.email}
            readOnly
            style={{ opacity: 0.6, cursor: "not-allowed" }}
          />
        </div>

        <div className="form-group">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Min. 8 characters"
            required
            autoComplete="new-password"
          />
        </div>

        <div className="form-group">
          <label htmlFor="confirm">Confirm password</label>
          <input
            id="confirm"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="••••••••"
            required
            autoComplete="new-password"
          />
        </div>

        {error && <p className="auth-error">{error}</p>}

        <button
          type="submit"
          className="btn btn-primary"
          style={{ width: "100%", justifyContent: "center" }}
          disabled={loading}
        >
          {loading ? "Creating account…" : "Create account"}
        </button>
      </form>

      <p className="auth-footer-text">
        Already have an account?{" "}
        <Link href="/sign-in" style={{ color: "var(--accent)" }}>Sign in</Link>
      </p>
    </>
  );
}

// ── Router — decides which form to show ───────────────────────────────────────
function SignUpRouter() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("invite") ?? "";
  const bootstrapAvailable = useQuery(api.bootstrap.isAvailable);

  useEffect(() => {
    if (!token && bootstrapAvailable === false) {
      router.replace("/sign-in?error=invite_required");
    }
  }, [token, bootstrapAvailable, router]);

  if (token) {
    return <InviteForm token={token} />;
  }

  if (bootstrapAvailable === undefined) {
    return <div className="auth-status">Loading…</div>;
  }

  if (!bootstrapAvailable) {
    return null;
  }

  return <BootstrapForm />;
}

// ── Page shell ────────────────────────────────────────────────────────────────
export default function SignUpPage() {
  return (
    <main className="auth-page">
      <div className="auth-card">
        <Link href="/" className="auth-logo">
          <Image
            src="/images/logo-hag-trim.png"
            alt="HAG Partner LLC"
            width={822}
            height={559}
            style={{ height: "36px", width: "auto" }}
          />
        </Link>

        <Suspense fallback={<div className="auth-status">Loading…</div>}>
          <SignUpRouter />
        </Suspense>
      </div>

      <style>{`
        .auth-page {
          min-height: 100vh;
          display: grid;
          place-items: center;
          padding: 32px;
          background:
            radial-gradient(ellipse at 80% 0%, rgba(59,130,246,0.18), transparent 60%),
            radial-gradient(ellipse at 0% 100%, rgba(15,47,87,0.65), transparent 60%),
            var(--bg);
        }
        .auth-card {
          width: 100%;
          max-width: 420px;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 40px 36px;
          display: flex;
          flex-direction: column;
          gap: 24px;
        }
        .auth-logo { display: flex; justify-content: center; }
        .auth-header { text-align: center; }
        .auth-title { font-size: 22px; font-weight: 600; letter-spacing: -0.02em; margin: 0; }
        .auth-status {
          text-align: center;
          color: var(--text-2);
          font-size: 15px;
          padding: 16px 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
        }
        .auth-status--error { color: #f87171; }
        .auth-form { display: flex; flex-direction: column; gap: 16px; }
        .form-group { display: flex; flex-direction: column; gap: 6px; }
        .form-group label { font-size: 14px; font-weight: 500; color: var(--text-2); }
        .form-group input {
          background: var(--surface-2);
          border: 1px solid var(--border);
          border-radius: var(--r);
          padding: 10px 14px;
          color: var(--text);
          font-size: 15px;
          font-family: inherit;
          outline: none;
          transition: border-color 160ms ease;
        }
        .form-group input:focus { border-color: var(--accent); }
        .form-group input::placeholder { color: var(--text-3); }
        .auth-error {
          font-size: 14px;
          color: #f87171;
          margin: 0;
          padding: 10px 14px;
          background: rgba(248,113,113,0.08);
          border: 1px solid rgba(248,113,113,0.2);
          border-radius: var(--r);
        }
        .auth-footer-text { text-align: center; font-size: 14px; color: var(--text-2); margin: 0; }
      `}</style>
    </main>
  );
}
