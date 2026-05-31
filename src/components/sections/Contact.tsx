"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { Eyebrow } from "@/components/Eyebrow";
import { IconArrow, IconMail, IconPin } from "@/components/icons";

type Errors = { name?: string; email?: string; message?: string };
type Status = "idle" | "sending" | "sent";

export default function Contact() {
  const { t } = useI18n();
  const [state, setState] = useState({ name: "", email: "", message: "" });
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState<Status>("idle");

  const setField =
    (k: keyof typeof state) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setState((s) => ({ ...s, [k]: e.target.value }));
      setErrors((er) => ({ ...er, [k]: undefined }));
    };

  const validate = () => {
    const er: Errors = {};
    if (!state.name.trim()) er.name = t.contact.labels.errName;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(state.email)) er.email = t.contact.labels.errEmail;
    if (state.message.trim().length < 8) er.message = t.contact.labels.errMessage;
    setErrors(er);
    return Object.keys(er).length === 0;
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setStatus("sending");
    // No backend yet — simulate a send. Wire to an API route / CRM in Stage 2.
    setTimeout(() => {
      setStatus("sent");
      setState({ name: "", email: "", message: "" });
    }, 900);
  };

  return (
    <section className="section section-contact" id="contact" data-screen-label="Contact">
      <div className="container contact-inner">
        <div className="contact-copy">
          <Eyebrow>{t.contact.eyebrow}</Eyebrow>
          <h2 className="section-title">{t.contact.title}</h2>
          <p className="section-body">{t.contact.body}</p>

          <ul className="contact-meta">
            <li>
              <span className="contact-meta-label">{t.contact.company}</span>
            </li>
            <li>
              <IconPin size={18} />
              <span>{t.contact.location}</span>
            </li>
            <li>
              <IconMail size={18} />
              <a href={`mailto:${t.contact.email}`}>{t.contact.email}</a>
            </li>
          </ul>
        </div>

        <form className="contact-form" onSubmit={onSubmit} noValidate>
          <div className={`field${errors.name ? " field-error" : ""}`}>
            <label htmlFor="cf-name">{t.contact.labels.name}</label>
            <input id="cf-name" type="text" value={state.name} onChange={setField("name")} autoComplete="name" />
            {errors.name && <span className="field-msg">{errors.name}</span>}
          </div>
          <div className={`field${errors.email ? " field-error" : ""}`}>
            <label htmlFor="cf-email">{t.contact.labels.email}</label>
            <input id="cf-email" type="email" value={state.email} onChange={setField("email")} autoComplete="email" />
            {errors.email && <span className="field-msg">{errors.email}</span>}
          </div>
          <div className={`field${errors.message ? " field-error" : ""}`}>
            <label htmlFor="cf-message">{t.contact.labels.message}</label>
            <textarea id="cf-message" rows={4} value={state.message} onChange={setField("message")} />
            {errors.message && <span className="field-msg">{errors.message}</span>}
          </div>

          <div className="form-foot">
            <button type="submit" className="btn btn-primary" disabled={status === "sending"}>
              {status === "sending" ? t.contact.labels.sending : t.contact.labels.send}
              {status !== "sending" && <IconArrow size={18} />}
            </button>
            {status === "sent" && <span className="form-success">{t.contact.labels.sent}</span>}
          </div>
        </form>
      </div>
    </section>
  );
}
