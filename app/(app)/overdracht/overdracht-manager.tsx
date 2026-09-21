"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, ChevronDown, Trash2, Clock, DoorOpen, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { formatDateTime, shiftLabel, shiftBadgeVariant } from "@/lib/utils";

export type HandoverRow = {
  id: string;
  content: string;
  shift: "MORNING" | "EVENING" | "NIGHT";
  userName: string;
  createdAt: string;
  expiresAt: string;
  clientName: string | null;
  /** Client's room, "Geen kamer" if the client has none, or null when this is a general note. */
  room: string | null;
};

export type InterventionNoteRow = {
  id: string;
  content: string;
  authorName: string;
  createdAt: string;
};

export type InterventionRow = {
  id: string;
  clientName: string;
  room: string | null;
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

const ALGEMEEN = "Algemeen";

type View = "overdracht" | "interventies";

export function OverdrachtManager({
  handovers,
  interventions,
  clients,
  canDelete,
}: {
  handovers: HandoverRow[];
  interventions: InterventionRow[];
  clients: { id: string; name: string; room: string | null }[];
  canDelete: boolean;
}) {
  const router = useRouter();
  const [view, setView] = React.useState<View>("overdracht");
  const [formOpen, setFormOpen] = React.useState(false);
  const [interventionFormOpen, setInterventionFormOpen] = React.useState(false);

  const grouped = React.useMemo(() => groupByRoom(handovers), [handovers]);
  const openInterventions = React.useMemo(() => interventions.filter((i) => i.status === "OPEN"), [interventions]);

  function refresh() {
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      {openInterventions.length > 0 && (
        <Card className="border-rose-500/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4.5 w-4.5 text-rose-400" />
              Openstaande interventies ({openInterventions.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {openInterventions.map((i) => (
              <InterventionCard key={i.id} intervention={i} onChanged={refresh} />
            ))}
          </CardContent>
        </Card>
      )}

      <div className="flex gap-2 border-b border-border">
        <button
          type="button"
          onClick={() => setView("overdracht")}
          className={`px-1 pb-3 text-sm font-medium transition-colors ${
            view === "overdracht" ? "border-b-2 border-rose-400 text-slate-100" : "text-slate-500 hover:text-slate-300"
          }`}
        >
          Overdracht
        </button>
        <button
          type="button"
          onClick={() => setView("interventies")}
          className={`px-1 pb-3 text-sm font-medium transition-colors ${
            view === "interventies" ? "border-b-2 border-rose-400 text-slate-100" : "text-slate-500 hover:text-slate-300"
          }`}
        >
          Interventies ({interventions.length})
        </button>
      </div>

      {view === "overdracht" && (
        <>
          <div>
            {!formOpen && (
              <div className="mb-3 flex justify-end">
                <Button size="sm" variant="outline" onClick={() => setFormOpen(true)}>
                  <Plus className="h-4 w-4" /> Nieuwe overdracht
                </Button>
              </div>
            )}
            {formOpen && (
              <Card>
                <CardHeader>
                  <CardTitle>Nieuwe overdracht</CardTitle>
                </CardHeader>
                <CardContent>
                  <NewHandoverForm
                    clients={clients}
                    onSaved={() => {
                      setFormOpen(false);
                      refresh();
                    }}
                    onCancel={() => setFormOpen(false)}
                  />
                </CardContent>
              </Card>
            )}
          </div>

          <div className="flex flex-col gap-3">
            {grouped.rooms.length === 0 && grouped.algemeen.length === 0 ? (
              <p className="text-slate-500">Geen actieve overdrachtnotities.</p>
            ) : (
              <>
                {grouped.rooms.map(({ room, items }) => (
                  <RoomSection key={room} title={room} items={items} canDelete={canDelete} router={router} />
                ))}
                {grouped.algemeen.length > 0 && (
                  <RoomSection title={ALGEMEEN} items={grouped.algemeen} canDelete={canDelete} router={router} />
                )}
              </>
            )}
          </div>
        </>
      )}

      {view === "interventies" && (
        <>
          <div>
            {!interventionFormOpen && (
              <div className="mb-3 flex justify-end">
                <Button size="sm" variant="outline" onClick={() => setInterventionFormOpen(true)}>
                  <Plus className="h-4 w-4" /> Nieuwe interventie
                </Button>
              </div>
            )}
            {interventionFormOpen && (
              <Card>
                <CardHeader>
                  <CardTitle>Nieuwe interventie</CardTitle>
                </CardHeader>
                <CardContent>
                  <NewInterventionForm
                    clients={clients}
                    onSaved={() => {
                      setInterventionFormOpen(false);
                      refresh();
                    }}
                    onCancel={() => setInterventionFormOpen(false)}
                  />
                </CardContent>
              </Card>
            )}
          </div>

          <div className="flex flex-col gap-3">
            {interventions.length === 0 ? (
              <p className="text-slate-500">Nog geen interventies geregistreerd.</p>
            ) : (
              interventions.map((i) => <InterventionCard key={i.id} intervention={i} onChanged={refresh} />)
            )}
          </div>
        </>
      )}
    </div>
  );
}

// Same grouping convention as protocollen: real rooms first (alphabetically)
// then "Geen kamer"; general (no client) notes get their own Algemeen section.
function groupByRoom(handovers: HandoverRow[]) {
  const byRoom = new Map<string, HandoverRow[]>();
  const algemeen: HandoverRow[] = [];
  for (const h of handovers) {
    if (h.room === null) {
      algemeen.push(h);
      continue;
    }
    const list = byRoom.get(h.room);
    if (list) list.push(h);
    else byRoom.set(h.room, [h]);
  }
  const rank = (room: string) => (room === "Geen kamer" ? 1 : 0);
  const rooms = Array.from(byRoom.entries())
    .map(([room, items]) => ({ room, items }))
    .sort((a, b) => rank(a.room) - rank(b.room) || a.room.localeCompare(b.room));
  return { rooms, algemeen };
}

function RoomSection({
  title,
  items,
  canDelete,
  router,
}: {
  title: string;
  items: HandoverRow[];
  canDelete: boolean;
  router: ReturnType<typeof useRouter>;
}) {
  const [open, setOpen] = React.useState(false);

  async function handleDelete(id: string) {
    if (!window.confirm("Deze overdracht verwijderen? Dit kan niet ongedaan worden gemaakt.")) {
      return;
    }
    try {
      const res = await fetch(`/api/handovers/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Overdracht verwijderd");
      router.refresh();
    } catch {
      toast.error("Verwijderen mislukt");
    }
  }

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
              {items.length} overdracht{items.length === 1 ? "" : "en"}
            </span>
          </span>
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <CardContent className="flex flex-col gap-3 pt-3">
          {items.map((h) => (
            <div
              key={h.id}
              className="flex flex-col gap-2 rounded-xl border border-border bg-surface2/50 p-4 transition-colors hover:border-rose-500/30"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2 text-sm text-slate-400">
                  <Badge variant={shiftBadgeVariant(h.shift)}>{shiftLabel(h.shift)}</Badge>
                  {h.clientName && <span className="text-slate-300">{h.clientName}</span>}
                  <span>{h.userName}</span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {formatDateTime(new Date(h.createdAt))}
                  </span>
                  <span className="text-slate-600">vervalt {formatDateTime(new Date(h.expiresAt))}</span>
                </div>
                {canDelete && (
                  <Button size="icon" variant="ghost" onClick={() => handleDelete(h.id)} aria-label="Verwijderen">
                    <Trash2 className="h-5 w-5 text-red-400" />
                  </Button>
                )}
              </div>
              <p className="whitespace-pre-wrap text-slate-200">{h.content}</p>
            </div>
          ))}
        </CardContent>
      )}
    </Card>
  );
}

function NewHandoverForm({
  clients,
  onSaved,
  onCancel,
}: {
  clients: { id: string; name: string; room: string | null }[];
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [content, setContent] = React.useState("");
  const [clientId, setClientId] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/handovers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, clientId }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Opslaan mislukt");
        return;
      }
      toast.success("Overdracht opgeslagen");
      setContent("");
      setClientId("");
      onSaved();
    } catch {
      toast.error("Er is iets misgegaan");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <Label htmlFor="client">Kamer / cliënt</Label>
        <Select id="client" value={clientId} onChange={(e) => setClientId(e.target.value)}>
          <option value="">Algemeen</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.room ? `${c.room} · ${c.name}` : c.name}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label htmlFor="content">Overdracht</Label>
        <Textarea
          id="content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Wat moet de volgende dienst weten?"
          className="min-h-[120px]"
          required
        />
      </div>
      <div className="flex gap-2">
        <Button type="submit" loading={loading} disabled={!content} className="self-start">
          Opslaan
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Annuleren
        </Button>
      </div>
    </form>
  );
}

function NewInterventionForm({
  clients,
  onSaved,
  onCancel,
}: {
  clients: { id: string; name: string; room: string | null }[];
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [clientId, setClientId] = React.useState(clients[0]?.id ?? "");
  const [description, setDescription] = React.useState("");
  const [goal, setGoal] = React.useState("");
  const [stepsTaken, setStepsTaken] = React.useState("");
  const [followUpNeeded, setFollowUpNeeded] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/interventions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, description, goal, stepsTaken, followUpNeeded }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Opslaan mislukt");
        return;
      }
      toast.success("Interventie aangemaakt");
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
      <div>
        <Label htmlFor="intervention-client">Cliënt</Label>
        <Select id="intervention-client" value={clientId} onChange={(e) => setClientId(e.target.value)}>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.room ? `${c.room} · ${c.name}` : c.name}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label htmlFor="intervention-description">Wat is er gebeurd?</Label>
        <Textarea
          id="intervention-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Beschrijf de situatie of aanleiding"
          className="min-h-[90px]"
          required
        />
      </div>
      <div>
        <Label htmlFor="intervention-goal">Doel van de interventie</Label>
        <Textarea
          id="intervention-goal"
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          placeholder="Wat willen we bereiken?"
          className="min-h-[70px]"
          required
        />
      </div>
      <div>
        <Label htmlFor="intervention-steps">Genomen stappen</Label>
        <Textarea
          id="intervention-steps"
          value={stepsTaken}
          onChange={(e) => setStepsTaken(e.target.value)}
          placeholder="Wat is er tot nu toe al gedaan?"
          className="min-h-[70px]"
          required
        />
      </div>
      <div>
        <Label htmlFor="intervention-followup">Benodigde vervolgstappen</Label>
        <Textarea
          id="intervention-followup"
          value={followUpNeeded}
          onChange={(e) => setFollowUpNeeded(e.target.value)}
          placeholder="Wat moet er nog gebeuren?"
          className="min-h-[70px]"
          required
        />
      </div>
      <div className="flex gap-2">
        <Button
          type="submit"
          loading={loading}
          disabled={!description || !goal || !stepsTaken || !followUpNeeded}
          className="self-start"
        >
          Interventie aanmaken
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
function InterventionCard({ intervention: i, onChanged }: { intervention: InterventionRow; onChanged: () => void }) {
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
    if (!window.confirm(`Interventie voor ${i.clientName} afronden? Dit kan niet ongedaan worden gemaakt.`)) {
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
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 p-4 text-left transition-colors hover:bg-surface2"
      >
        <span className="flex min-w-0 flex-col gap-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-slate-100">
              {i.room ? `${i.room} · ${i.clientName}` : i.clientName}
            </span>
            <Badge variant={isOpen ? "red" : "forest"}>{isOpen ? "Open" : "Afgerond"}</Badge>
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
              <span>· Afgerond door {i.closedByName} op {formatDateTime(new Date(i.closedAt))}</span>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Wat is er gebeurd?" value={i.description} />
            <Field label="Doel" value={i.goal} />
            <Field label="Genomen stappen" value={i.stepsTaken} />
            <Field label="Benodigde vervolgstappen" value={i.followUpNeeded} />
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Vervolgnotities ({i.notes.length})
            </p>
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
                <Textarea
                  id={`note-${i.id}`}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Wat is er sindsdien gedaan?"
                  className="min-h-[70px]"
                  required
                />
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
