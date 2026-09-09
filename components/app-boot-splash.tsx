"use client";

import * as React from "react";
import { LogoMark } from "@/components/brand/logo";

const SESSION_KEY = "ki-booted";
const HOLD_MS = 500;
const FADE_MS = 350;

/**
 * A brief, once-per-browser-tab branded launch screen. This app is mostly
 * opened from an iPad home-screen icon (see INSTALLATIE.md) — a cold PWA
 * launch otherwise shows a blank flash before the shell paints, which reads
 * as broken rather than "app-like". This masks that moment with an
 * intentional beat instead, then gets out of the way for good: sessionStorage
 * means a medewerker navigating between pages during a shift never sees it
 * again until they actually relaunch the app.
 */
export function AppBootSplash() {
  const [phase, setPhase] = React.useState<"hidden" | "visible" | "leaving">("hidden");

  React.useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (sessionStorage.getItem(SESSION_KEY)) return;
    sessionStorage.setItem(SESSION_KEY, "1");
    if (reduceMotion) return;

    setPhase("visible");
    const leaveTimer = setTimeout(() => setPhase("leaving"), HOLD_MS);
    const removeTimer = setTimeout(() => setPhase("hidden"), HOLD_MS + FADE_MS);
    return () => {
      clearTimeout(leaveTimer);
      clearTimeout(removeTimer);
    };
  }, []);

  if (phase === "hidden") return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[100] flex items-center justify-center bg-background transition-opacity ease-out"
      style={{
        opacity: phase === "leaving" ? 0 : 1,
        transitionDuration: `${FADE_MS}ms`,
      }}
    >
      <LogoMark size="lg" className="animate-pulse-ring" />
    </div>
  );
}
