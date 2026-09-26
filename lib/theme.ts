// Deliberately NOT "use client" — imported both by the (server) root layout,
// which needs the literal key for its no-flash init script, and by client
// components (theme-toggle.tsx, themed-toaster.tsx). A named export from a
// "use client" module isn't guaranteed to survive that server/client
// boundary as a plain value, so this stays a plain shared module instead.
export type Theme = "light" | "dark";
export const THEME_STORAGE_KEY = "theme";
