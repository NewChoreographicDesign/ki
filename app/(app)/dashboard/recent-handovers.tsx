"use client";

import * as React from "react";
import { ChevronDown, Clock, ArrowLeftRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";

export type RecentHandover = {
  id: string;
  room: string;
  content: string;
  createdAt: string;
  userName: string;
};

/**
 * Replaces both the old "Actieve overdrachten" stat card and the always-open
 * 3-item preview list with a single collapsible section — closed by default
 * so the dashboard stays scannable, but opening it reveals the most recent
 * handover from every room (one per room, not the full history — see
 * DashboardPage) with the room visible on each entry.
 */
export function RecentHandovers({ handovers }: { handovers: RecentHandover[] }) {
  const [open, setOpen] = React.useState(false);

  return (
    <Card>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 bg-brand-gradient-soft p-5 text-left ring-1 ring-inset ring-sky-400/20 transition-colors hover:bg-sky-500/10"
      >
        <span className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-500/15 text-sky-400">
            <ArrowLeftRight className="h-5 w-5" />
          </span>
          <span className="flex flex-col">
            <span className="font-semibold text-slate-100">Recente overdrachten</span>
            <span className="text-xs text-slate-500">
              {handovers.length === 0
                ? "Geen overdrachtnotities"
                : `${handovers.length} notitie${handovers.length === 1 ? "" : "s"}`}
            </span>
          </span>
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <CardContent className="flex flex-col gap-3 pt-0">
          {handovers.length === 0 ? (
            <p className="text-slate-500">Geen actieve overdrachtnotities.</p>
          ) : (
            handovers.map((h) => (
              <div key={h.id} className="flex flex-col gap-1.5 rounded-lg border border-border bg-surface2/50 p-4">
                <div className="flex flex-wrap items-center gap-2 text-sm text-slate-400">
                  <Badge variant="slate">{h.room}</Badge>
                  <span className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    {formatDateTime(new Date(h.createdAt))}
                  </span>
                  <span>&middot; {h.userName}</span>
                </div>
                <p className="text-slate-200">{h.content}</p>
              </div>
            ))
          )}
        </CardContent>
      )}
    </Card>
  );
}
