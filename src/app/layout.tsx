import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { I18nProvider } from "@/lib/i18n";
import { ModalProvider } from "@/lib/modal";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "HAG Partner LLC — Connecting Brands with Strategic Markets",
  description:
    "HAG Partner LLC is a Florida-based B2B company helping brands, manufacturers, suppliers and distributors grow across export, distribution and digital commerce.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Default look = the approved version: dark background + white navbar.
  return (
    <html lang="en" data-theme="dark" data-nav="white" className={inter.variable}>
      <body style={{ fontFamily: "var(--font-inter), system-ui, sans-serif" }}>
        <I18nProvider>
          <ModalProvider>{children}</ModalProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
