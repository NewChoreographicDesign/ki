"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "onChange" | "checked"> {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Label text — wraps the box in a clickable <label>. Omit for a standalone box (pass aria-label instead, e.g. a row-select checkbox). */
  children?: React.ReactNode;
  /** "amber" for a warning-flavored toggle (e.g. high-risk medication) — everything else stays the rose action color. */
  variant?: "rose" | "amber";
}

/**
 * The on-brand replacement for a plain <input type="checkbox"> — a real
 * checked square + check mark reads consistently everywhere and matches
 * the rest of the design system. The native input is still there (a11y,
 * keyboard, form semantics) — just visually hidden under the styled box
 * via the peer pattern.
 */
export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(({ checked, onChange, disabled, id, className, children, variant = "rose", ...props }, ref) => {
  const box = (
    <span className="relative inline-flex h-5 w-5 shrink-0 items-center justify-center">
      <input
        ref={ref}
        type="checkbox"
        id={id}
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className={cn("peer absolute inset-0 h-5 w-5 cursor-pointer opacity-0 disabled:cursor-not-allowed", !children && className)}
        {...props}
      />
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none flex h-5 w-5 items-center justify-center rounded-md border transition-colors",
          checked
            ? variant === "amber"
              ? "border-amber-500 bg-amber-500"
              : "border-rose-500 bg-rose-500"
            : "border-border bg-surface2",
          "peer-hover:border-slate-500/50",
          "peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-rose-400 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background",
          "peer-disabled:opacity-50"
        )}
      >
        {checked && <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />}
      </span>
    </span>
  );

  if (!children) return box;

  return (
    <label className={cn("inline-flex cursor-pointer items-center gap-2", disabled && "cursor-not-allowed opacity-50", className)}>
      {box}
      {children}
    </label>
  );
});
Checkbox.displayName = "Checkbox";
