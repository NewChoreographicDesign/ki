import type { Config } from "tailwindcss";

// Every themed color below is stored as CSS variables (globals.css defines
// one set under :root for light and an override set under .dark — dark is
// the default the app actually starts in, see app/layout.tsx's init
// script; :root is just the CSS fallback for anyone who's chosen light),
// so a single class toggle on <html> (see components/theme-toggle.tsx)
// re-themes the whole app with zero per-component changes: every existing
// `bg-surface2`, `text-slate-400`, `border-rose-500/50`, etc. call site
// already just references these token names. The `rgb(var(--x) / <alpha>)`
// form (rather than a plain hex or var()) is what makes Tailwind's opacity
// modifiers (the `/50` in `bg-surface2/50`) keep working — Tailwind can only
// apply an alpha channel to a color function it can inject one into.
// Tailwind's own runtime happily accepts a function here (it calls it with
// `{ opacityValue }` while resolving a class like `bg-surface2/50`), but the
// bundled Config type still declares color values as plain strings only —
// so the cast below is purely to satisfy tsc, not a behavior change.
function withOpacity(variable: string): string {
  const resolver = ({ opacityValue }: { opacityValue?: string }) =>
    opacityValue === undefined ? `rgb(var(${variable}))` : `rgb(var(${variable}) / ${opacityValue})`;
  return resolver as unknown as string;
}

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
        // mark's gradient (and stays a fixed brand color in both themes, like
        // a logo would — see components/brand/logo.tsx — so it's the one
        // color here left as a plain, non-themed hex).
        background: withOpacity("--color-background"),
        surface: withOpacity("--color-surface"),
        surface2: withOpacity("--color-surface2"),
        border: withOpacity("--color-border"),
        // The stock Tailwind `slate` scale is used directly as this app's
        // text-color ramp (text-slate-50 down to text-slate-600) — themed
        // here as CSS variables like the rest, rather than left as literal
        // hex, since a light theme needs a genuinely different ramp (light
        // text on dark reversed to dark text on light), not just a lighter
        // version of the same one.
        slate: {
          50: withOpacity("--color-slate-50"),
          100: withOpacity("--color-slate-100"),
          200: withOpacity("--color-slate-200"),
          300: withOpacity("--color-slate-300"),
          400: withOpacity("--color-slate-400"),
          500: withOpacity("--color-slate-500"),
          600: withOpacity("--color-slate-600"),
        },
        rose: {
          200: withOpacity("--color-rose-200"),
          300: withOpacity("--color-rose-300"),
          400: withOpacity("--color-rose-400"),
          500: withOpacity("--color-rose-500"),
          600: withOpacity("--color-rose-600"),
        },
        forest: {
          200: withOpacity("--color-forest-200"),
          300: withOpacity("--color-forest-300"),
          400: withOpacity("--color-forest-400"),
          500: withOpacity("--color-forest-500"),
          600: withOpacity("--color-forest-600"),
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
