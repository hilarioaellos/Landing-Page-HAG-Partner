"use client";

import { useI18n, scrollToId } from "@/lib/i18n";
import HeroPattern from "@/components/HeroPattern";
import { IconArrow } from "@/components/icons";

export default function Hero() {
  const { t } = useI18n();
  return (
    <section className="hero" id="top">
      <HeroPattern />
      <div className="container hero-inner">
        <div className="eyebrow">
          <span className="eyebrow-dot" />
          {t.hero.eyebrow}
        </div>
        <h1 className="hero-title">{t.hero.title}</h1>
        <p className="hero-sub">{t.hero.subtitle}</p>
        <div className="hero-ctas">
          <button className="btn btn-primary" onClick={() => scrollToId("channels")}>
            {t.hero.ctaPrimary}
            <IconArrow size={18} />
          </button>
          <button className="btn btn-ghost" onClick={() => scrollToId("contact")}>
            {t.hero.ctaSecondary}
          </button>
        </div>
        <div className="hero-meta">
          {t.hero.meta.map((m, i) => (
            <div className="hero-meta-item" key={i}>
              <span className="hero-meta-k">{m.k}</span>
              <span className="hero-meta-v">{m.v}</span>
            </div>
          ))}
        </div>
      </div>
      <button className="hero-scroll" onClick={() => scrollToId("about")} aria-label={t.hero.scroll}>
        <span>{t.hero.scroll}</span>
        <span className="hero-scroll-line" />
      </button>
    </section>
  );
}
