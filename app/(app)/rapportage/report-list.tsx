"use client";

import * as React from "react";
import { ChevronDown, ChevronRight, DoorOpen } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";

export type ReportRow = {
  id: string;
  clientName: string;
  room: string;
  shift: "MORNING" | "EVENING";
  createdAt: string;
  userName: string;
  content: string;
};

// Same room-grouped, two-level accordion as Protocollen: a room only shows
// date + author per report until one is clicked, so a busy week of reports
// doesn't read as a wall of text to scroll past.
export function ReportList({ reports }: { reports: ReportRow[] }) {
  const grouped = React.useMemo(() => groupByRoom(reports), [reports]);

  if (reports.length === 0) {
    return <p className="text-slate-500">Nog geen rapportages sinds afgelopen donderdag.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {grouped.map(({ room, items }) => (
        <RoomSection key={room} title={room} items={items} />
      ))}
    </div>
  );
}

function groupByRoom(reports: ReportRow[]) {
  const byRoom = new Map<string, ReportRow[]>();
  for (const r of reports) {
    const list = byRoom.get(r.room);
    if (list) list.push(r);
    else byRoom.set(r.room, [r]);
  }
  const rank = (room: string) => (room === "Geen kamer" ? 1 : 0);
  return Array.from(byRoom.entries())
    .map(([room, items]) => ({ room, items }))
    .sort((a, b) => rank(a.room) - rank(b.room) || a.room.localeCompare(b.room));
}

function RoomSection({ title, items }: { title: string; items: ReportRow[] }) {
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
            <DoorOpen className="h-5 w-5" />
          </span>
          <span className="flex flex-col">
            <span className="font-semibold text-slate-100">{title}</span>
            <span className="text-xs text-slate-500">
              {items.length} rapportage{items.length === 1 ? "" : "s"}
            </span>
          </span>
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <CardContent className="flex flex-col gap-2 pt-3">
          {items.map((r) => (
            <ReportRowItem key={r.id} report={r} />
          ))}
        </CardContent>
      )}
    </Card>
  );
}

function ReportRowItem({ report }: { report: ReportRow }) {
  const [open, setOpen] = React.useState(false);

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface2/50 transition-colors hover:border-sky-500/30">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2.5 p-3.5 text-left"
      >
        <ChevronRight className={`h-4 w-4 shrink-0 text-sky-400 transition-transform ${open ? "rotate-90" : ""}`} />
        <span className="font-medium text-slate-100">{formatDateTime(new Date(report.createdAt))}</span>
        <span className="text-sm text-slate-500">{report.userName}</span>
      </button>
      {open && (
        <div className="flex flex-col gap-2 border-t border-border bg-surface p-4">
          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-400">
            <span className="font-medium text-slate-200">{report.clientName}</span>
            <Badge variant={report.shift === "MORNING" ? "sky" : "emerald"}>
              {report.shift === "MORNING" ? "Ochtend" : "Avond"}
            </Badge>
          </div>
          <p className="whitespace-pre-wrap text-slate-200">{report.content}</p>
        </div>
      )}
    </div>
  );
}
