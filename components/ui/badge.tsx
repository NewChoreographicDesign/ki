import * as React from "react";
import { cn } from "@/lib/utils";

type Variant = "default" | "rose" | "forest" | "amber" | "red" | "slate";

const variantClasses: Record<Variant, string> = {
  default: "bg-surface2 text-slate-200",
  rose: "bg-rose-500/15 text-rose-400",
  forest: "bg-forest-500/15 text-forest-400",
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
