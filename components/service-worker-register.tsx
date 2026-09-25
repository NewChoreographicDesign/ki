"use client";

import { useEffect } from "react";

// Registers public/sw.js once the page has hydrated — needed for Web Push
// (see lib/push.ts): a browser can only receive push events through an
// active service worker registration. Plain external JS, not an inline
// script, so unlike the theme-init script this needs no CSP nonce.
// Silently no-ops in browsers without serviceWorker support and swallows
// registration failures — this is a progressive enhancement, never
// something the app depends on to function.
export function ServiceWorkerRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  return null;
}
