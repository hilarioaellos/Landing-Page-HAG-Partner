import { internalAction } from "../_generated/server";
import { v } from "convex/values";

export const sendWelcomeEmail = internalAction({
  args: {
    email: v.string(),
    firstName: v.string(),
    orgName: v.string(),
  },
  handler: async (_ctx, { email, firstName, orgName }) => {
    const siteUrl = process.env.SITE_URL ?? "";
    const portalUrl = `${siteUrl}/private`;
    const greeting = firstName ? `Hola ${firstName}` : "Hola";

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "HAG Partner <noreply@hagpartner.com>",
        to: [email],
        subject: "Bienvenido al Portal HAG Partners",
        html: `
          <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px">
            <img src="https://hagpartner.com/images/logo-hag-trim.png" alt="HAG Partner" height="36" style="margin-bottom:24px" />
            <h2 style="font-size:22px;font-weight:600;margin:0 0 12px">${greeting}, bienvenido a HAG Partners</h2>
            <p style="color:#64748b;margin:0 0 8px">
              Tu cuenta ha sido activada en la organización <strong>${orgName}</strong>.
            </p>
            <p style="color:#64748b;margin:0 0 24px">
              Ya puedes acceder al portal para gestionar tu cuenta y los módulos disponibles.
            </p>
            <a href="${portalUrl}" style="display:inline-block;background:#3b82f6;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:500">
              Ir al portal
            </a>
            <p style="color:#94a3b8;font-size:13px;margin-top:32px">
              Si tienes alguna duda, contacta a tu administrador de organización.
            </p>
          </div>
        `,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Resend error ${res.status}: ${body}`);
    }
  },
});
