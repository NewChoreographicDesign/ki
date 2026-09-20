"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

const MARK_SIZES = {
  sm: "h-9 w-9 rounded-lg",
  md: "h-14 w-14 rounded-2xl",
  lg: "h-20 w-20 rounded-[1.75rem]",
} as const;

/**
 * The app's mark: two rings, shared across every woongroep running on this
 * platform (the group's own name sits next to it — see
 * components/app-nav.tsx) rather than spelling out one group's initials —
 * an abstract mark reads as a brand at every size from a 36px nav icon to
 * the home-screen icon, and stays correct no matter which group is looking
 * at it.
 *
 * The two rings are deliberately unequal: the front ring (thick, full
 * gradient) leads, the back ring (thin, 60% opacity) follows underneath —
 * not two identical circles, but a clear sense of who's out front and who's
 * tracking behind. Exactly where they cross sits one small, hard dot: the
 * one point where both rings actually meet. That dot is the whole idea —
 * overview isn't a blurry overlap, it's a single sharp point everything
 * resolves to. This is a care-home app built around people working together
 * around a resident, so that meeting-point motif fits better than a
 * monogram would.
 *
 * Each instance gets its own gradient ids (useId) so multiple marks on one
 * page — sidebar, curtain, favicon preview — never collide over a shared
 * SVG def. A soft blurred halo behind it breathes slowly (animate-pulse-glow)
 * so the mark reads as alive rather than a static image — subtle and slow
 * enough to sit in the sidebar all shift without becoming a distraction.
 */
export function LogoMark({
  size = "md",
  className,
}: {
  size?: keyof typeof MARK_SIZES;
  className?: string;
}) {
  const uid = React.useId();
  const backId = `mark-back-${uid}`;
  const frontId = `mark-front-${uid}`;

  return (
    <div className={cn("relative inline-flex shrink-0", MARK_SIZES[size])}>
      <div
        aria-hidden="true"
        className={cn("absolute inset-0 -z-10 animate-pulse-glow bg-brand-gradient blur-md", MARK_SIZES[size])}
      />
      <div
        className={cn(
          "flex shrink-0 items-center justify-center bg-surface",
          "shadow-glow-rose ring-1 ring-inset ring-border",
          MARK_SIZES[size],
          className
        )}
      >
        <svg viewBox="0 0 100 100" className="h-[68%] w-[68%]" fill="none" aria-hidden="true">
          <defs>
            <linearGradient id={backId} x1="20" y1="20" x2="86" y2="80" gradientUnits="userSpaceOnUse">
              <stop stopColor="#e3a695" />
              <stop offset="1" stopColor="#c96f5c" />
            </linearGradient>
            <linearGradient id={frontId} x1="14" y1="14" x2="80" y2="86" gradientUnits="userSpaceOnUse">
              <stop stopColor="#ffcf6e" />
              <stop offset="1" stopColor="#d98a7a" />
            </linearGradient>
          </defs>
          <circle cx="63" cy="50" r="23" stroke={`url(#${backId})`} strokeWidth="6" opacity="0.6" />
          <circle cx="37" cy="50" r="23" stroke={`url(#${frontId})`} strokeWidth="11" />
          <circle cx="50" cy="50" r="5.5" fill="#ffcf6e" />
        </svg>
      </div>
    </div>
  );
}
