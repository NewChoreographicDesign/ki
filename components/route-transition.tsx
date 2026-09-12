"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

const CURTAIN_MS = 1200;

/**
 * The curtain itself: two rings (the same white rings as the logo mark)
 * slide in from the screen edges and meet in the middle, then the black
 * overlay and the new page crossfade together while the page comes into
 * focus out of a slight motion blur. All timing lives in the four
 * `curtain-*` keyframes (tailwind.config.ts) so the rings, the overlay
 * fade, and the content reveal always stay in lockstep — this component
 * only has to mount the overlay and, once its animation has actually
 * finished, remove it so it stops blocking clicks.
 *
 * `children` gets its own Suspense boundary specifically so the overlay
 * never waits on it: without this, a slow-loading destination page (a cold
 * serverless function, a slower connection) would hold back the *entire*
 * render — curtain included — until its data arrived, which is what caused
 * a visible gap before the rings appeared. With the boundary, the curtain
 * commits and starts animating the instant the link is clicked, regardless
 * of how long the page underneath takes to actually show up.
 */
function TransitionCurtain({ children }: { children: React.ReactNode }) {
  const [curtainUp, setCurtainUp] = React.useState(true);

  React.useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      setCurtainUp(false);
      return;
    }
    const dismiss = () => setCurtainUp(false);
    const timer = setTimeout(dismiss, CURTAIN_MS);
    // The overlay below is deliberately NOT pointer-events-none (it must
    // block taps while it's up), which means it's also deliberately
    // dangerous: if nothing ever calls dismiss(), the whole app is stuck
    // unresponsive forever behind an overlay that, once its own fade
    // finishes, is invisible — looking exactly like "the app opened but
    // nothing reacts to touch". A single setTimeout isn't safe enough to
    // be the only way out of that: iOS Safari/WKWebView can suspend or
    // drop pending timers while a PWA is backgrounded (app-switched away,
    // screen locked) and never fire them on return. Backing it up with
    // visibilitychange/pageshow/focus means the moment the page is visible
    // and interactive again, the curtain is guaranteed gone — it can never
    // legitimately still be mid-transition after a background/foreground
    // cycle anyway.
    document.addEventListener("visibilitychange", dismiss);
    window.addEventListener("pageshow", dismiss);
    window.addEventListener("focus", dismiss);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", dismiss);
      window.removeEventListener("pageshow", dismiss);
      window.removeEventListener("focus", dismiss);
    };
  }, []);

  return (
    <>
      {curtainUp && (
        <div
          aria-hidden="true"
          className="fixed inset-0 z-[200] animate-curtain-overlay bg-background"
          onAnimationEnd={() => setCurtainUp(false)}
        >
          <div className="absolute left-1/2 top-1/2 h-32 w-32 animate-curtain-ring-left rounded-full border-[14px] border-white shadow-glow-sky" />
          <div className="absolute left-1/2 top-1/2 h-32 w-32 animate-curtain-ring-right rounded-full border-[14px] border-white/75" />
        </div>
      )}
      <React.Suspense fallback={null}>
        <div className="animate-curtain-content">{children}</div>
      </React.Suspense>
    </>
  );
}

function topSegment(pathname: string) {
  return pathname.split("/")[1] ?? "";
}

/**
 * Plays the curtain above for the first page of a session and for every
 * "tab" change (a different top-level nav section) — but not for going
 * further into the same section (e.g. the medicatie list to one client's
 * detail page), which should feel instant, not like a fresh screen. This
 * is decided by comparing only the first path segment: same segment means
 * still in the same section, so no curtain.
 */
export function RouteTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const segment = topSegment(pathname);
  const prevSegmentRef = React.useRef<string | null>(null);
  const isTabChange = prevSegmentRef.current === null || prevSegmentRef.current !== segment;
  prevSegmentRef.current = segment;

  if (!isTabChange) {
    return <>{children}</>;
  }
  return <TransitionCurtain key={pathname}>{children}</TransitionCurtain>;
}
