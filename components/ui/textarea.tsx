import * as React from "react";
import { cn } from "@/lib/utils";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          "w-full min-h-[120px] rounded-xl border border-border bg-surface2 px-4 py-3 text-base text-slate-100",
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
Textarea.displayName = "Textarea";
