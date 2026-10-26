"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/** A small dropdown panel under a trigger: closes on outside click and Escape, returns focus to the trigger. */
export function Popover({
  label,
  trigger,
  children,
  align = "right",
  className,
}: {
  label: string;
  trigger: (props: { open: boolean; toggle: () => void; ref: React.RefObject<HTMLButtonElement | null>; id: string }) => React.ReactNode;
  children: React.ReactNode | ((close: () => void) => React.ReactNode);
  align?: "left" | "right";
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const id = React.useId();

  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const close = () => setOpen(false);
  return (
    <div ref={wrapRef} className="relative">
      {trigger({ open, toggle: () => setOpen((v) => !v), ref: triggerRef, id })}
      {open && (
        <div
          id={id}
          role="dialog"
          aria-label={label}
          className={cn(
            "absolute top-full z-30 mt-2 w-[min(20rem,calc(100vw-2rem))] animate-scale-in rounded-2xl border border-border bg-surface p-3 shadow-lift",
            align === "right" ? "right-0" : "left-0",
            className
          )}
        >
          {typeof children === "function" ? children(close) : children}
        </div>
      )}
    </div>
  );
}
