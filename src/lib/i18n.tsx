"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import en from "@/messages/en.json";
import es from "@/messages/es.json";

export type Lang = "en" | "es";
export type Messages = typeof en;

const MESSAGES: Record<Lang, Messages> = { en, es: es as Messages };

type I18nContextValue = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: Messages;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Lang>("en");

  useEffect(() => {
    const saved = localStorage.getItem("hag.lang");
    if (saved === "en" || saved === "es") setLang(saved);
  }, []);

  useEffect(() => {
    localStorage.setItem("hag.lang", lang);
    document.documentElement.lang = lang;
  }, [lang]);

  return (
    <I18nContext.Provider value={{ lang, setLang, t: MESSAGES[lang] }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within <I18nProvider>");
  return ctx;
}

/**
 * Smooth-scroll to a section id. Section CSS sets `scroll-margin-top` so the
 * sticky navbar doesn't overlap. Falls back to an instant jump in environments
 * that block smooth scrolling.
 */
export function scrollToId(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  const startY = window.scrollY;
  el.scrollIntoView({ behavior: "smooth", block: "start" });
  window.setTimeout(() => {
    if (Math.abs(window.scrollY - startY) < 4) {
      el.scrollIntoView({ behavior: "auto", block: "start" });
    }
  }, 320);
}
