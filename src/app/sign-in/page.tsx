"use client";

import { useState } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";

export default function SignInPage() {
  const { signIn } = useAuthActions();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signIn("password", { email, password, flow: "signIn" });
      router.push("/private");
    } catch {
      setError("Invalid email or password.");
    } finally {
      setLoading(false);
    }
  }

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

        <div className="auth-header">
          <div className="eyebrow eyebrow-section" style={{ justifyContent: "center", marginBottom: "12px" }}>
            <span className="eyebrow-bar" />
            Partner Portal
          </div>
          <h1 className="auth-title">Sign in to your account</h1>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
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
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
          </div>

          {error && <p className="auth-error">{error}</p>}

          <button type="submit" className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }} disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="auth-footer-text">
          Don&apos;t have an account?{" "}
          <Link href="/sign-up" style={{ color: "var(--accent)" }}>
            Request access
          </Link>
        </p>
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
        .auth-title {
          font-size: 22px;
          font-weight: 600;
          letter-spacing: -0.02em;
          margin: 0;
        }
        .auth-form { display: flex; flex-direction: column; gap: 16px; }
        .form-group { display: flex; flex-direction: column; gap: 6px; }
        .form-group label {
          font-size: 14px;
          font-weight: 500;
          color: var(--text-2);
        }
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
          background: rgba(248, 113, 113, 0.08);
          border: 1px solid rgba(248, 113, 113, 0.2);
          border-radius: var(--r);
        }
        .auth-footer-text {
          text-align: center;
          font-size: 14px;
          color: var(--text-2);
          margin: 0;
        }
      `}</style>
    </main>
  );
}
