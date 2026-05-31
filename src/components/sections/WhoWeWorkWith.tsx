"use client";

import { useI18n } from "@/lib/i18n";
import { Eyebrow } from "@/components/Eyebrow";
import { IconStore, IconBoxes } from "@/components/icons";

const workIconMap: Record<string, (p: { size?: number }) => JSX.Element> = {
  store: IconStore,
  boxes: IconBoxes,
};

export default function WhoWeWorkWith() {
  const { t } = useI18n();
  return (
    <section className="section section-work" id="work" data-screen-label="Who We Work With">
      <div className="container">
        <div className="section-head">
          <Eyebrow>{t.work.eyebrow}</Eyebrow>
          <h2 className="section-title">{t.work.title}</h2>
        </div>
        <div className="work-grid">
          {t.work.cards.map((c, i) => {
            const Ico = workIconMap[c.icon] || IconStore;
            return (
              <article className="work-card" key={i}>
                <div className="work-icon">
                  <Ico size={28} />
                </div>
                <h3>{c.name}</h3>
                <p>{c.desc}</p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
