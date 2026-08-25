import * as React from "react";
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
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "default", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-colors",
          "disabled:pointer-events-none disabled:opacity-50",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
