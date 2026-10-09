// Stable per-client colours for the agenda calendar — the same cliënt is
// the same colour on every device and every visit (hash of the id, no
// stored state), like the coloured calendars in Outlook/Google.
export type AgendaColor = { name: string; bg: string; border: string; text: string; dot: string };

const PALETTE: AgendaColor[] = [
  { name: "rose", bg: "rgba(244,63,94,0.18)", border: "#fb7185", text: "#fecdd3", dot: "#fb7185" },
  { name: "sky", bg: "rgba(14,165,233,0.18)", border: "#38bdf8", text: "#bae6fd", dot: "#38bdf8" },
  { name: "emerald", bg: "rgba(16,185,129,0.18)", border: "#34d399", text: "#a7f3d0", dot: "#34d399" },
  { name: "amber", bg: "rgba(245,158,11,0.18)", border: "#fbbf24", text: "#fde68a", dot: "#fbbf24" },
  { name: "violet", bg: "rgba(139,92,246,0.20)", border: "#a78bfa", text: "#ddd6fe", dot: "#a78bfa" },
  { name: "teal", bg: "rgba(20,184,166,0.18)", border: "#2dd4bf", text: "#99f6e4", dot: "#2dd4bf" },
  { name: "orange", bg: "rgba(249,115,22,0.18)", border: "#fb923c", text: "#fed7aa", dot: "#fb923c" },
  { name: "fuchsia", bg: "rgba(217,70,239,0.18)", border: "#e879f9", text: "#f5d0fe", dot: "#e879f9" },
  { name: "lime", bg: "rgba(132,204,22,0.18)", border: "#a3e635", text: "#d9f99d", dot: "#a3e635" },
  { name: "indigo", bg: "rgba(99,102,241,0.20)", border: "#818cf8", text: "#c7d2fe", dot: "#818cf8" },
];

/** Afspraken without a cliënt (teamoverleg, controle, …) share one neutral colour. */
export const NEUTRAL_COLOR: AgendaColor = { name: "slate", bg: "rgba(148,163,184,0.16)", border: "#94a3b8", text: "#e2e8f0", dot: "#94a3b8" };

export function colorForClient(clientId: string | null): AgendaColor {
  if (!clientId) return NEUTRAL_COLOR;
  let hash = 0;
  for (let i = 0; i < clientId.length; i++) hash = (hash * 31 + clientId.charCodeAt(i)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}
