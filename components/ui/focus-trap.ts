"use client";

import * as React from "react";

export const FOCUSABLE = 'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

/**
 * Traps Tab focus inside panelRef's subtree while `active`, moves initial
 * focus into it, restores focus to whatever triggered it on close, and
 * calls onEscape for the Escape key.
 */
export function useFocusTrap(active: boolean, panelRef: React.RefObject<HTMLElement | null>, onEscape: () => void) {
  const triggerRef = React.useRef<Element | null>(null);

  React.useEffect(() => {
    if (!active) return;
    triggerRef.current = document.activeElement;

    const panel = panelRef.current;
    const toFocus = panel?.querySelector<HTMLElement>(FOCUSABLE);
    (toFocus ?? panel)?.focus();

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onEscape();
        return;
      }
      if (e.key !== "Tab" || !panel) return;
      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      if (triggerRef.current instanceof HTMLElement) triggerRef.current.focus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);
}
