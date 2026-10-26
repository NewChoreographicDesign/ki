"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertTriangle,
  Check,
  CheckCheck,
  ChevronDown,
  Clock,
  DoorOpen,
  Eye,
  Inbox,
  MoreHorizontal,
  Pencil,
  RotateCcw,
  Search,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Textarea } from "@/components/ui/textarea";
import { cn, formatDateTime, shiftBadgeVariant, shiftLabel } from "@/lib/utils";
import { HANDOVER_CATEGORY_META, HANDOVER_PRIORITY_META, isOpenAction, isUnread, type HandoverNote } from "@/lib/handover-shared";
import { CATEGORY_ICON, PRIORITY_STYLE, isTypingTarget, timeAgo } from "./handover-ui";

type Filter = "ALL" | "UNREAD" | "URGENT" | "ACTION" | "MINE";
type Grouping = "ROOM" | "TIMELINE";

const ALGEMEEN = "Algemeen";

export function HandoverBoard({
  notes,
  viewerId,
  onCompose,
  onEdit,
}: {
  notes: HandoverNote[];
  viewerId: string;
  onCompose: () => void;
  onEdit: (note: HandoverNote) => void;
}) {
  const router = useRouter();
  const [filter, setFilter] = React.useState<Filter>("ALL");
  const [grouping, setGrouping] = React.useState<Grouping>("ROOM");
  const [local, setLocal] = React.useState<HandoverNote[]>(notes);
  const [ackingAll, setAckingAll] = React.useState(false);

  // Server data is the source of truth; local state only carries optimistic changes in between.
  React.useEffect(() => setLocal(notes), [notes]);

  // Keep the board fresh without a manual reload: when the tab regains focus,
  // and once a minute while it is visible (a shift handover is a live thing).
  React.useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const timer = window.setInterval(refresh, 60_000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [router]);

  const counts = React.useMemo(
    () => ({
      all: local.length,
      unread: local.filter((n) => isUnread(n, viewerId)).length,
      urgent: local.filter((n) => n.priority === "URGENT" && !(n.needsAction && n.resolvedAt)).length,
      action: local.filter(isOpenAction).length,
      mine: local.filter((n) => n.authorId === viewerId).length,
    }),
    [local, viewerId]
  );

  const visible = React.useMemo(() => {
    return local.filter((n) => {
      if (filter === "UNREAD" && !isUnread(n, viewerId)) return false;
      if (filter === "URGENT" && !(n.priority === "URGENT" && !(n.needsAction && n.resolvedAt))) return false;
      if (filter === "ACTION" && !isOpenAction(n)) return false;
      if (filter === "MINE" && n.authorId !== viewerId) return false;
      return true;
    });
  }, [local, filter, viewerId]);

  const groups = React.useMemo(() => {
    if (grouping === "TIMELINE") return [{ title: null as string | null, items: visible }];
    const byRoom = new Map<string, HandoverNote[]>();
    const general: HandoverNote[] = [];
    for (const n of visible) {
      if (n.room === null) general.push(n);
      else byRoom.set(n.room, [...(byRoom.get(n.room) ?? []), n]);
    }
    const rank = (r: string) => (r === "Geen kamer" ? 1 : 0);
    const rooms = [...byRoom.entries()].sort((a, b) => rank(a[0]) - rank(b[0]) || a[0].localeCompare(b[0], "nl", { numeric: true }));
    // Rooms with something urgent or unread come first; the rest keeps room order.
    const weight = (items: HandoverNote[]) => (items.some((i) => i.priority === "URGENT" && !i.resolvedAt) ? 0 : items.some((i) => isUnread(i, viewerId)) ? 1 : 2);
    const sorted = rooms.map(([title, items]) => ({ title: title as string | null, items })).sort((a, b) => weight(a.items) - weight(b.items));
    return [...(general.length ? [{ title: ALGEMEEN as string | null, items: general }] : []), ...sorted];
  }, [visible, grouping, viewerId]);

  // Keyboard: "n" starts a new note (never while typing).
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey || isTypingTarget(e.target)) return;
      if (e.key === "n") {
        e.preventDefault();
        onCompose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCompose]);

  function patchLocal(id: string, fn: (n: HandoverNote) => HandoverNote) {
    setLocal((prev) => prev.map((n) => (n.id === id ? fn(n) : n)));
  }

  async function toggleRead(note: HandoverNote) {
    const nextRead = !note.readByMe;
    patchLocal(note.id, (n) => ({ ...n, readByMe: nextRead }));
    try {
      const res = await fetch(`/api/handovers/${note.id}/ack`, { method: nextRead ? "POST" : "DELETE" });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      patchLocal(note.id, (n) => ({ ...n, readByMe: note.readByMe }));
      toast.error("Bijwerken mislukt");
    }
  }

  async function ackAll() {
    setAckingAll(true);
    const before = local;
    setLocal((prev) => prev.map((n) => (n.authorId === viewerId ? n : { ...n, readByMe: true })));
    try {
      const res = await fetch("/api/handovers/ack", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      if (!res.ok) throw new Error();
      toast.success("Alles als gelezen gemarkeerd");
      router.refresh();
    } catch {
      setLocal(before);
      toast.error("Bijwerken mislukt");
    } finally {
      setAckingAll(false);
    }
  }

  const filters: { key: Filter; label: string; count: number; tone?: "red" | "amber" }[] = [
    { key: "ALL", label: "Alles", count: counts.all },
    { key: "UNREAD", label: "Ongelezen", count: counts.unread, tone: counts.unread > 0 ? "amber" : undefined },
    { key: "URGENT", label: "Urgent", count: counts.urgent, tone: counts.urgent > 0 ? "red" : undefined },
    { key: "ACTION", label: "Open acties", count: counts.action, tone: counts.action > 0 ? "amber" : undefined },
    { key: "MINE", label: "Van mij", count: counts.mine },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div role="tablist" aria-label="Filter" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
          {filters.map((f) => (
            <button
              key={f.key}
              type="button"
              role="tab"
              aria-selected={filter === f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                "inline-flex h-10 shrink-0 items-center gap-2 rounded-full border px-3.5 text-sm transition-colors active:scale-[0.98]",
                filter === f.key ? "border-rose-400/60 bg-rose-500/15 text-rose-200" : "border-border bg-surface2/50 text-slate-400 hover:border-slate-500/60 hover:text-slate-200"
              )}
            >
              {f.label}
              <span
                className={cn(
                  "min-w-[1.4rem] rounded-full px-1.5 py-0.5 text-center text-xs font-semibold tabular-nums",
                  f.tone === "red" ? "bg-red-500/20 text-red-400" : f.tone === "amber" ? "bg-amber-500/20 text-amber-400" : "bg-surface1 text-slate-400"
                )}
              >
                {f.count}
              </span>
            </button>
          ))}
        </div>
        {counts.unread > 0 && (
          <Button size="sm" variant="outline" onClick={ackAll} loading={ackingAll} className="self-start sm:self-auto">
            <CheckCheck className="h-4 w-4" /> Alles gelezen
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <div role="group" aria-label="Groeperen" className="flex rounded-xl border border-border bg-surface2/50 p-1">
          {(["ROOM", "TIMELINE"] as const).map((g) => (
            <button
              key={g}
              type="button"
              aria-pressed={grouping === g}
              onClick={() => setGrouping(g)}
              className={cn("h-9 flex-1 rounded-lg px-3.5 text-sm transition-colors sm:flex-none", grouping === g ? "bg-surface1 font-medium text-slate-100 shadow-sm" : "text-slate-500 hover:text-slate-300")}
            >
              {g === "ROOM" ? "Per kamer" : "Tijdlijn"}
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        local.length === 0 ? (
          <EmptyState icon={Inbox} title="Nog geen overdrachtsnotities" description="Wat de volgende dienst moet weten, schrijf je hier op. Notities vervallen vanzelf." action={{ label: "Nieuwe overdracht", onClick: onCompose }} />
        ) : (
          <EmptyState icon={Search} title="Niets gevonden" description="Pas het filter aan." action={{ label: "Filters wissen", onClick: () => setFilter("ALL") }} />
        )
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map((g) =>
            g.title === null ? (
              <ul key="timeline" className="flex flex-col gap-3">
                {g.items.map((n) => (
                  <NoteCard key={n.id} note={n} viewerId={viewerId} showRoom onToggleRead={toggleRead} onEdit={onEdit} />
                ))}
              </ul>
            ) : (
              <RoomGroup key={g.title} title={g.title} items={g.items} viewerId={viewerId} onToggleRead={toggleRead} onEdit={onEdit} />
            )
          )}
        </div>
      )}
    </div>
  );
}

function RoomGroup({
  title,
  items,
  viewerId,
  onToggleRead,
  onEdit,
}: {
  title: string;
  items: HandoverNote[];
  viewerId: string;
  onToggleRead: (n: HandoverNote) => void;
  onEdit: (n: HandoverNote) => void;
}) {
  const unread = items.filter((n) => isUnread(n, viewerId)).length;
  const urgent = items.filter((n) => n.priority === "URGENT" && !n.resolvedAt).length;
  // Rooms that need attention start open; quiet ones stay collapsed.
  const [open, setOpen] = React.useState(unread > 0 || urgent > 0 || items.length <= 2);

  return (
    <Card>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 bg-brand-gradient-soft p-4 text-left ring-1 ring-inset ring-rose-400/20 transition-colors hover:bg-rose-500/10 sm:p-5"
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-500/15 text-rose-400">
            <DoorOpen className="h-5 w-5" />
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="truncate font-semibold text-slate-100">{title}</span>
            <span className="text-xs text-slate-500">
              {items.length} notitie{items.length === 1 ? "" : "s"}
            </span>
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {urgent > 0 && <Badge variant="red">{urgent} urgent</Badge>}
          {unread > 0 && <Badge variant="amber">{unread} nieuw</Badge>}
          <ChevronDown className={cn("h-4 w-4 text-slate-400 transition-transform", open && "rotate-180")} />
        </span>
      </button>
      {open && (
        <ul className="flex flex-col gap-3 p-3 sm:p-4">
          {items.map((n) => (
            <NoteCard key={n.id} note={n} viewerId={viewerId} onToggleRead={onToggleRead} onEdit={onEdit} />
          ))}
        </ul>
      )}
    </Card>
  );
}

function NoteCard({
  note: n,
  viewerId,
  showRoom = false,
  onToggleRead,
  onEdit,
}: {
  note: HandoverNote;
  viewerId: string;
  showRoom?: boolean;
  onToggleRead: (n: HandoverNote) => void;
  onEdit: (n: HandoverNote) => void;
}) {
  const router = useRouter();
  const [expanded, setExpanded] = React.useState(false);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [resolving, setResolving] = React.useState(false);
  const [resolveNote, setResolveNote] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);

  const style = PRIORITY_STYLE[n.priority];
  const CategoryIcon = CATEGORY_ICON[n.category];
  const unread = isUnread(n, viewerId);
  const mine = n.authorId === viewerId;
  const openAction = isOpenAction(n);
  const long = n.content.length > 280 || n.content.split("\n").length > 5;
  const others = n.readBy.filter((r) => r.userId !== n.authorId);

  React.useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [menuOpen]);

  async function resolve(resolved: boolean) {
    setBusy(true);
    try {
      const res = await fetch(`/api/handovers/${n.id}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolved, note: resolved ? resolveNote : undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "Bijwerken mislukt");
        return;
      }
      toast.success(resolved ? "Actie afgehandeld" : "Actie heropend");
      setResolving(false);
      setResolveNote("");
      router.refresh();
    } catch {
      toast.error("Er is iets misgegaan");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setMenuOpen(false);
    if (!window.confirm("Deze overdracht verwijderen? Dit kan niet ongedaan worden gemaakt.")) return;
    try {
      const res = await fetch(`/api/handovers/${n.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Overdracht verwijderd");
      router.refresh();
    } catch {
      toast.error("Verwijderen mislukt");
    }
  }

  const subject = n.clientName ? (showRoom && n.room && n.room !== "Geen kamer" && n.room !== n.clientName ? `${n.room} · ${n.clientName}` : n.clientName) : showRoom ? ALGEMEEN : null;

  return (
    <li
      className={cn(
        "relative overflow-hidden rounded-xl border bg-surface2/50 transition-colors",
        unread ? `border-transparent ring-1 ${style.ring} bg-surface2` : "border-border",
        n.needsAction && n.resolvedAt && "opacity-70"
      )}
    >
      <span aria-hidden className={cn("absolute inset-y-0 left-0 w-1", style.bar)} />
      <div className="flex flex-col gap-2.5 py-3.5 pl-5 pr-3.5 sm:pl-6 sm:pr-4">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-sm">
          {unread && <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/20 px-2 py-0.5 text-xs font-semibold text-rose-300">Nieuw</span>}
          {n.priority !== "INFO" && (
            <Badge variant={style.badge} className="gap-1">
              <style.icon className="h-3 w-3" /> {HANDOVER_PRIORITY_META[n.priority].label}
            </Badge>
          )}
          <Badge variant="slate" className="gap-1">
            <CategoryIcon className="h-3 w-3" /> {HANDOVER_CATEGORY_META[n.category].label}
          </Badge>
          {subject && <span className="font-medium text-slate-200">{subject}</span>}
          <div className="ml-auto flex items-center gap-1">
            {n.canEdit && (
              <div ref={menuRef} className="relative">
                <button
                  type="button"
                  aria-label="Meer acties"
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                  onClick={() => setMenuOpen((v) => !v)}
                  className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 hover:bg-surface1 hover:text-slate-200"
                >
                  <MoreHorizontal className="h-5 w-5" />
                </button>
                {menuOpen && (
                  <div role="menu" className="absolute right-0 top-11 z-20 w-44 overflow-hidden rounded-xl border border-border bg-surface p-1 shadow-lift animate-scale-in">
                    <button
                      role="menuitem"
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        onEdit(n);
                      }}
                      className="flex h-11 w-full items-center gap-2.5 rounded-lg px-3 text-sm text-slate-200 hover:bg-surface2"
                    >
                      <Pencil className="h-4 w-4" /> Bewerken
                    </button>
                    <button role="menuitem" type="button" onClick={remove} className="flex h-11 w-full items-center gap-2.5 rounded-lg px-3 text-sm text-red-400 hover:bg-surface2">
                      <Trash2 className="h-4 w-4" /> Verwijderen
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <p className={cn("whitespace-pre-wrap text-[15px] leading-relaxed text-slate-100", !expanded && long && "line-clamp-5")}>{n.content}</p>
        {long && (
          <button type="button" onClick={() => setExpanded((v) => !v)} className="self-start text-sm text-rose-300 hover:text-rose-200">
            {expanded ? "Minder tonen" : "Meer lezen"}
          </button>
        )}

        {n.needsAction && (
          <div className={cn("rounded-lg border p-3 text-sm", openAction ? "border-amber-400/30 bg-amber-500/10" : "border-forest-500/30 bg-forest-500/10")}>
            {openAction ? (
              resolving ? (
                <div className="flex flex-col gap-2">
                  <label htmlFor={`res-${n.id}`} className="font-medium text-amber-300">
                    Wat is er gedaan? <span className="font-normal text-slate-500">(optioneel)</span>
                  </label>
                  <Textarea id={`res-${n.id}`} value={resolveNote} onChange={(e) => setResolveNote(e.target.value)} className="min-h-[72px]" maxLength={500} autoFocus />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => resolve(true)} loading={busy}>
                      <Check className="h-4 w-4" /> Afhandelen
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setResolving(false)}>
                      Annuleren
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="flex items-center gap-2 font-medium text-amber-300">
                    <AlertTriangle className="h-4 w-4" /> Actie nodig
                  </span>
                  <Button size="sm" variant="outline" onClick={() => setResolving(true)}>
                    <Check className="h-4 w-4" /> Afhandelen
                  </Button>
                </div>
              )
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-forest-300">
                  <Check className="mr-1 inline h-4 w-4" />
                  Afgehandeld door {n.resolvedByName ?? "onbekend"}
                  {n.resolvedAt ? ` · ${timeAgo(n.resolvedAt)}` : ""}
                  {n.resolutionNote ? ` — ${n.resolutionNote}` : ""}
                </span>
                <Button size="sm" variant="ghost" onClick={() => resolve(false)} loading={busy}>
                  <RotateCcw className="h-4 w-4" /> Heropenen
                </Button>
              </div>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
            <Badge variant={shiftBadgeVariant(n.shift)}>{shiftLabel(n.shift)}</Badge>
            <span>{n.authorName}</span>
            <span className="flex items-center gap-1" title={formatDateTime(new Date(n.createdAt))}>
              <Clock className="h-3 w-3" /> {timeAgo(n.createdAt)}
            </span>
            {n.editedAt && <span>· bewerkt</span>}
            <span className="text-slate-600">· vervalt {formatDateTime(new Date(n.expiresAt))}</span>
          </div>
          <div className="flex items-center gap-3">
            {others.length > 0 && (
              <span className="flex items-center gap-1 text-xs text-slate-500" title={`Gelezen door ${others.map((r) => r.name).join(", ")}`}>
                <Eye className="h-3.5 w-3.5" /> {others.length === 1 ? others[0].name : `${others.length} collega's`}
              </span>
            )}
            {!mine && (
              <button
                type="button"
                onClick={() => onToggleRead(n)}
                aria-pressed={n.readByMe}
                className={cn(
                  "inline-flex h-10 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-[background-color,border-color,color,transform] duration-150 ease-out active:scale-[0.97]",
                  n.readByMe ? "border-forest-500/40 bg-forest-500/10 text-forest-300 hover:bg-forest-500/20" : "border-rose-400/50 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20"
                )}
              >
                <Check className="h-4 w-4" /> {n.readByMe ? "Gelezen" : "Markeer als gelezen"}
              </button>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}
