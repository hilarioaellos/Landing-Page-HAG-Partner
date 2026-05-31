"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import Image from "next/image";
import { useI18n } from "@/lib/i18n";

type ModalData = { title: string; body: string };

const ModalContext = createContext<{ open: (d: ModalData) => void }>({ open: () => {} });

export function useModal() {
  return useContext(ModalContext);
}

export function ModalProvider({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const [data, setData] = useState<ModalData | null>(null);
  const open = (d: ModalData) => setData(d);
  const close = () => setData(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    if (data) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [data]);

  return (
    <ModalContext.Provider value={{ open }}>
      {children}
      <div className={`modal-overlay${data ? " open" : ""}`} onClick={close} aria-hidden={!data}>
        {data && (
          <div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <span className="modal-logo">
              <Image src="/images/logo-hag-trim.png" alt="HAG Partner LLC" width={822} height={559} />
            </span>
            <div className="modal-badge">
              <span className="eyebrow-dot" />
              {t.modal.badge}
            </div>
            <h3 className="modal-title">{data.title}</h3>
            <p className="modal-body">{data.body}</p>
            <button className="btn btn-primary" onClick={close}>
              {t.modal.close}
            </button>
          </div>
        )}
      </div>
    </ModalContext.Provider>
  );
}
