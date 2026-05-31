"use client";

import { useI18n } from "@/lib/i18n";
import { Eyebrow } from "@/components/Eyebrow";

export default function HowWeWork() {
  const { t } = useI18n();
  return (
    <section className="section section-how" id="how" data-screen-label="How We Work">
      <div className="container">
        <div className="section-head">
          <Eyebrow>{t.how.eyebrow}</Eyebrow>
          <h2 className="section-title">{t.how.title}</h2>
        </div>
        <div className="how-grid">
          {t.how.steps.map((s, i) => (
            <div className="how-step" key={i}>
              <div className="how-n">{s.n}</div>
              <h3>{s.name}</h3>
              <p>{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
