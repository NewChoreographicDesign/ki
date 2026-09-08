"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, ChevronDown, Trash2, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";

export type HandoverRow = {
  id: string;
  content: string;
  shift: "MORNING" | "EVENING";
  userName: string;
  createdAt: string;
  expiresAt: string;
  clientName: string | null;
  /** Client's room, "Geen kamer" if the client has none, or null when this is a general note. */
  room: string | null;
};

const ALGEMEEN = "Algemeen";

export function OverdrachtManager({
  handovers,
  clients,
  canDelete,
}: {
  handovers: HandoverRow[];
  clients: { id: string; name: string; room: string | null }[];
  canDelete: boolean;
}) {
  const router = useRouter();
  const [formOpen, setFormOpen] = React.useState(false);

  const grouped = React.useMemo(() => groupByRoom(handovers), [handovers]);

  return (
    <div className="flex flex-col gap-6">
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
                  router.refresh();
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
        className="flex w-full items-center justify-between gap-3 p-5 text-left"
      >
        <span className="font-semibold text-slate-100">
          {title} <span className="font-normal text-slate-500">({items.length})</span>
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <CardContent className="flex flex-col gap-3 pt-0">
          {items.map((h) => (
            <div key={h.id} className="flex flex-col gap-2 rounded-lg border border-border bg-surface2/50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2 text-sm text-slate-400">
                  <Badge variant={h.shift === "MORNING" ? "sky" : "emerald"}>
                    {h.shift === "MORNING" ? "Ochtend" : "Avond"}
                  </Badge>
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
