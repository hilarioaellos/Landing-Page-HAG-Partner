# HAG Partner LLC — Website (Stage 1, v2)

Corporate website for **HAG Partner LLC**, a Florida-based B2B company supporting
brands, manufacturers, suppliers and distributors across export, distribution and
digital commerce. Stage 1 covers the project foundation and the public landing page,
built so Stage 2 (authenticated partner portal + mini-apps) can be added without rework.

Built with **Next.js 14 (App Router) · TypeScript · Tailwind CSS** and a lightweight
**bilingual (EN/ES)** layer that switches instantly without a page reload.

Default look: **dark navy background + white navbar + white footer**.

---

## Quick start

Requirements: **Node.js 18.17+** (or 20+) and npm.

```bash
npm install      # install dependencies (needs internet the first time)
npm run dev      # start the dev server
```

Open **http://localhost:3000**.

```bash
npm run build    # production build
npm run start    # serve the production build
npm run lint     # lint
```

---

## What's included

Landing page (`/`), one-page scroll, in order:

1. **Navbar** — sticky white bar, logo, nav (Who We Are · Channels · Why HAG · How We Work),
   EN/ES toggle, and a **Partner login** button that opens an "in development" modal.
   On mobile, a fixed **white bottom tab bar** replaces the desktop links.
2. **Hero** — tagline + three channel chips.
3. **Who We Are** — company intro + 3 qualitative stats.
4. **Channels** — Export Solutions · Distribution Services · Digital Commerce.
5. **Why HAG** — 6 value props in a 3×2 grid.
6. **How We Work** — 5-step process (Discovery → Growth).
7. **Who We Work With** — Brands & Manufacturers / Suppliers & Distributors.
8. **Contact** — form with client-side validation.
9. **Footer** — white, working links (scroll to sections; Legal links open a "Coming soon"
   modal); a **Get in Touch** link scrolls to Contact.

- **Bilingual** — English (default) + Spanish, switched live via a React context.
- **`/private`** — placeholder **"Coming Soon — Partner Portal"** page (Stage 2 lives here).

---

## Project structure

```
hagpartner-web/
├─ public/images/logo-hag-trim.png
├─ src/
│  ├─ app/
│  │  ├─ globals.css            # design system: tokens + all component styles
│  │  ├─ layout.tsx             # Inter font, i18n + modal providers, theme attrs
│  │  ├─ page.tsx               # landing page (composes the sections)
│  │  └─ private/page.tsx       # Stage 2 placeholder
│  ├─ components/
│  │  ├─ Navbar.tsx             # sticky navbar + white mobile bottom tab bar
│  │  ├─ HeroPattern.tsx        # decorative SVG (logo motif)
│  │  ├─ Eyebrow.tsx            # small shared label
│  │  ├─ icons.tsx              # line-icon set
│  │  └─ sections/
│  │     ├─ Hero.tsx
│  │     ├─ About.tsx           # "Who We Are"
│  │     ├─ Channels.tsx
│  │     ├─ WhyHag.tsx
│  │     ├─ HowWeWork.tsx
│  │     ├─ WhoWeWorkWith.tsx
│  │     ├─ Contact.tsx
│  │     └─ Footer.tsx
│  ├─ lib/
│  │  ├─ i18n.tsx               # language context + useI18n() + scrollToId()
│  │  └─ modal.tsx              # modal context + provider ("in development" dialog)
│  └─ messages/
│     ├─ en.json                # English copy
│     └─ es.json                # Spanish copy
├─ tailwind.config.ts           # brand tokens (navy / accent) for Tailwind utilities
├─ next.config.mjs
├─ tsconfig.json                # "@/*" path alias → src/*
└─ package.json
```

---

## Editing content

All visible copy lives in **`src/messages/en.json`** and **`src/messages/es.json`**
(same shape — edit in parallel). Components read the active locale via `useI18n()`:

```tsx
const { t, lang, setLang } = useI18n();
// t.hero.title, t.channels.cards[0].name, t.why.points, t.modal.portalBody, ...
```

## Styling

The design system is CSS custom properties + component classes in **`src/app/globals.css`**
(ported from the approved prototype). Default is dark background + white navbar/footer,
set via `data-theme="dark"` / `data-nav="white"` on `<html>` in `layout.tsx`. A full
**light theme** also exists under `[data-theme="light"]`.

**Tailwind** is installed and configured; brand tokens are exposed as utilities
(`bg-navy`, `text-accent`, `max-w-site`, `font-sans`) for new UI.

## Navigation note

In-page navigation uses `scrollToId()` in `src/lib/i18n.tsx`, which calls
`scrollIntoView` with an instant fallback (some embedded preview sandboxes block
smooth scrolling). Sections set `scroll-margin-top` so the sticky navbar never overlaps.

---

## Notes & assumptions

- **Contact form** is client-side only (validation + success state). Wire it to an API
  route / email service / CRM when ready — see `src/components/sections/Contact.tsx`.
- **Partner login** currently opens an "in development" modal. Point it at the real
  auth flow in Stage 2.
- **Stats** use honest qualitative values (Florida / EN·ES / 3 channels).
- **Contact details** (`partners@hagpartner.com`, "Florida, United States") are
  placeholders — update with real data.

## Stage 2 (next)

- Authentication + partner accounts.
- `/private` dashboard shell + mini-apps.
- Real backend for the contact form and partner data.
