"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useI18n, scrollToId } from "@/lib/i18n";
import {
  IconExport,
  IconIntegrated,
  IconReliability,
  IconGrowth,
  IconMail,
} from "@/components/icons";

const NAV_ITEMS = [
  { id: "about", key: "about" },
  { id: "channels", key: "channels" },
  { id: "why", key: "why" },
  { id: "how", key: "how" },
] as const;

export default function Navbar() {
  const { t, lang, setLang } = useI18n();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={`nav nav-white${scrolled ? " nav-scrolled" : ""}`}>
      <div className="nav-inner">
        <a
          className="nav-logo"
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            scrollToId("top");
          }}
        >
          <Image
            src="/images/logo-hag-trim.png"
            alt="HAG Partner LLC"
            width={822}
            height={559}
            className="nav-logo-bare"
            priority
          />
        </a>

        <nav className="nav-links" aria-label="Primary">
          {NAV_ITEMS.map((it) => (
            <a
              key={it.id}
              href={`#${it.id}`}
              onClick={(e) => {
                e.preventDefault();
                scrollToId(it.id);
              }}
            >
              {t.nav[it.key]}
            </a>
          ))}
        </nav>

        <div className="nav-right">
          <div className="lang" role="group" aria-label="Language">
            <button
              className={`lang-btn${lang === "en" ? " lang-active" : ""}`}
              onClick={() => setLang("en")}
              aria-pressed={lang === "en"}
            >
              EN
            </button>
            <span className="lang-sep">/</span>
            <button
              className={`lang-btn${lang === "es" ? " lang-active" : ""}`}
              onClick={() => setLang("es")}
              aria-pressed={lang === "es"}
            >
              ES
            </button>
          </div>
          <Link href="/sign-in" className="btn btn-primary btn-sm">
            {t.footer.private}
          </Link>
        </div>
      </div>

      <MobileTabbar />
    </header>
  );
}

function MobileTabbar() {
  const { t } = useI18n();
  const tabs = [
    { id: "about", label: t.nav.about, icon: <IconIntegrated size={20} /> },
    { id: "channels", label: t.nav.channels, icon: <IconExport size={20} /> },
    { id: "why", label: t.nav.why, icon: <IconReliability size={20} /> },
    { id: "how", label: t.nav.how, icon: <IconGrowth size={20} /> },
  ];
  return (
    <nav className="mobile-tabbar" aria-label="Primary mobile">
      <div className="mobile-tabbar-inner">
        {tabs.map((tab) => (
          <button key={tab.id} className="tab-btn" onClick={() => scrollToId(tab.id)}>
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
        <button className="tab-btn tab-cta" onClick={() => scrollToId("contact")} aria-label={t.nav.contact}>
          <IconMail size={18} />
          <span>{t.nav.contact}</span>
        </button>
      </div>
    </nav>
  );
}
