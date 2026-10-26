"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface SwipeAction {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  onTrigger: () => void;
  /** "danger" = red (delete); default = the forest confirm color. */
  variant?: "default" | "danger";
}

const REVEAL_WIDTH = 88;
const TRIGGER_THRESHOLD = 64;

/**
 * Swipe-left-to-reveal-actions for a list row, iOS Mail style — pointer
 * events (not touch-only) so it works the same via touch, mouse drag, or
 * a trackpad, and degrades to "just a static row" if JS never attaches
 * (the wrapped row's own buttons, if any, are unaffected). A fast,
 * long-enough swipe past TRIGGER_THRESHOLD fires the action immediately
 * and snaps back; a short swipe just reveals the button(s) to tap.
 */
export function SwipeRow({ children, actions, className }: { children: React.ReactNode; actions: SwipeAction[]; className?: string }) {
  const [dragX, setDragX] = React.useState(0);
  const [revealed, setRevealed] = React.useState(false);
  const dragging = React.useRef(false);
  const startX = React.useRef(0);
  const startDragX = React.useRef(0);
  const pointerId = React.useRef<number | null>(null);
  const maxReveal = actions.length * REVEAL_WIDTH;

  function onPointerDown(e: React.PointerEvent) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    dragging.current = true;
    startX.current = e.clientX;
    startDragX.current = dragX;
    pointerId.current = e.pointerId;
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!dragging.current || e.pointerId !== pointerId.current) return;
    const delta = e.clientX - startX.current;
    const next = Math.min(0, Math.max(-maxReveal - 24, startDragX.current + delta));
    setDragX(next);
  }

  function endDrag(e: React.PointerEvent) {
    if (!dragging.current || e.pointerId !== pointerId.current) return;
    dragging.current = false;
    pointerId.current = null;
    if (-dragX >= TRIGGER_THRESHOLD && actions.length === 1) {
      // A single-action row (e.g. "voltooien") fires on a confident swipe
      // instead of requiring a second tap on the revealed button.
      setDragX(0);
      setRevealed(false);
      actions[0].onTrigger();
      return;
    }
    const shouldReveal = -dragX > maxReveal / 2;
    setDragX(shouldReveal ? -maxReveal : 0);
    setRevealed(shouldReveal);
  }

  function close() {
    setDragX(0);
    setRevealed(false);
  }

  return (
    <div className={cn("relative overflow-hidden rounded-2xl", className)}>
      <div className="absolute inset-y-0 right-0 flex" style={{ width: maxReveal }}>
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.label}
              type="button"
              onClick={() => {
                close();
                action.onTrigger();
              }}
              style={{ width: REVEAL_WIDTH }}
              className={cn(
                "flex h-full flex-col items-center justify-center gap-1 text-xs font-medium text-white",
                action.variant === "danger" ? "bg-red-500" : "bg-forest-500"
              )}
            >
              <Icon className="h-5 w-5" />
              {action.label}
            </button>
          );
        })}
      </div>
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onClick={() => revealed && close()}
        style={{ transform: `translateX(${dragX}px)`, touchAction: "pan-y" }}
        className={cn("relative bg-background transition-transform", !dragging.current && "duration-200 ease-out")}
      >
        {children}
      </div>
    </div>
  );
}
