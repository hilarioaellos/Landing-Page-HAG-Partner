import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { I18nProvider } from "@/lib/i18n";
import { ModalProvider } from "@/lib/modal";
import ConvexClientProvider from "@/components/ConvexClientProvider";
import { ConvexAuthNextjsServerProvider } from "@convex-dev/auth/nextjs/server";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://hagpartner.com"),
  title: "HAG Partner LLC — Connecting Brands with Strategic Markets",
  description:
    "HAG Partner LLC is a Florida-based B2B company helping brands, manufacturers, suppliers and distributors grow across export, distribution and digital commerce.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "HAG Partner LLC — Connecting Brands with Strategic Markets",
    description:
      "Florida-based commercial partner connecting brands with US and international markets through export, distribution, and digital commerce.",
    url: "https://hagpartner.com",
    siteName: "HAG Partner LLC",
    images: [{ url: "/images/logo-hag-trim.png", width: 822, height: 559, alt: "HAG Partner LLC" }],
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "HAG Partner LLC — Connecting Brands with Strategic Markets",
    description:
      "Florida-based commercial partner connecting brands with US and international markets through export, distribution, and digital commerce.",
    images: ["/images/logo-hag-trim.png"],
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://hagpartner.com/#organization",
      name: "HAG Partner LLC",
      legalName: "HAG Partner LLC",
      url: "https://hagpartner.com",
      logo: {
        "@type": "ImageObject",
        "@id": "https://hagpartner.com/#logo",
        url: "https://hagpartner.com/images/logo-hag-trim.png",
        contentUrl: "https://hagpartner.com/images/logo-hag-trim.png",
        caption: "HAG Partner LLC logo",
      },
      image: { "@id": "https://hagpartner.com/#logo" },
      description:
        "Florida-based B2B company helping brands, manufacturers, suppliers and distributors grow across export, distribution and digital commerce.",
      email: "[email protected]",
      telephone: "+1-305-342-4182",
      address: {
        "@type": "PostalAddress",
        addressLocality: "Delray Beach",
        addressRegion: "FL",
        addressCountry: "US",
      },
      foundingDate: "2025",
      knowsLanguage: [
        { "@type": "Language", name: "English", alternateName: "en" },
        { "@type": "Language", name: "Spanish", alternateName: "es" },
      ],
      hasOfferCatalog: {
        "@type": "OfferCatalog",
        "@id": "https://hagpartner.com/#offer-catalog",
        name: "HAG Partner Services",
        itemListElement: [
          { "@id": "https://hagpartner.com/#service-export" },
          { "@id": "https://hagpartner.com/#service-distribution" },
          { "@id": "https://hagpartner.com/#service-ecommerce" },
        ],
      },
    },
    {
      "@type": "WebSite",
      "@id": "https://hagpartner.com/#website",
      url: "https://hagpartner.com",
      name: "HAG Partner LLC",
      publisher: { "@id": "https://hagpartner.com/#organization" },
      inLanguage: ["en", "es"],
      copyrightYear: "2025",
      copyrightHolder: { "@id": "https://hagpartner.com/#organization" },
    },
    {
      "@type": "WebPage",
      "@id": "https://hagpartner.com/#webpage",
      url: "https://hagpartner.com",
      name: "HAG Partner LLC — Connecting Brands with Strategic Markets",
      isPartOf: { "@id": "https://hagpartner.com/#website" },
      about: { "@id": "https://hagpartner.com/#organization" },
      inLanguage: ["en", "es"],
    },
    {
      "@type": "Service",
      "@id": "https://hagpartner.com/#service-export",
      name: "Export Solutions",
      description:
        "Market expansion support for brands and suppliers seeking reliable international trade opportunities, structured coordination and commercial follow-through.",
      provider: { "@id": "https://hagpartner.com/#organization" },
      areaServed: "International",
    },
    {
      "@type": "Service",
      "@id": "https://hagpartner.com/#service-distribution",
      name: "Distribution Services",
      description:
        "B2B distribution relationships designed to connect products with aligned buyers, operators and growth-focused commercial partners.",
      provider: { "@id": "https://hagpartner.com/#organization" },
    },
    {
      "@type": "Service",
      "@id": "https://hagpartner.com/#service-ecommerce",
      name: "E-commerce Solutions",
      description:
        "Omnichannel growth planning and scalable digital distribution.",
      provider: { "@id": "https://hagpartner.com/#organization" },
      offers: { "@type": "Offer", availability: "https://schema.org/PreOrder" },
    },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ConvexAuthNextjsServerProvider>
      <html lang="en" data-theme="dark" data-nav="white" className={inter.variable}>
        <head>
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
          />
        </head>
        <body style={{ fontFamily: "var(--font-inter), system-ui, sans-serif" }}>
          <ConvexClientProvider>
            <I18nProvider>
              <ModalProvider>{children}</ModalProvider>
            </I18nProvider>
          </ConvexClientProvider>
        </body>
      </html>
    </ConvexAuthNextjsServerProvider>
  );
}
