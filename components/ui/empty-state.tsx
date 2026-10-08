import * as React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * A plain "Geen …" line reads as unfinished, not as "correctly nothing
 * here" — an icon gives the empty state visual weight similar to a filled
 * one, and the optional action turns a dead end into a next step. Kept as
 * a single shared component (icon + message + optional CTA) rather than
 * hand-rolled per page, both for consistency and so new empty states don't
 * default back to a bare text line.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex animate-fade-in flex-col items-center gap-3 rounded-2xl border border-dashed border-border px-6 py-10 text-center",
        className
      )}
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-surface2 text-slate-500">
        <Icon className="h-6 w-6" />
      </span>
      <div className="flex flex-col gap-1">
        <p className="font-medium text-slate-300">{title}</p>
        {description && <p className="text-sm text-slate-500">{description}</p>}
      </div>
      {action && (
        <Button size="sm" variant="outline" onClick={action.onClick} className="mt-1">
          {action.label}
        </Button>
      )}
    </div>
  );
}
