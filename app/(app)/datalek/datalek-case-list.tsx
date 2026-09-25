"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, AlertTriangle } from "lucide-react";
import { cn, formatDateTime } from "@/lib/utils";

type Severity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
type Status = "NEW" | "ASSESSED" | "AP_NOTIFIED" | "DATA_SUBJECTS_NOTIFIED" | "CLOSED";

export type DatalekRow = {
  id: string;
  title: string;
  severity: Severity;
  status: Status;
  detectedAt: string;
  affectedPersonsEstimate: number | null;
  likelyRisk: boolean | null;
  overdue: boolean;
};

type NoteRow = { id: string; authorName: string; body: string; createdAt: string };

type DatalekDetail = {
  id: string;
  title: string;
  description: string;
  affectedData: string;
  affectedPersonsEstimate: number | null;
  severity: Severity;
  status: Status;
  detectedAt: string;
  likelyRisk: boolean | null;
  apNotifiedAt: string | null;
  apReference: string | null;
  dataSubjectsNotifiedAt: string | null;
  closedAt: string | null;
  closedSummary: string | null;
  reportedByName: string;
  deadline: string | null;
  overdue: boolean;
  canManage: boolean;
  notes: NoteRow[];
};

const SEVERITY_LABEL: Record<Severity, string> = { LOW: "Laag", MEDIUM: "Middel", HIGH: "Hoog", CRITICAL: "Kritiek" };
const SEVERITY_VARIANT: Record<Severity, "slate" | "amber" | "red" | "rose"> = {
  LOW: "slate",
  MEDIUM: "amber",
  HIGH: "red",
  CRITICAL: "rose",
};

const STATUS_LABEL: Record<Status, string> = {
  NEW: "Nieuw",
  ASSESSED: "Beoordeeld",
  AP_NOTIFIED: "Gemeld bij AP",
  DATA_SUBJECTS_NOTIFIED: "Betrokkenen geïnformeerd",
  CLOSED: "Afgesloten",
};
const STATUS_VARIANT: Record<Status, "amber" | "rose" | "forest" | "slate"> = {
  NEW: "amber",
  ASSESSED: "amber",
  AP_NOTIFIED: "rose",
  DATA_SUBJECTS_NOTIFIED: "rose",
  CLOSED: "forest",
};

function DeadlineBadge({ deadline, overdue }: { deadline: string | null; overdue: boolean }) {
  if (!deadline) return null;
  return (
    <Badge variant={overdue ? "rose" : "amber"}>
      {overdue ? "72u-termijn AP-melding verstreken" : `Meldtermijn AP: ${formatDateTime(new Date(deadline))}`}
    </Badge>
  );
}

export function DatalekCaseList({ incidents }: { incidents: DatalekRow[] }) {
  const [expandedId, setExpandedId] = React.useState<string | null>(null);

  if (incidents.length === 0) {
    return (
      <Card>
        <CardContent className="p-5 text-sm text-slate-500">Nog geen datalekken gemeld.</CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {incidents.map((row) => (
        <DatalekCaseRow
          key={row.id}
          row={row}
          expanded={expandedId === row.id}
          onToggle={() => setExpandedId((current) => (current === row.id ? null : row.id))}
        />
      ))}
    </div>
  );
}

function DatalekCaseRow({
  row,
  expanded,
  onToggle,
}: {
  row: DatalekRow;
  expanded: boolean;
  onToggle: () => void;
}) {
  const router = useRouter();
  const [detail, setDetail] = React.useState<DatalekDetail | null>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!expanded || detail) return;
    setLoading(true);
    fetch(`/api/datalek/${row.id}`)
      .then((res) => res.json())
      .then((data) => setDetail(data.incident ?? null))
      .catch(() => toast.error("Laden mislukt"))
      .finally(() => setLoading(false));
  }, [expanded, detail, row.id]);

  function refreshDetail() {
    setDetail(null);
    router.refresh();
  }

  return (
    <Card>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full flex-col gap-2 p-4 text-left sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={SEVERITY_VARIANT[row.severity]}>{SEVERITY_LABEL[row.severity]}</Badge>
            <Badge variant={STATUS_VARIANT[row.status]}>{STATUS_LABEL[row.status]}</Badge>
            {row.overdue && row.status !== "AP_NOTIFIED" && row.status !== "DATA_SUBJECTS_NOTIFIED" && row.status !== "CLOSED" && (
              <span className="flex items-center gap-1 text-xs font-medium text-rose-400">
                <AlertTriangle className="h-3.5 w-3.5" />
                72u-termijn verstreken
              </span>
            )}
          </div>
          <p className="font-medium text-slate-100">{row.title}</p>
          <p className="text-xs text-slate-500">
            Ontdekt op {formatDateTime(new Date(row.detectedAt))}
            {row.affectedPersonsEstimate !== null ? ` · ~${row.affectedPersonsEstimate} betrokkenen` : ""}
          </p>
        </div>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-slate-500 transition-transform", expanded && "rotate-180")} />
      </button>
      {expanded && (
        <CardContent className="border-t border-border pt-4">
          {loading || !detail ? (
            <p className="text-sm text-slate-500">Laden…</p>
          ) : (
            <DatalekDetailView detail={detail} onChanged={refreshDetail} />
          )}
        </CardContent>
      )}
    </Card>
  );
}

function DatalekDetailView({ detail, onChanged }: { detail: DatalekDetail; onChanged: () => void }) {
  const [noteBody, setNoteBody] = React.useState("");
  const [savingNote, setSavingNote] = React.useState(false);
  const [managing, setManaging] = React.useState(false);
  const [likelyRisk, setLikelyRisk] = React.useState<string>(
    detail.likelyRisk === null ? "" : detail.likelyRisk ? "true" : "false"
  );
  const [apReference, setApReference] = React.useState(detail.apReference ?? "");
  const [closedSummary, setClosedSummary] = React.useState(detail.closedSummary ?? "");

  async function patch(body: Record<string, unknown>, successMessage: string) {
    setManaging(true);
    try {
      const res = await fetch(`/api/datalek/${detail.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Bijwerken mislukt");
        return;
      }
      toast.success(successMessage);
      onChanged();
    } catch {
      toast.error("Er is iets misgegaan");
    } finally {
      setManaging(false);
    }
  }

  async function addNote(e: React.FormEvent) {
    e.preventDefault();
    setSavingNote(true);
    try {
      const res = await fetch(`/api/datalek/${detail.id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: noteBody }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Toevoegen mislukt");
        return;
      }
      setNoteBody("");
      onChanged();
    } catch {
      toast.error("Er is iets misgegaan");
    } finally {
      setSavingNote(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <DeadlineBadge deadline={detail.deadline} overdue={detail.overdue} />
      <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Wat is er gebeurd</p>
          <p className="mt-1 text-slate-200">{detail.description}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Geraakte gegevens</p>
          <p className="mt-1 text-slate-200">{detail.affectedData}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Gemeld door</p>
          <p className="mt-1 text-slate-200">{detail.reportedByName}</p>
        </div>
        {detail.apNotifiedAt && (
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Gemeld bij AP</p>
            <p className="mt-1 text-slate-200">
              {formatDateTime(new Date(detail.apNotifiedAt))}
              {detail.apReference ? ` — referentie ${detail.apReference}` : ""}
            </p>
          </div>
        )}
        {detail.dataSubjectsNotifiedAt && (
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Betrokkenen geïnformeerd</p>
            <p className="mt-1 text-slate-200">{formatDateTime(new Date(detail.dataSubjectsNotifiedAt))}</p>
          </div>
        )}
        {detail.closedSummary && (
          <div className="sm:col-span-2">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Afsluitende samenvatting</p>
            <p className="mt-1 text-slate-200">{detail.closedSummary}</p>
          </div>
        )}
      </div>

      {detail.canManage && detail.status !== "CLOSED" && (
        <div className="flex flex-col gap-3 rounded-md border border-border bg-surface2 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">AVG-afhandeling</p>

          {detail.status === "NEW" && (
            <div className="flex flex-wrap items-end gap-2">
              <div>
                <label className="text-xs text-slate-500">Risico voor betrokkenen waarschijnlijk?</label>
                <Select value={likelyRisk} onChange={(e) => setLikelyRisk(e.target.value)}>
                  <option value="">— kiezen —</option>
                  <option value="true">Ja, waarschijnlijk risico</option>
                  <option value="false">Nee, onwaarschijnlijk (geen meldplicht AP)</option>
                </Select>
              </div>
              <Button
                type="button"
                size="sm"
                loading={managing}
                disabled={likelyRisk === ""}
                onClick={() => patch({ status: "ASSESSED", likelyRisk: likelyRisk === "true" }, "Beoordeling vastgelegd")}
              >
                Beoordeling vastleggen
              </Button>
            </div>
          )}

          {detail.status === "ASSESSED" && detail.likelyRisk && (
            <div className="flex flex-wrap items-end gap-2">
              <div>
                <label className="text-xs text-slate-500">AP-referentienummer (optioneel)</label>
                <Input value={apReference} onChange={(e) => setApReference(e.target.value)} placeholder="bijv. AP-2026-..." />
              </div>
              <Button
                type="button"
                size="sm"
                loading={managing}
                onClick={() =>
                  patch(
                    { status: "AP_NOTIFIED", apNotifiedAt: new Date().toISOString(), apReference },
                    "Gemarkeerd als gemeld bij de Autoriteit Persoonsgegevens"
                  )
                }
              >
                Markeer als gemeld bij AP
              </Button>
            </div>
          )}

          {(detail.status === "AP_NOTIFIED" || (detail.status === "ASSESSED" && detail.likelyRisk === false)) && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              loading={managing}
              onClick={() =>
                patch(
                  { status: "DATA_SUBJECTS_NOTIFIED", dataSubjectsNotifiedAt: new Date().toISOString() },
                  "Gemarkeerd als betrokkenen geïnformeerd"
                )
              }
            >
              Markeer betrokkenen als geïnformeerd
            </Button>
          )}

          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[240px] flex-1">
              <label className="text-xs text-slate-500">Afsluitende samenvatting</label>
              <Textarea value={closedSummary} onChange={(e) => setClosedSummary(e.target.value)} placeholder="Wat is er ondernomen, wat is het resultaat" />
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              loading={managing}
              disabled={!closedSummary.trim()}
              onClick={() => patch({ status: "CLOSED", closedSummary }, "Datalek afgesloten")}
            >
              Afsluiten
            </Button>
          </div>
        </div>
      )}

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Tijdlijn</p>
        <div className="mt-2 flex flex-col gap-2">
          {detail.notes.length === 0 ? (
            <p className="text-sm text-slate-500">Nog geen aantekeningen.</p>
          ) : (
            detail.notes.map((note) => (
              <div key={note.id} className="rounded-md bg-surface2 p-2.5 text-sm">
                <p className="text-slate-200">{note.body}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {note.authorName} · {formatDateTime(new Date(note.createdAt))}
                </p>
              </div>
            ))
          )}
        </div>
        <form onSubmit={addNote} className="mt-2 flex flex-col gap-2 sm:flex-row">
          <Textarea
            value={noteBody}
            onChange={(e) => setNoteBody(e.target.value)}
            placeholder="Aantekening toevoegen…"
            className="flex-1"
          />
          <Button type="submit" size="sm" loading={savingNote} disabled={!noteBody.trim()} className="self-start">
            Toevoegen
          </Button>
        </form>
      </div>
    </div>
  );
}
