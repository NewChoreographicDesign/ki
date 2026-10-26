"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Compact single-choice control (radiogroup) with big touch targets — the
 * tablet-friendly replacement for a 2–4 option <select>. Arrow keys move the
 * selection like a native radio group.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  className,
  size = "md",
}: {
  options: { value: T; label: string; icon?: React.ReactNode }[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  className?: string;
  size?: "sm" | "md";
}) {
  const refs = React.useRef<(HTMLButtonElement | null)[]>([]);

  function onKeyDown(e: React.KeyboardEvent, index: number) {
    let next = index;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (index + 1) % options.length;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = (index - 1 + options.length) % options.length;
    else return;
    e.preventDefault();
    onChange(options[next].value);
    refs.current[next]?.focus();
  }

  return (
    <div role="radiogroup" aria-label={ariaLabel} className={cn("inline-flex rounded-xl border border-border bg-surface2 p-1", className)}>
      {options.map((o, i) => {
        const selected = o.value === value;
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cn(
              "inline-flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 font-medium transition-colors",
              size === "md" ? "h-10 text-sm" : "h-8 text-xs",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400",
              selected ? "bg-brand-gradient text-white shadow-sm" : "text-slate-300 hover:bg-surface hover:text-slate-100"
            )}
          >
            {o.icon}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
