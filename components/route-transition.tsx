"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

const CURTAIN_MS = 1500;

/**
 * The curtain itself: two rings (echoing the logo mark) slide in from the
 * screen edges and meet in the middle, hold briefly, then the black overlay
 * and the new page crossfade together while the page comes into focus out
 * of a slight motion blur. All timing lives in the four `curtain-*`
 * keyframes (tailwind.config.ts) so the rings, the overlay fade, and the
 * content reveal always stay in lockstep — this component only has to
 * mount the overlay and, once its animation has actually finished, remove
 * it so it stops blocking clicks.
 */
function TransitionCurtain({ children }: { children: React.ReactNode }) {
  const [curtainUp, setCurtainUp] = React.useState(true);

  React.useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = setTimeout(() => setCurtainUp(false), reduceMotion ? 0 : CURTAIN_MS);
    return () => clearTimeout(timer);
  }, []);

  return (
    <>
      {curtainUp && (
        <div aria-hidden="true" className="fixed inset-0 z-[200] animate-curtain-overlay bg-background">
          <div className="absolute left-1/2 top-1/2 h-32 w-32 animate-curtain-ring-left rounded-full border-[14px] border-sky-400 shadow-glow-sky" />
          <div className="absolute left-1/2 top-1/2 h-32 w-32 animate-curtain-ring-right rounded-full border-[14px] border-cyan-300/80" />
        </div>
      )}
      <div className="animate-curtain-content">{children}</div>
    </>
  );
}

/**
 * Plays the curtain above on every navigation: keying on the pathname
 * forces a full remount, which is the only reliable way to restart both the
 * overlay and the content reveal together each time (the content itself
 * doesn't otherwise unmount between routes — only its children swap once
 * the new page is ready).
 */
export function RouteTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return <TransitionCurtain key={pathname}>{children}</TransitionCurtain>;
}
