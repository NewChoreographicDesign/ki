// Shared between the client-side idle watcher (components/idle-logout.tsx,
// which runs in the browser) and middleware.ts (which enforces the same
// timeout server-side on every request, so it also works when the app was
// fully closed rather than just backgrounded). Deliberately has no
// "server-only" or next/headers imports so both can import it — middleware
// runs in Next's edge runtime and can't pull in lib/auth.ts's dependencies.
export const IDLE_TIMEOUT_MS = 5 * 60 * 1000;

// Absolute session lifetime from login, regardless of activity — matches
// lib/auth.ts's SESSION_DURATION_SECONDS. Kept here so middleware.ts can
// preserve a session's original expiration when it refreshes the
// lastActivity claim, instead of accidentally sliding the absolute cap too.
export const SESSION_DURATION_SECONDS = 12 * 60 * 60;
