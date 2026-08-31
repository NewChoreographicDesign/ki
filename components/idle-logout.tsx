"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

// Shared iPads/devices in a care setting are the real exposure risk here:
// someone walks away from an unlocked session and the next person to touch
// the screen sees client health data. The JWT session itself stays valid
// for a full shift (12h, see lib/auth.ts) — this is a separate, client-side
// control that forces a fresh login after a period of no interaction at all,
// regardless of how much of the JWT's lifetime remains.
const IDLE_TIMEOUT_MS = 15 * 60 * 1000;
const ACTIVITY_EVENTS = ["mousedown", "keydown", "touchstart", "scroll"] as const;

export function IdleLogout() {
  const router = useRouter();

  React.useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    async function logout() {
      try {
        await fetch("/api/auth/logout", { method: "POST" });
      } finally {
        toast.info("Automatisch uitgelogd na 15 minuten inactiviteit");
        router.push("/login");
        router.refresh();
      }
    }

    function resetTimer() {
      clearTimeout(timer);
      timer = setTimeout(logout, IDLE_TIMEOUT_MS);
    }

    resetTimer();
    ACTIVITY_EVENTS.forEach((event) => window.addEventListener(event, resetTimer));

    return () => {
      clearTimeout(timer);
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, resetTimer));
    };
  }, [router]);

  return null;
}
