/**
 * tailwind.config.ts
 * ------------------------------------------------------------------
 * WHAT: The design-token file for the whole Mobile Campus platform.
 * WHY : Every colour, font size and shadow used in the app is defined
 *       here so the look stays consistent (indigo/slate + warm gold)
 *       and we never hard-code hex colours inside components.
 */
import type { Config } from "tailwindcss";

const config: Config = {
  // Dark mode is switched by a class on <html>. We keep it available but
  // ship light mode first because most students use the app in daylight.
  darkMode: "class",

  // Tell Tailwind which files to scan for class names.
  content: ["./src/**/*.{ts,tsx,mdx}"],

  theme: {
    extend: {
      colors: {
        // Primary brand: deep indigo tones (luxurious, calm).
        primary: {
          50: "#eef2ff",
          100: "#e0e7ff",
          200: "#c7d2fe",
          300: "#a5b4fc",
          400: "#818cf8",
          500: "#6366f1",
          600: "#4f46e5",
          700: "#4338ca",
          800: "#3730a3",
          900: "#312e81",
          950: "#1e1b4b",
        },
        // Neutral surfaces: slate (never green-and-white dominant).
        slate: {
          50: "#f8fafc",
          100: "#f1f5f9",
          200: "#e2e8f0",
          300: "#cbd5e1",
          400: "#94a3b8",
          500: "#64748b",
          600: "#475569",
          700: "#334155",
          800: "#1e293b",
          900: "#0f172a",
          950: "#020617",
        },
        // Accent: warm gold used sparingly for highlights, badges, money.
        gold: {
          50: "#fffbeb",
          100: "#fef3c7",
          200: "#fde68a",
          300: "#fcd34d",
          400: "#fbbf24",
          500: "#f59e0b",
          600: "#d97706",
          700: "#b45309",
          800: "#92400e",
          900: "#78350f",
        },
        // Semantic colours for success / danger / warning states.
        success: { DEFAULT: "#0d9488", light: "#ccfbf1", dark: "#0f766e" },
        danger: { DEFAULT: "#dc2626", light: "#fee2e2", dark: "#b91c1c" },
        warn: { DEFAULT: "#d97706", light: "#fef3c7", dark: "#b45309" },
      },

      fontFamily: {
        // System fonts first: they cost zero data to download, which matters
        // a lot for students on expensive Nigerian mobile data.
        sans: [
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },

      fontSize: {
        // A clean type scale so hierarchy is obvious on a small screen.
        xs: ["0.75rem", { lineHeight: "1rem" }],
        sm: ["0.875rem", { lineHeight: "1.25rem" }],
        base: ["1rem", { lineHeight: "1.5rem" }],
        lg: ["1.125rem", { lineHeight: "1.75rem" }],
        xl: ["1.25rem", { lineHeight: "1.75rem" }],
        "2xl": ["1.5rem", { lineHeight: "2rem" }],
        "3xl": ["1.875rem", { lineHeight: "2.25rem" }],
        "4xl": ["2.25rem", { lineHeight: "2.5rem" }],
      },

      spacing: {
        // Bottom navigation height. Pages pad their content by this amount
        // so the fixed nav bar never covers the last row of content.
        nav: "4.5rem",
      },

      borderRadius: {
        xl: "0.875rem",
        "2xl": "1.25rem",
        "3xl": "1.75rem",
      },

      boxShadow: {
        // Soft, low-contrast shadows keep cards feeling light and premium.
        card: "0 1px 2px 0 rgb(15 23 42 / 0.04), 0 8px 24px -12px rgb(15 23 42 / 0.12)",
        float: "0 10px 30px -10px rgb(79 70 229 / 0.45)",
        nav: "0 -2px 20px -8px rgb(15 23 42 / 0.18)",
      },

      keyframes: {
        // Small utility animations used by the loading skeletons.
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
        pulseSoft: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.55" },
        },
      },

      animation: {
        shimmer: "shimmer 1.6s infinite",
        "pulse-soft": "pulseSoft 1.8s ease-in-out infinite",
      },
    },
  },

  plugins: [],
};

export default config;
