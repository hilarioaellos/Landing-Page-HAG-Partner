"use client";

import { useI18n } from "@/lib/i18n";
import { Eyebrow } from "@/components/Eyebrow";

export default function About() {
  const { t } = useI18n();
  return (
    <section className="section section-about" id="about" data-screen-label="Who We Are">
      <div className="container about-inner">
        <div className="about-copy">
          <Eyebrow>{t.about.eyebrow}</Eyebrow>
          <h2 className="section-title">{t.about.title}</h2>
          <p className="section-body">{t.about.body}</p>
        </div>
        <div className="stats">
          {t.about.stats.map((s, i) => (
            <div className="stat" key={i}>
              <div className="stat-value">{s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
