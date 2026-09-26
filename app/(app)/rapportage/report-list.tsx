"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, DoorOpen } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { formatDateTime, formatDDMMYYYY, shiftLabel, shiftBadgeVariant } from "@/lib/utils";

export type ReportRow = {
  id: string;
  clientId: string;
  clientName: string;
  room: string;
  shift: "MORNING" | "EVENING" | "NIGHT";
  date: string;
  createdAt: string;
  userName: string;
  content: string;
  /** Own report, still inside the author's edit window — see lib/report-window.ts. */
  editable: boolean;
};

type ClientOption = { id: string; name: string; room: string | null };

// Same room-grouped, two-level accordion as Protocollen: a room only shows
// date + author per report until one is clicked, so a busy week of reports
// doesn't read as a wall of text to scroll past.
export function ReportList({
  reports,
  clients,
  emptyMessage,
}: {
  reports: ReportRow[];
  clients: ClientOption[];
  emptyMessage: string;
}) {
  const grouped = React.useMemo(() => groupByRoom(reports), [reports]);

  if (reports.length === 0) {
    return <p className="text-slate-500">{emptyMessage}</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {grouped.map(({ room, items }) => (
        <RoomSection key={room} title={room} items={items} clients={clients} />
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

function RoomSection({ title, items, clients }: { title: string; items: ReportRow[]; clients: ClientOption[] }) {
  const [open, setOpen] = React.useState(false);

  return (
    <Card>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 bg-brand-gradient-soft p-5 text-left ring-1 ring-inset ring-rose-400/20 transition-colors hover:bg-rose-500/10"
      >
        <span className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-500/15 text-rose-400">
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
            <ReportRowItem key={r.id} report={r} clients={clients} />
          ))}
        </CardContent>
      )}
    </Card>
  );
}

function ReportRowItem({ report, clients }: { report: ReportRow; clients: ClientOption[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState(false);

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface2/50 transition-colors hover:border-rose-500/30">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2.5 p-3.5 text-left"
      >
        <ChevronRight className={`h-4 w-4 shrink-0 text-rose-400 transition-transform ${open ? "rotate-90" : ""}`} />
        <span className="font-medium text-slate-100">{formatDateTime(new Date(report.createdAt))}</span>
        <span className="text-sm text-slate-500">{report.userName}</span>
      </button>
      {open && (
        <div className="flex flex-col gap-2 border-t border-border bg-surface p-4">
          {editing ? (
            <ReportEditForm
              report={report}
              clients={clients}
              onDone={(saved) => {
                setEditing(false);
                if (saved) router.refresh();
              }}
            />
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2 text-sm text-slate-400">
                <span className="font-medium text-slate-200">{report.clientName}</span>
                <Badge variant={shiftBadgeVariant(report.shift)}>{shiftLabel(report.shift)}</Badge>
              </div>
              <p className="whitespace-pre-wrap text-slate-200">{report.content}</p>
              {report.editable && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-1 self-start"
                  onClick={() => setEditing(true)}
                >
                  Aanpassen
                </Button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function ReportEditForm({
  report,
  clients,
  onDone,
}: {
  report: ReportRow;
  clients: ClientOption[];
  onDone: (saved: boolean) => void;
}) {
  const [clientId, setClientId] = React.useState(report.clientId);
  const [shift, setShift] = React.useState(report.shift);
  const [date, setDate] = React.useState(formatDDMMYYYY(new Date(report.date)));
  const [content, setContent] = React.useState(report.content);
  const [loading, setLoading] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`/api/reports/${report.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, shift, date, content }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Aanpassen mislukt");
        return;
      }
      toast.success("Rapportage aangepast");
      onDone(true);
    } catch {
      toast.error("Er is iets misgegaan");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <Label htmlFor={`edit-client-${report.id}`}>Cliënt</Label>
          <Select id={`edit-client-${report.id}`} value={clientId} onChange={(e) => setClientId(e.target.value)} required>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.room ? `${c.room} · ${c.name}` : c.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor={`edit-shift-${report.id}`}>Dienst</Label>
          <Select
            id={`edit-shift-${report.id}`}
            value={shift}
            onChange={(e) => setShift(e.target.value as "MORNING" | "EVENING" | "NIGHT")}
          >
            <option value="MORNING">Ochtend</option>
            <option value="EVENING">Avond</option>
            <option value="NIGHT">Nacht</option>
          </Select>
        </div>
        <div>
          <Label htmlFor={`edit-date-${report.id}`}>Datum</Label>
          <Input
            id={`edit-date-${report.id}`}
            inputMode="numeric"
            placeholder="DD-MM-JJJJ"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </div>
      </div>
      <div>
        <Label htmlFor={`edit-content-${report.id}`}>Rapportage</Label>
        <Textarea
          id={`edit-content-${report.id}`}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="min-h-[120px]"
          required
        />
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm" loading={loading}>
          Opslaan
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => onDone(false)}>
          Annuleren
        </Button>
      </div>
    </form>
  );
}
