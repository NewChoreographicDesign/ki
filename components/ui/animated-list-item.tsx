"use client";

import * as React from "react";

/**
 * Wraps one row in a list so it can play a fade+collapse exit before the
 * parent actually drops it from state, instead of just vanishing. Same
 * grid-template-rows 0fr/1fr height trick as CollapsibleSection (no need to
 * know the row's real height up front) plus an opacity fade.
 *
 * Usage: the parent marks a row `exiting` (keeping it in its array/map a
 * little longer) instead of removing it outright, and only removes it for
 * real from `onExited`, once the transition has actually finished. Under
 * reduced motion the CSS override collapses the transition duration to
 * ~0, so `onExited` still fires — just immediately instead of after 200ms.
 */
export function AnimatedListItem({
  exiting = false,
  onExited,
  children,
}: {
  exiting?: boolean;
  onExited?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="grid overflow-hidden transition-[grid-template-rows,opacity] duration-200 ease-in"
      style={{ gridTemplateRows: exiting ? "0fr" : "1fr", opacity: exiting ? 0 : 1 }}
      onTransitionEnd={(e) => {
        if (exiting && e.propertyName === "grid-template-rows") onExited?.();
      }}
    >
      <div className="min-h-0">{children}</div>
    </div>
  );
}
