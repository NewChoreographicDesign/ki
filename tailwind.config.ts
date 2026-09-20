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
        // Vezrap system — four tokens, no palette to choose from: Ink carries
        // every background, Rose (Signaal) is action/emphasis, Forest
        // (Secundair) is confirmation/calm, Gold only ever lives inside the
        // mark's gradient. See components/brand/logo.tsx.
        background: "#1c2420",
        surface: "#232d27",
        surface2: "#263029",
        border: "#33413a",
        rose: {
          200: "#f0d5cc",
          300: "#e3b6a8",
          400: "#d98a7a",
          500: "#c96f5c",
          600: "#b25a48",
        },
        forest: {
          200: "#cfe0d3",
          300: "#a9c7b0",
          400: "#7fa88a",
          500: "#5c8a67",
          600: "#4a7154",
        },
        gold: {
          400: "#ffd987",
          500: "#ffcf6e",
          600: "#e6b455",
        },
      },
      backgroundImage: {
        // The one recurring "signature" gradient for this app — primary CTAs,
        // the active nav pill, and the mark itself all pull from this single
        // definition so the accent reads as one deliberate choice rather
        // than a different color on every element. Gold to rose is the same
        // gradient the logo mark's front ring uses.
        "brand-gradient": "linear-gradient(135deg, #ffcf6e 0%, #d98a7a 100%)",
        "brand-gradient-soft": "linear-gradient(135deg, rgba(255,207,110,0.16) 0%, rgba(217,138,122,0.12) 100%)",
        "brand-gradient-sheen":
          "radial-gradient(120% 130% at 22% 15%, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0) 45%), linear-gradient(135deg, #ffcf6e 0%, #d98a7a 100%)",
      },
      boxShadow: {
        "glow-rose": "0 0 0 1px rgba(217,138,122,0.25), 0 8px 24px -6px rgba(217,138,122,0.45)",
        "glow-forest": "0 0 0 1px rgba(92,138,103,0.25), 0 8px 24px -6px rgba(92,138,103,0.4)",
        lift: "0 1px 2px rgba(0,0,0,0.3), 0 12px 28px -10px rgba(0,0,0,0.55)",
      },
      borderRadius: {
        xl: "1rem",
        "2xl": "1.25rem",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
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
        "pop-in": {
          "0%": { opacity: "0", transform: "scale(0.5)" },
          "60%": { opacity: "1", transform: "scale(1.15)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        // The full-page route transition (components/route-transition.tsx):
        // two rings slide in from opposite edges and meet at the logo's own
        // proportions, then the black curtain and the new page crossfade
        // together — all five animations below share the same 1.2s timeline
        // (0%/75%/100% = 0ms/900ms/1200ms) so they stay in lockstep without
        // any JS keeping them in sync.
        "curtain-ring-left": {
          "0%": { transform: "translate(-50%, -50%) translateX(calc(-50vw - 10rem))" },
          "75%": { transform: "translate(-50%, -50%) translateX(-2.25rem)" },
          "100%": { transform: "translate(-50%, -50%) translateX(-2.25rem)" },
        },
        "curtain-ring-right": {
          "0%": { transform: "translate(-50%, -50%) translateX(calc(50vw + 10rem))" },
          "75%": { transform: "translate(-50%, -50%) translateX(2.25rem)" },
          "100%": { transform: "translate(-50%, -50%) translateX(2.25rem)" },
        },
        "curtain-overlay": {
          "0%": { opacity: "1" },
          "75%": { opacity: "1" },
          "100%": { opacity: "0" },
        },
        "curtain-content": {
          "0%": { opacity: "0", filter: "blur(20px)", transform: "scale(1.04)" },
          "75%": { opacity: "0", filter: "blur(20px)", transform: "scale(1.04)" },
          "100%": { opacity: "1", filter: "blur(0px)", transform: "scale(1)" },
        },
        // The focal dot from the mark (see components/brand/logo.tsx) only
        // appears once the two rings have actually met — it's the payoff of
        // the curtain, not a decoration on it, so it stays invisible for the
        // first 75% of the timeline and then snaps in with a slight
        // overshoot, on the same four-part 0/75/88/100 timeline as the rings.
        "curtain-dot": {
          "0%, 75%": { opacity: "0", transform: "translate(-50%, -50%) scale(0.4)" },
          "88%": { opacity: "1", transform: "translate(-50%, -50%) scale(1.25)" },
          "100%": { opacity: "1", transform: "translate(-50%, -50%) scale(1)" },
        },
      },
      animation: {
        "fade-in-up": "fade-in-up 0.55s cubic-bezier(0.34,1.56,0.64,1) both",
        "fade-in": "fade-in 0.35s ease-out both",
        "scale-in": "scale-in 0.3s cubic-bezier(0.22,1,0.36,1) both",
        "pulse-ring": "pulse-ring 1.6s cubic-bezier(0.4,0,0.6,1) infinite",
        "pulse-glow": "pulse-glow 3.5s ease-in-out infinite",
        "pop-in": "pop-in 0.4s cubic-bezier(0.34,1.56,0.64,1) both",
        "curtain-ring-left": "curtain-ring-left 1.2s cubic-bezier(0.34,1.56,0.64,1) both",
        "curtain-ring-right": "curtain-ring-right 1.2s cubic-bezier(0.34,1.56,0.64,1) both",
        "curtain-overlay": "curtain-overlay 1.2s cubic-bezier(0.22,1,0.36,1) both",
        "curtain-content": "curtain-content 1.2s cubic-bezier(0.22,1,0.36,1) both",
        "curtain-dot": "curtain-dot 1.2s cubic-bezier(0.34,1.56,0.64,1) both",
      },
    },
  },
  plugins: [],
};

export default config;
