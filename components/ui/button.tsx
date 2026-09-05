import * as React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "danger" | "ghost" | "outline";
type Size = "default" | "lg" | "sm" | "icon";

const variantClasses: Record<Variant, string> = {
  primary: "bg-sky-500 text-white hover:bg-sky-600 active:bg-sky-600",
  secondary: "bg-emerald-500 text-white hover:bg-emerald-600 active:bg-emerald-600",
  danger: "bg-red-500/90 text-white hover:bg-red-500 active:bg-red-600",
  outline: "border border-border bg-transparent text-slate-100 hover:bg-surface2",
  ghost: "bg-transparent text-slate-200 hover:bg-surface2",
};

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
  ({ className, variant = "primary", size = "default", loading = false, disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-xl font-medium",
          "transition-[background-color,box-shadow,transform] duration-150 active:scale-[0.98]",
          "disabled:pointer-events-none disabled:opacity-50 disabled:active:scale-100",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        {...props}
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";
