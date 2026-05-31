"use client";

import Link from "next/link";
import Image from "next/image";
import { useI18n } from "@/lib/i18n";

const COPY = {
  en: {
    badge: "Private Area",
    title: "Coming Soon — Partner Portal",
    body:
      "The authenticated partner dashboard and mini-apps are part of Stage 2. Sign-in, accounts, and tools will live here.",
    back: "Back to homepage",
  },
  es: {
    badge: "Área Privada",
    title: "Próximamente — Portal de Socios",
    body:
      "El panel autenticado de socios y las mini-apps forman parte de la Etapa 2. El inicio de sesión, las cuentas y las herramientas vivirán aquí.",
    back: "Volver al inicio",
  },
};

export default function PrivatePage() {
  const { lang } = useI18n();
  const c = COPY[lang];

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "32px",
        background:
          "radial-gradient(ellipse at 80% 0%, rgba(59,130,246,0.18), transparent 60%), radial-gradient(ellipse at 0% 100%, rgba(15,47,87,0.65), transparent 60%), var(--bg)",
      }}
    >
      <div style={{ textAlign: "center", maxWidth: "520px" }}>
        <span className="footer-logo-plate" style={{ marginBottom: "28px" }}>
          <Image
            src="/images/logo-hag-trim.png"
            alt="HAG Partner LLC"
            width={822}
            height={559}
            style={{ height: "44px", width: "auto", display: "block" }}
          />
        </span>
        <div
          className="eyebrow eyebrow-section"
          style={{ justifyContent: "center", marginBottom: "16px" }}
        >
          <span className="eyebrow-bar" />
          {c.badge}
        </div>
        <h1
          style={{
            fontSize: "clamp(28px, 4vw, 40px)",
            letterSpacing: "-0.02em",
            fontWeight: 600,
            margin: "0 0 16px",
          }}
        >
          {c.title}
        </h1>
        <p style={{ color: "var(--text-2)", fontSize: "17px", margin: "0 0 32px" }}>{c.body}</p>
        <Link className="btn btn-primary" href="/">
          {c.back}
        </Link>
      </div>
    </main>
  );
}
