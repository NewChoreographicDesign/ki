// Stable per-client colours for the agenda calendar — the same cliënt is
// the same colour on every device and every visit (hash of the id, no
// stored state), like the coloured calendars in Outlook/Google.
//
// Restricted to this app's own colour families (rose/forest/gold/slate —
// see app/globals.css) rather than a 10-hue rainbow, so the agenda reads as
// part of this app's muted, warm-paper look instead of introducing hues it
// never uses anywhere else.
//
// `text` is a CSS variable (app/globals.css), not a literal hex: dark mode
// needs the pale version of each hue (readable on the dark translucent
// wash) and light mode needs a deep, saturated version of the SAME hue
// (readable on the light translucent wash) — a single hex here would only
// ever be right in one theme. `bg`/`border`/`dot` stay plain hex: a
// translucent wash and a small accent dot read fine as the same colour in
// either theme.
export type AgendaColor = { name: string; bg: string; border: string; text: string; dot: string };

const PALETTE: AgendaColor[] = [
  { name: "rose", bg: "rgba(193,81,46,0.18)", border: "#c1512e", text: "var(--agenda-text-rose)", dot: "#c1512e" },
  { name: "forest", bg: "rgba(92,138,103,0.20)", border: "#5c8a67", text: "var(--agenda-text-forest)", dot: "#5c8a67" },
  { name: "gold", bg: "rgba(201,154,63,0.20)", border: "#c99a3f", text: "var(--agenda-text-gold)", dot: "#c99a3f" },
  { name: "slate", bg: "rgba(148,163,184,0.18)", border: "#94a3b8", text: "var(--agenda-text-slate)", dot: "#94a3b8" },
];

/** Afspraken without a cliënt (teamoverleg, controle, …) share one neutral colour. */
export const NEUTRAL_COLOR: AgendaColor = PALETTE[3];

export function colorForClient(clientId: string | null): AgendaColor {
  if (!clientId) return NEUTRAL_COLOR;
  let hash = 0;
  for (let i = 0; i < clientId.length; i++) hash = (hash * 31 + clientId.charCodeAt(i)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

/** Colour per category for the "kleur op categorie" mode (same palette family as the client colours). */
const CATEGORY_COLOR: Record<string, string> = {
  MEDISCH: "rose",
  PARAMEDISCH: "forest",
  FAMILIE: "gold",
  ACTIVITEIT: "forest",
  OVERLEG: "slate",
  VERVOER: "gold",
  OVERIG: "slate",
};

export function colorForCategory(category: string | null): AgendaColor {
  const name = category ? CATEGORY_COLOR[category] : "slate";
  return PALETTE.find((c) => c.name === name) ?? NEUTRAL_COLOR;
}
