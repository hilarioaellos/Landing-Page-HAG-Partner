"use client";

import { useI18n } from "@/lib/i18n";
import { Eyebrow } from "@/components/Eyebrow";
import {
  IconPin,
  IconBilingual,
  IconPersonal,
  IconReach,
  IconNetwork,
  IconGrowth,
  IconIntegrated,
} from "@/components/icons";

const whyIconMap: Record<string, (p: { size?: number }) => JSX.Element> = {
  pin: IconPin,
  bilingual: IconBilingual,
  personal: IconPersonal,
  reach: IconReach,
  network: IconNetwork,
  growth: IconGrowth,
};

export default function WhyHag() {
  const { t } = useI18n();
  return (
    <section className="section section-why" id="why" data-screen-label="Why HAG">
      <div className="container">
        <div className="section-head">
          <Eyebrow>{t.why.eyebrow}</Eyebrow>
          <h2 className="section-title">{t.why.title}</h2>
        </div>
        <div className="why-grid">
          {t.why.points.map((p, i) => {
            const Ico = whyIconMap[p.icon] || IconIntegrated;
            return (
              <div className="why-cell" key={i}>
                <div className="why-icon">
                  <Ico size={26} />
                </div>
                <div className="why-num">{String(i + 1).padStart(2, "0")}</div>
                <h3 className="why-name">{p.name}</h3>
                <p className="why-desc">{p.desc}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
