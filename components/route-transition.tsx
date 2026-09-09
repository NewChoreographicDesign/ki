"use client";

import { usePathname } from "next/navigation";

/**
 * Plays on every navigation, purely via CSS: keying on the pathname forces
 * React to remount this wrapper, which restarts the animations already on
 * it — no client-side data fetching or animation library involved, so it
 * can't fight the server-streamed content it wraps.
 *
 * Two things happen together: the content itself pops into place with a
 * slight overshoot (animate-fade-in-up), and a thin brand-colored accent
 * sweeps across above it and fades (animate-sweep-in). The sweep is pure
 * decoration — a little flash of color to make arriving somewhere new feel
 * like a small event — not a progress indicator, so it always plays the
 * same regardless of how long the navigation actually took.
 */
export function RouteTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="relative">
      <div
        aria-hidden="true"
        className="absolute -top-2 left-0 h-1 w-24 origin-left animate-sweep-in rounded-full bg-brand-gradient"
      />
      <div className="animate-fade-in-up">{children}</div>
    </div>
  );
}
