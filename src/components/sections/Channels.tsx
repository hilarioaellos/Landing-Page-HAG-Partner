"use client";

import { useI18n, scrollToId } from "@/lib/i18n";
import { Eyebrow } from "@/components/Eyebrow";
import { IconExport, IconLocal, IconEcom, IconArrow } from "@/components/icons";

const channelIcons = [IconExport, IconLocal, IconEcom];

export default function Channels() {
  const { t } = useI18n();
  return (
    <section className="section section-lines" id="channels" data-screen-label="Channels">
      <div className="container">
        <div className="section-head">
          <Eyebrow>{t.channels.eyebrow}</Eyebrow>
          <h2 className="section-title">{t.channels.title}</h2>
          <p className="lines-intro">{t.channels.intro}</p>
        </div>
        <div className="cards">
          {t.channels.cards.map((c, i) => {
            const Ico = channelIcons[i];
            return (
              <article key={i} className="card line-card" data-screen-label={`Channel ${c.tag} ${c.name}`}>
                <div className="line-head">
                  <div className="line-icon">
                    <Ico size={28} />
                  </div>
                  <span className="line-tag">{c.tag}</span>
                </div>
                <div className="card-title-row">
                  <h3 className="card-title">{c.name}</h3>
                  {c.badge && <span className="card-badge">{c.badge}</span>}
                </div>
                <p className="card-body">{c.desc}</p>
                <ul className="card-bullets">
                  {c.bullets.map((b, j) => (
                    <li key={j}>
                      <span className="bullet-dot" />
                      {b}
                    </li>
                  ))}
                </ul>
                <a
                  className="card-link"
                  href="#contact"
                  onClick={(e) => {
                    e.preventDefault();
                    scrollToId("contact");
                  }}
                >
                  {c.cta} <IconArrow size={16} />
                </a>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
