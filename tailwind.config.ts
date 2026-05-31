import type { Config } from "tailwindcss";

// Brand tokens mirror the CSS variables in src/app/globals.css so you can
// build new UI with Tailwind utilities (e.g. bg-navy, text-accent) while the
// existing components keep using the ported design-system classes.
const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: { DEFAULT: "#0a2342", deep: "#061a33", lift: "#0f2f57" },
        accent: { DEFAULT: "#3b82f6", strong: "#2563eb" },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      maxWidth: {
        site: "1240px",
      },
    },
  },
  plugins: [],
};

export default config;
