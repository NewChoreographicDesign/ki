"use client";

import { usePathname } from "next/navigation";

/**
 * Replays a short fade+slide-up on every navigation, purely via CSS: keying
 * on the pathname forces React to remount this wrapper, which restarts the
 * `animate-fade-in-up` keyframe already on it — no client-side data fetching
 * or animation library involved, so it can't fight the server-streamed
 * content it wraps.
 */
export function RouteTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="animate-fade-in-up">
      {children}
    </div>
  );
}
