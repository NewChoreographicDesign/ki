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
const IDLE_TIMEOUT_MS = 5 * 60 * 1000;
// A single long setTimeout is unreliable for this: browsers throttle or
// fully suspend timers in a backgrounded tab or a locked/sleeping tablet,
// so the timeout can silently never fire while the device sits idle — and
// the next tap would just schedule a fresh 5 minutes via resetTimer(),
// meaning the shared device never actually logs out. Tracking a real
// timestamp and re-checking elapsed time on a short interval, and again the
// moment the tab regains visibility/focus, catches idle time that piled up
// while suspended instead of losing it.
const CHECK_INTERVAL_MS = 5_000;
const ACTIVITY_EVENTS = ["mousedown", "keydown", "touchstart", "scroll"] as const;

export function IdleLogout() {
  const router = useRouter();

  React.useEffect(() => {
    let lastActivity = Date.now();
    let loggedOut = false;

    async function logout() {
      if (loggedOut) return;
      loggedOut = true;
      try {
        await fetch("/api/auth/logout", { method: "POST" });
      } finally {
        toast.info("Automatisch uitgelogd na 5 minuten inactiviteit");
        router.push("/login");
        router.refresh();
      }
    }

    function recordActivity() {
      lastActivity = Date.now();
    }

    function checkIdle() {
      if (Date.now() - lastActivity >= IDLE_TIMEOUT_MS) {
        logout();
      }
    }

    const interval = setInterval(checkIdle, CHECK_INTERVAL_MS);
    ACTIVITY_EVENTS.forEach((event) => window.addEventListener(event, recordActivity));
    document.addEventListener("visibilitychange", checkIdle);
    window.addEventListener("focus", checkIdle);

    return () => {
      clearInterval(interval);
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, recordActivity));
      document.removeEventListener("visibilitychange", checkIdle);
      window.removeEventListener("focus", checkIdle);
    };
  }, [router]);

  return null;
}
