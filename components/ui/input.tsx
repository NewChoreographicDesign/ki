import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          "h-12 w-full rounded-xl border border-border bg-surface2 px-4 text-base text-slate-100",
          "transition-[border-color,box-shadow] duration-150",
          "placeholder:text-slate-500",
          "hover:border-slate-500/50",
          "focus-visible:outline-none focus-visible:border-sky-400/60 focus-visible:shadow-glow-sky",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";
