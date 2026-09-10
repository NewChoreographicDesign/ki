"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, ChevronDown, ChevronRight, Trash2, FileText, DoorOpen } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { uploadFileWithProgress } from "@/lib/client-upload";

export type ProtocolRow = {
  id: string;
  title: string;
  content: string | null;
  url: string | null;
  clientName: string | null;
  /** Client's room, "Geen kamer" if the client has none, or null when this is a general protocol. */
  room: string | null;
};

const ALGEMEEN = "Algemeen";

export function ProtocolManager({
  protocols,
  clients,
  canDelete,
}: {
  protocols: ProtocolRow[];
  clients: { id: string; name: string; room: string | null }[];
  canDelete: boolean;
}) {
  const router = useRouter();
  const [formOpen, setFormOpen] = React.useState(false);

  const grouped = React.useMemo(() => groupByRoom(protocols), [protocols]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        {!formOpen && (
          <div className="mb-3 flex justify-end">
            <Button size="sm" variant="outline" onClick={() => setFormOpen(true)}>
              <Plus className="h-4 w-4" /> Nieuw protocol
            </Button>
          </div>
        )}
        {formOpen && (
          <Card>
            <CardHeader>
              <CardTitle>Nieuw protocol</CardTitle>
              <p className="text-sm text-slate-500">
                Typ de inhoud als tekst, upload een bestand (PDF, Word, Excel, foto), of beide.
              </p>
            </CardHeader>
            <CardContent>
              <NewProtocolForm
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
          <p className="text-slate-500">Nog geen protocollen.</p>
        ) : (
          <>
            {grouped.algemeen.length > 0 && (
              <RoomSection title={ALGEMEEN} items={grouped.algemeen} canDelete={canDelete} router={router} />
            )}
            {grouped.rooms.map(({ room, items }) => (
              <RoomSection key={room} title={room} items={items} canDelete={canDelete} router={router} />
            ))}
          </>
        )}
      </div>
    </div>
  );
}

// Groups protocols by their client's room, real rooms first (alphabetically)
// then "Geen kamer" — mirrors the ranking already used for the dashboard's
// "today per room" overview. General (no client) protocols are kept out of
// this map entirely and rendered as their own single Algemeen dropdown.
function groupByRoom(protocols: ProtocolRow[]) {
  const byRoom = new Map<string, ProtocolRow[]>();
  const algemeen: ProtocolRow[] = [];
  for (const p of protocols) {
    if (p.room === null) {
      algemeen.push(p);
      continue;
    }
    const list = byRoom.get(p.room);
    if (list) list.push(p);
    else byRoom.set(p.room, [p]);
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
  items: ProtocolRow[];
  canDelete: boolean;
  router: ReturnType<typeof useRouter>;
}) {
  const [open, setOpen] = React.useState(false);

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/protocols/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Protocol verwijderd");
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
        className="flex w-full items-center justify-between gap-3 bg-brand-gradient-soft p-5 text-left ring-1 ring-inset ring-sky-400/20 transition-colors hover:bg-sky-500/10"
      >
        <span className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-500/15 text-sky-400">
            <DoorOpen className="h-5 w-5" />
          </span>
          <span className="flex flex-col">
            <span className="font-semibold text-slate-100">{title}</span>
            <span className="text-xs text-slate-500">
              {items.length} protocol{items.length === 1 ? "" : "len"}
            </span>
          </span>
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <CardContent className="flex flex-col gap-2 pt-3">
          {items.map((p) => (
            <ProtocolRowItem key={p.id} protocol={p} canDelete={canDelete} onDelete={handleDelete} />
          ))}
        </CardContent>
      )}
    </Card>
  );
}

// Expanding a room only reveals protocol names first — the actual content
// (which can be long, or just a file link) stays folded until a specific
// name is clicked, so scanning "which protocols exist for this room" never
// requires scrolling past everyone else's full text first.
function ProtocolRowItem({
  protocol,
  canDelete,
  onDelete,
}: {
  protocol: ProtocolRow;
  canDelete: boolean;
  onDelete: (id: string) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const hasContent = Boolean(protocol.content || protocol.url);

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface2/50 transition-colors hover:border-sky-500/30">
      <div className="flex items-center gap-2 p-3.5">
        <button
          type="button"
          onClick={() => hasContent && setOpen((v) => !v)}
          disabled={!hasContent}
          className="flex flex-1 items-center gap-2.5 text-left disabled:cursor-default"
        >
          {hasContent ? (
            <ChevronRight
              className={`h-4 w-4 shrink-0 text-sky-400 transition-transform ${open ? "rotate-90" : ""}`}
            />
          ) : (
            <span className="w-4 shrink-0" />
          )}
          <span className="font-medium text-slate-100">
            {protocol.title}{" "}
            {protocol.clientName && <span className="text-sm text-slate-500">({protocol.clientName})</span>}
          </span>
        </button>
        {canDelete && (
          <Button size="icon" variant="ghost" onClick={() => onDelete(protocol.id)} aria-label="Verwijderen">
            <Trash2 className="h-5 w-5 text-red-400" />
          </Button>
        )}
      </div>
      {open && hasContent && (
        <div className="flex flex-col gap-2 border-t border-border bg-surface p-4">
          {protocol.content && <p className="whitespace-pre-wrap text-sm text-slate-400">{protocol.content}</p>}
          {protocol.url && (
            <a
              href={protocol.url}
              target="_blank"
              rel="noreferrer noopener"
              className="flex w-fit items-center gap-2 text-sm text-sky-400 hover:underline"
            >
              <FileText className="h-4 w-4" /> Bestand openen
            </a>
          )}
        </div>
      )}
    </div>
  );
}

function NewProtocolForm({
  clients,
  onSaved,
  onCancel,
}: {
  clients: { id: string; name: string; room: string | null }[];
  onSaved: () => void;
  onCancel: () => void;
}) {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [title, setTitle] = React.useState("");
  const [content, setContent] = React.useState("");
  const [file, setFile] = React.useState<File | null>(null);
  const [clientId, setClientId] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [progress, setProgress] = React.useState(0);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setProgress(0);

    let fileUrl = "";
    if (file) {
      const timeoutController = new AbortController();
      const timeoutId = setTimeout(() => timeoutController.abort(), 60_000);
      try {
        const result = await uploadFileWithProgress(
          "/api/protocols/upload",
          file,
          setProgress,
          timeoutController.signal
        );
        fileUrl = result.url;
      } catch (error) {
        toast.error(
          timeoutController.signal.aborted
            ? "Uploaden duurde te lang en is afgebroken. Controleer je internetverbinding of probeer een kleiner bestand."
            : error instanceof Error
              ? `Uploaden lukt niet: ${error.message}`
              : "Uploaden lukt niet. Probeer het opnieuw."
        );
        setLoading(false);
        return;
      } finally {
        clearTimeout(timeoutId);
      }
    }

    try {
      const res = await fetch("/api/protocols", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content, url: fileUrl, clientId }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Toevoegen mislukt");
        return;
      }
      toast.success("Protocol toegevoegd");
      onSaved();
    } catch {
      toast.error("Er is iets misgegaan");
    } finally {
      setLoading(false);
      setProgress(0);
    }
  }

  return (
    <form onSubmit={handleCreate} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="title">Titel</Label>
          <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>
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
      </div>
      <div>
        <Label htmlFor="content">Inhoud (optioneel als je een bestand uploadt)</Label>
        <Textarea id="content" value={content} onChange={(e) => setContent(e.target.value)} />
      </div>
      <div>
        <Label htmlFor="protocol-file">Bestand (optioneel)</Label>
        <div className="flex items-center gap-3">
          <Button type="button" variant="secondary" disabled={loading} onClick={() => fileInputRef.current?.click()}>
            Bestand kiezen
          </Button>
          <span className="truncate text-sm text-slate-400">{file ? file.name : "Geen bestand gekozen"}</span>
          <input
            ref={fileInputRef}
            id="protocol-file"
            type="file"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.txt"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            disabled={loading}
            className="sr-only"
          />
        </div>
      </div>
      {loading && file && (
        <div className="flex flex-col gap-1">
          <div className="h-2 w-full overflow-hidden rounded-full bg-surface2">
            <div className="h-full rounded-full bg-sky-500 transition-all" style={{ width: `${progress}%` }} />
          </div>
          <span className="text-xs text-slate-500">{Math.round(progress)}%</span>
        </div>
      )}
      <div className="flex gap-2">
        <Button type="submit" loading={loading} disabled={!title || (!content && !file)} className="self-start">
          Toevoegen
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Annuleren
        </Button>
      </div>
    </form>
  );
}
