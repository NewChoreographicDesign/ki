"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export function Card({
  className,
  interactive = false,
  onMouseMove,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  /** Adds a hover lift + border glow for cards that are themselves a click target (e.g. wrapped in a Link). */
  interactive?: boolean;
}) {
  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (interactive) {
      const rect = e.currentTarget.getBoundingClientRect();
      e.currentTarget.style.setProperty("--spot-x", `${e.clientX - rect.left}px`);
      e.currentTarget.style.setProperty("--spot-y", `${e.clientY - rect.top}px`);
    }
    onMouseMove?.(e);
  }

  return (
    <div
      onMouseMove={handleMouseMove}
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-border bg-surface shadow-sm transition-[transform,box-shadow,border-color] duration-200",
        interactive && "hover:-translate-y-0.5 hover:border-sky-500/40 hover:shadow-lift",
        className
      )}
      {...props}
    >
      {interactive && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          style={{
            background: "radial-gradient(220px circle at var(--spot-x, 50%) var(--spot-y, 50%), rgba(56,189,248,0.08), transparent 70%)",
          }}
        />
      )}
      {children}
    </div>
  );
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("relative flex flex-col gap-1 p-5 pb-0", className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("text-lg font-semibold text-slate-50", className)} {...props} />;
}

export function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-sm text-slate-400", className)} {...props} />;
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("relative p-5", className)} {...props} />;
}

export function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("relative flex items-center gap-3 p-5 pt-0", className)} {...props} />;
}
