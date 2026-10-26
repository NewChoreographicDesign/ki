"use client";

import * as React from "react";
import { toast } from "sonner";
import { ChevronDown, Clock, CheckCircle2, Users } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { formatDateTime } from "@/lib/utils";
import { InterventionPlanSection, type InterventionPlanRow } from "./intervention-plan-panel";

// Interventions and interventieplannen — unchanged behaviour, moved out of
// overdracht-manager.tsx when the handover notes got their own board
// (handover-board.tsx), matching Multi-Woongroep's split.

type InterventionNoteRow = {
  id: string;
  content: string;
  authorName: string;
  createdAt: string;
};

export type InterventionRow = {
  id: string;
  /** True when this covers every active client, instead of a hand-picked list. */
  wholeGroup: boolean;
  /** Empty when wholeGroup is true — the membership is implicit. */
  clients: { id: string; name: string; room: string | null }[];
  description: string;
  goal: string;
  stepsTaken: string;
  followUpNeeded: string;
  status: "OPEN" | "AFGEROND";
  createdByName: string;
  createdAt: string;
  closedByName: string | null;
  closedAt: string | null;
  notes: InterventionNoteRow[];
};

export function NewInterventionForm({
  clients,
  onSaved,
  onCancel,
}: {
  clients: { id: string; name: string; room: string | null }[];
  onSaved: () => void;
  onCancel: () => void;
}) {
  // Defaults to just the first client (the common case: one incident, one
  // resident) rather than none, so the form isn't blocked on a selection
  // most of the time — "hele groep" or picking more is an opt-in widen.
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(() => (clients[0] ? new Set([clients[0].id]) : new Set()));
  const [description, setDescription] = React.useState("");
  const [goal, setGoal] = React.useState("");
  const [stepsTaken, setStepsTaken] = React.useState("");
  const [followUpNeeded, setFollowUpNeeded] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  const allSelected = clients.length > 0 && selectedIds.size === clients.length;

  function toggleClient(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleWholeGroup(checked: boolean) {
    setSelectedIds(checked ? new Set(clients.map((c) => c.id)) : new Set());
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/interventions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          allSelected ? { wholeGroup: true, description, goal, stepsTaken, followUpNeeded } : { clientIds: [...selectedIds], description, goal, stepsTaken, followUpNeeded }
        ),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Opslaan mislukt");
        return;
      }
      toast.success(allSelected ? "Interventie aangemaakt voor de hele groep" : selectedIds.size > 1 ? `Interventie aangemaakt voor ${selectedIds.size} cliënten` : "Interventie aangemaakt");
      setDescription("");
      setGoal("");
      setStepsTaken("");
      setFollowUpNeeded("");
      onSaved();
    } catch {
      toast.error("Er is iets misgegaan");
    } finally {
      setLoading(false);
    }
  }

  if (clients.length === 0) {
    return <p className="text-slate-500">Geen actieve cliënten gevonden.</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-3 rounded-xl border border-border bg-surface2/40 p-4">
        <legend className="flex items-center gap-1.5 px-1 text-sm font-medium text-slate-300">
          <Users className="h-4 w-4" /> Voor wie is deze interventie?
        </legend>
        <Checkbox checked={allSelected} onChange={toggleWholeGroup} className="text-sm font-medium text-slate-200">
          Hele groep ({clients.length} cliënten)
        </Checkbox>
        <div className="flex max-h-56 flex-col gap-1 overflow-y-auto rounded-lg border border-border bg-surface1 p-2">
          {clients.map((c) => (
            <Checkbox key={c.id} checked={selectedIds.has(c.id)} onChange={() => toggleClient(c.id)} className="rounded-lg px-2 py-1.5 text-sm text-slate-200 hover:bg-surface2">
              {c.room ? `${c.room} · ${c.name}` : c.name}
            </Checkbox>
          ))}
        </div>
        {!allSelected && selectedIds.size > 1 && <p className="px-1 text-xs text-slate-500">Wordt geregistreerd als één interventie voor {selectedIds.size} cliënten.</p>}
      </fieldset>
      <div>
        <Label htmlFor="intervention-description">Wat is er gebeurd?</Label>
        <Textarea id="intervention-description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Beschrijf de situatie of aanleiding" className="min-h-[90px]" required />
      </div>
      <div>
        <Label htmlFor="intervention-goal">Doel van de interventie</Label>
        <Textarea id="intervention-goal" value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="Wat willen we bereiken?" className="min-h-[70px]" required />
      </div>
      <div>
        <Label htmlFor="intervention-steps">Genomen stappen</Label>
        <Textarea id="intervention-steps" value={stepsTaken} onChange={(e) => setStepsTaken(e.target.value)} placeholder="Wat is er tot nu toe al gedaan?" className="min-h-[70px]" required />
      </div>
      <div>
        <Label htmlFor="intervention-followup">Benodigde vervolgstappen</Label>
        <Textarea id="intervention-followup" value={followUpNeeded} onChange={(e) => setFollowUpNeeded(e.target.value)} placeholder="Wat moet er nog gebeuren?" className="min-h-[70px]" required />
      </div>
      <div className="flex gap-2">
        <Button type="submit" loading={loading} disabled={selectedIds.size === 0 || !description || !goal || !stepsTaken || !followUpNeeded} className="self-start">
          {allSelected ? "Interventie aanmaken voor hele groep" : selectedIds.size > 1 ? `Interventie aanmaken (${selectedIds.size} cliënten)` : "Interventie aanmaken"}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Annuleren
        </Button>
      </div>
    </form>
  );
}

// Shared "dropdown" row for an intervention — used both in the pinned
// "openstaande interventies" banner and the full Interventies list, so
// adding a follow-up or closing works identically in both places.
/** Compact header label: one client's "kamer · naam", "Hele groep", or a count for several. */
function interventionSubjectLabel(i: InterventionRow): string {
  if (i.wholeGroup) return "Hele groep";
  if (i.clients.length === 1) {
    const c = i.clients[0];
    return c.room ? `${c.room} · ${c.name}` : c.name;
  }
  return `${i.clients.length} cliënten`;
}

export function InterventionCard({ intervention: i, onChanged }: { intervention: InterventionRow; onChanged: () => void }) {
  const [open, setOpen] = React.useState(false);
  const [note, setNote] = React.useState("");
  const [savingNote, setSavingNote] = React.useState(false);
  const [closing, setClosing] = React.useState(false);
  const isOpen = i.status === "OPEN";

  async function handleAddNote(e: React.FormEvent) {
    e.preventDefault();
    setSavingNote(true);
    try {
      const res = await fetch(`/api/interventions/${i.id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: note }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Opslaan mislukt");
        return;
      }
      toast.success("Vervolgnotitie toegevoegd");
      setNote("");
      onChanged();
    } catch {
      toast.error("Er is iets misgegaan");
    } finally {
      setSavingNote(false);
    }
  }

  async function handleClose() {
    if (!window.confirm(`Interventie voor ${interventionSubjectLabel(i)} afronden? Dit kan niet ongedaan worden gemaakt.`)) {
      return;
    }
    setClosing(true);
    try {
      const res = await fetch(`/api/interventions/${i.id}/close`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Afronden mislukt");
        return;
      }
      toast.success("Interventie afgerond");
      onChanged();
    } catch {
      toast.error("Er is iets misgegaan");
    } finally {
      setClosing(false);
    }
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface2/50">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between gap-3 p-4 text-left transition-colors hover:bg-surface2">
        <span className="flex min-w-0 flex-col gap-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-slate-100">{interventionSubjectLabel(i)}</span>
            <Badge variant={isOpen ? "red" : "forest"}>{isOpen ? "Open" : "Afgerond"}</Badge>
            {(i.wholeGroup || i.clients.length > 1) && (
              <Badge variant="slate" className="flex items-center gap-1">
                <Users className="h-3 w-3" /> Groepsinterventie
              </Badge>
            )}
          </span>
          <span className="truncate text-sm text-slate-400">{i.goal}</span>
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="flex flex-col gap-4 border-t border-border p-4">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span>Aangemaakt door {i.createdByName}</span>
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {formatDateTime(new Date(i.createdAt))}
            </span>
            {!isOpen && i.closedByName && i.closedAt && (
              <span>
                · Afgerond door {i.closedByName} op {formatDateTime(new Date(i.closedAt))}
              </span>
            )}
          </div>

          {(i.wholeGroup || i.clients.length > 1) && (
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Betrokken cliënten</p>
              {i.wholeGroup ? (
                <p className="mt-1 text-sm text-slate-200">Hele groep (alle actieve cliënten)</p>
              ) : (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {i.clients.map((c) => (
                    <span key={c.id} className="rounded-full bg-surface1 px-2.5 py-1 text-xs text-slate-300">
                      {c.room ? `${c.room} · ${c.name}` : c.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Wat is er gebeurd?" value={i.description} />
            <Field label="Doel" value={i.goal} />
            <Field label="Genomen stappen" value={i.stepsTaken} />
            <Field label="Benodigde vervolgstappen" value={i.followUpNeeded} />
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Vervolgnotities ({i.notes.length})</p>
            {i.notes.length === 0 ? (
              <p className="text-sm text-slate-500">Nog geen vervolgnotities.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {i.notes.map((n) => (
                  <div key={n.id} className="rounded-lg border border-border bg-surface1 p-3 text-sm">
                    <div className="mb-1 flex items-center gap-2 text-xs text-slate-500">
                      <span>{n.authorName}</span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDateTime(new Date(n.createdAt))}
                      </span>
                    </div>
                    <p className="whitespace-pre-wrap text-slate-200">{n.content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {isOpen && (
            <div className="flex flex-col gap-3 border-t border-border pt-3">
              <form onSubmit={handleAddNote} className="flex flex-col gap-2">
                <Label htmlFor={`note-${i.id}`}>Vervolgnotitie toevoegen</Label>
                <Textarea id={`note-${i.id}`} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Wat is er sindsdien gedaan?" className="min-h-[70px]" required />
                <div className="flex gap-2">
                  <Button type="submit" size="sm" variant="outline" loading={savingNote} disabled={!note}>
                    Notitie toevoegen
                  </Button>
                  <Button type="button" size="sm" variant="ghost" loading={closing} onClick={handleClose}>
                    <CheckCircle2 className="h-4 w-4 text-forest-400" /> Interventie afronden
                  </Button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 whitespace-pre-wrap text-sm text-slate-200">{value}</p>
    </div>
  );
}

// One row per client in the Interventieplan tab — collapsed by default,
// same visual language as InterventionCard, but keyed to the client
// directly rather than to any particular Intervention.
export function ClientPlanCard({
  client,
  plans,
  onChanged,
}: {
  client: { id: string; name: string; room: string | null };
  plans: InterventionPlanRow[];
  onChanged: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const activePlan = plans.find((p) => p.status === "ACTIEF");
  const archivedCount = plans.filter((p) => p.status !== "ACTIEF").length;

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface2/50">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between gap-3 p-4 text-left transition-colors hover:bg-surface2">
        <span className="flex min-w-0 flex-col gap-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-slate-100">{client.room ? `${client.room} · ${client.name}` : client.name}</span>
            {activePlan ? (
              <Badge variant="forest">Actief — versie {activePlan.version}</Badge>
            ) : archivedCount > 0 ? (
              <Badge variant="slate">Gearchiveerd ({archivedCount})</Badge>
            ) : (
              <Badge variant="slate">Geen plan</Badge>
            )}
          </span>
          {activePlan && <span className="truncate text-sm text-slate-400">{activePlan.goal}</span>}
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="border-t border-border p-4">
          <InterventionPlanSection clientId={client.id} plans={plans} onChanged={onChanged} />
        </div>
      )}
    </div>
  );
}
