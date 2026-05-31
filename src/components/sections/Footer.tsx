"use client";

import Image from "next/image";
import { useI18n, scrollToId } from "@/lib/i18n";
import { useModal } from "@/lib/modal";
import { IconArrow } from "@/components/icons";

const companyTargets = ["about", "why", "how"];

export default function Footer() {
  const { t } = useI18n();
  const { open } = useModal();

  const openDev = () => open({ title: t.modal.devTitle, body: t.modal.devBody });

  const handleLink = (groupIndex: number, j: number) => {
    if (groupIndex === 0) return scrollToId("channels");
    if (groupIndex === 1) return scrollToId(companyTargets[j] || "about");
    return openDev();
  };

  return (
    <footer className="footer" data-screen-label="Footer">
      <div className="container footer-inner">
        <div className="footer-brand">
          <span className="footer-logo-plate">
            <Image
              src="/images/logo-hag-trim.png"
              alt="HAG Partner LLC"
              width={822}
              height={559}
              className="footer-logo"
            />
          </span>
          <p className="footer-tag">{t.footer.tagline}</p>
        </div>
        <div className="footer-grid">
          {t.footer.groups.map((g, i) => (
            <div className="footer-col" key={i}>
              <div className="footer-col-h">{g.name}</div>
              <ul>
                {g.links.map((l, j) => (
                  <li key={j}>
                    <a
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        handleLink(i, j);
                      }}
                    >
                      {l}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
      <div className="footer-base">
        <div className="container footer-base-inner">
          <span>{t.footer.rights}</span>
          <a
            className="footer-private"
            href="#contact"
            onClick={(e) => {
              e.preventDefault();
              scrollToId("contact");
            }}
          >
            {t.nav.cta} <IconArrow size={14} />
          </a>
        </div>
      </div>
    </footer>
  );
}
