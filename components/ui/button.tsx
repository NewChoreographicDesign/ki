"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "danger" | "ghost" | "outline";
type Size = "default" | "lg" | "sm" | "icon";

const variantClasses: Record<Variant, string> = {
  primary: "bg-brand-gradient text-white hover:shadow-glow-sky hover:brightness-110 active:brightness-95",
  secondary: "bg-emerald-500 text-white hover:bg-emerald-600 hover:shadow-glow-emerald active:bg-emerald-600",
  danger: "bg-red-500/90 text-white hover:bg-red-500 active:bg-red-600",
  outline: "border border-border bg-transparent text-slate-100 hover:bg-surface2 hover:border-slate-500/50",
  ghost: "bg-transparent text-slate-200 hover:bg-surface2",
};

// Only the filled, colorful CTAs get the cursor-tracked sheen — it reads as
// a considered detail against a saturated background, but would just look
// like visual noise on a plain outline/ghost/danger button.
const SPOTLIGHT_VARIANTS: Variant[] = ["primary", "secondary"];

const sizeClasses: Record<Size, string> = {
  default: "h-11 px-5 text-sm",
  lg: "h-14 px-8 text-base",
  sm: "h-9 px-3 text-sm",
  icon: "h-11 w-11",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  /** Shows a spinner in place of the icon slot and disables the button — pass instead of
   * juggling `disabled` + swapping label text by hand at every call site. */
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "default", loading = false, disabled, children, onMouseMove, ...props }, ref) => {
    const spotlight = SPOTLIGHT_VARIANTS.includes(variant);

    function handleMouseMove(e: React.MouseEvent<HTMLButtonElement>) {
      if (spotlight) {
        const rect = e.currentTarget.getBoundingClientRect();
        e.currentTarget.style.setProperty("--spot-x", `${e.clientX - rect.left}px`);
        e.currentTarget.style.setProperty("--spot-y", `${e.clientY - rect.top}px`);
      }
      onMouseMove?.(e);
    }

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        onMouseMove={handleMouseMove}
        className={cn(
          "group relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-xl font-medium",
          "transition-[background-color,box-shadow,transform,filter,border-color] duration-150 active:scale-[0.98]",
          "disabled:pointer-events-none disabled:opacity-50 disabled:active:scale-100",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        {...props}
      >
        {spotlight && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
            style={{
              background: "radial-gradient(140px circle at var(--spot-x, 50%) var(--spot-y, 50%), rgba(255,255,255,0.3), transparent 70%)",
            }}
          />
        )}
        {loading && <Loader2 className="relative h-4 w-4 animate-spin" />}
        <span className="relative inline-flex items-center gap-2">{children}</span>
      </button>
    );
  }
);
Button.displayName = "Button";
