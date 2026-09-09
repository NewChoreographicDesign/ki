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
        // A slight overshoot (the "back out" easing below) instead of a flat
        // ease-out is the whole difference between "content updated" and
        // "content arrived" — it's the one animation that plays on every
        // route change (see components/route-transition.tsx), so it carries
        // a lot of the app's "does this feel alive" weight on its own.
        "fade-in-up": {
          "0%": { opacity: "0", transform: "translateY(16px) scale(0.97)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
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
        "pulse-glow": {
          "0%, 100%": { opacity: "0.55" },
          "50%": { opacity: "1" },
        },
        // A one-shot flourish, not a progress indicator: a bright accent
        // sweeps across and fades, timed to the same beat as fade-in-up, so
        // arriving somewhere new gets a little flash of brand color instead
        // of nothing — purely decorative, never tied to how long anything
        // actually took to load.
        "sweep-in": {
          "0%": { transform: "scaleX(0)", opacity: "1" },
          "55%": { transform: "scaleX(1)", opacity: "0.9" },
          "100%": { transform: "scaleX(1)", opacity: "0" },
        },
        "pop-in": {
          "0%": { opacity: "0", transform: "scale(0.5)" },
          "60%": { opacity: "1", transform: "scale(1.15)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
      },
      animation: {
        "fade-in-up": "fade-in-up 0.55s cubic-bezier(0.34,1.56,0.64,1) both",
        "fade-in": "fade-in 0.35s ease-out both",
        "scale-in": "scale-in 0.3s cubic-bezier(0.22,1,0.36,1) both",
        "pulse-ring": "pulse-ring 1.6s cubic-bezier(0.4,0,0.6,1) infinite",
        "pulse-glow": "pulse-glow 3.5s ease-in-out infinite",
        "sweep-in": "sweep-in 0.6s cubic-bezier(0.22,1,0.36,1) both",
        "pop-in": "pop-in 0.4s cubic-bezier(0.34,1.56,0.64,1) both",
      },
    },
  },
  plugins: [],
};

export default config;
