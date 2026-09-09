import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#0b0f14",
        surface: "#111823",
        surface2: "#161f2c",
        border: "#22303f",
        sky: {
          400: "#38bdf8",
          500: "#0ea5e9",
          600: "#0284c7",
        },
        emerald: {
          400: "#34d399",
          500: "#10b981",
          600: "#059669",
        },
      },
      backgroundImage: {
        // The one recurring "signature" gradient for this app — primary CTAs,
        // the active nav pill, and the boot splash mark all pull from this
        // single definition so the accent reads as one deliberate choice
        // rather than a different blue on every element.
        "brand-gradient": "linear-gradient(135deg, #38bdf8 0%, #22d3ee 100%)",
        "brand-gradient-soft": "linear-gradient(135deg, rgba(56,189,248,0.16) 0%, rgba(34,211,238,0.10) 100%)",
        // The gradient badge mark gets its own token: the base brand gradient
        // plus a soft highlight in the upper-left, like light catching a
        // glossy surface — reads as a considered app icon rather than a flat
        // color swatch.
        "brand-gradient-sheen":
          "radial-gradient(120% 130% at 22% 15%, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0) 45%), linear-gradient(135deg, #38bdf8 0%, #22d3ee 100%)",
      },
      boxShadow: {
        "glow-sky": "0 0 0 1px rgba(56,189,248,0.25), 0 8px 24px -6px rgba(56,189,248,0.45)",
        "glow-emerald": "0 0 0 1px rgba(52,211,153,0.25), 0 8px 24px -6px rgba(52,211,153,0.4)",
        lift: "0 1px 2px rgba(0,0,0,0.3), 0 12px 28px -10px rgba(0,0,0,0.55)",
      },
      borderRadius: {
        xl: "1rem",
        "2xl": "1.25rem",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      keyframes: {
        "fade-in-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "scale-in": {
          "0%": { opacity: "0", transform: "scale(0.96)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        "pulse-ring": {
          "0%": { boxShadow: "0 0 0 0 rgba(56,189,248,0.45)" },
          "100%": { boxShadow: "0 0 0 18px rgba(56,189,248,0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "loading-bar": {
          "0%": { width: "0%", opacity: "1" },
          "55%": { width: "72%", opacity: "1" },
          "100%": { width: "88%", opacity: "0.7" },
        },
      },
      animation: {
        "fade-in-up": "fade-in-up 0.45s cubic-bezier(0.22,1,0.36,1) both",
        "fade-in": "fade-in 0.35s ease-out both",
        "scale-in": "scale-in 0.3s cubic-bezier(0.22,1,0.36,1) both",
        "pulse-ring": "pulse-ring 1.6s cubic-bezier(0.4,0,0.6,1) infinite",
        shimmer: "shimmer 1.8s linear infinite",
        "loading-bar": "loading-bar 1.1s cubic-bezier(0.22,1,0.36,1) both",
      },
    },
  },
  plugins: [],
};

export default config;
