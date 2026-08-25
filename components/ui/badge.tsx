import * as React from "react";
import { cn } from "@/lib/utils";

type Variant = "default" | "sky" | "emerald" | "amber" | "red" | "slate";

const variantClasses: Record<Variant, string> = {
  default: "bg-surface2 text-slate-200",
  sky: "bg-sky-500/15 text-sky-400",
  emerald: "bg-emerald-500/15 text-emerald-400",
  amber: "bg-amber-500/15 text-amber-400",
  red: "bg-red-500/15 text-red-400",
  slate: "bg-slate-500/15 text-slate-300",
};

export function Badge({
  className,
  variant = "default",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { variant?: Variant }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium",
        variantClasses[variant],
        className
      )}
      {...props}
    />
  );
}
