"use client";

import * as React from "react";
import { toast } from "sonner";
import { BellOff, Check, CheckCircle2, Pencil, Send, Trash2, UserCheck } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { cn, DAYS_OF_WEEK_SHORT, formatDateTime } from "@/lib/utils";
import {
  checklistProgress,
  diffDaysISO,
  amsterdamNow,
  relativeDayLabel,
  SNOOZE_LABEL,
  TODO_CATEGORY_META,
  TODO_COMMENT_MAX,
  TODO_EVENT_LABEL,
  TODO_NOTE_MAX,
  TODO_PRIORITY_LABEL,
  todoBucket,
  type SnoozePreset,
  type TodoData,
  type TodoEventView,
} from "@/lib/todos-shared";
import { api, apiMessage, CATEGORY_CHIP, CATEGORY_ICON, formatMoment } from "./todo-ui";
import { useTodoEnv } from "./todo-env";
import type { useTodoActions } from "./use-todo-actions";
import { TodoForm } from "./todo-form";

type Actions = ReturnType<typeof useTodoActions>;

function scheduleText(todo: TodoData, nowMs: number): string {
  const parts: string[] = [];
  const today = amsterdamNow(nowMs).dateISO;
  if (todo.dueDate) {
    const iso = todo.dueDate.slice(0, 10);
    const diff = diffDaysISO(iso, today);
    parts.push(diff < 0 ? `Uiterlijk ${relativeDayLabel(iso, today)} (verlopen)` : `Uiterlijk ${relativeDayLabel(iso, today)}`);
  } else if (todo.intervalDays) {
    parts.push(`Elke ${todo.intervalDays === 2 ? "andere" : `${todo.intervalDays}e`} dag`);
  } else if (todo.daysOfWeek.length === 7) {
    parts.push("Elke dag");
  } else if (todo.daysOfWeek.length > 0) {
    parts.push(todo.daysOfWeek.map((d) => DAYS_OF_WEEK_SHORT[d]).join(", "));
  } else {
    parts.push("Geen vaste dag");
  }
  if (todo.time) parts.push(`om ${todo.time}`);
  if (todo.recurring) parts.push("komt na afronden terug");
  return parts.join(" · ");
}

export function TodoDetail({
  todo,
  canManage,
  showRoom,
  rooms,
  actions,
  canReopen,
  onClose,
  onUpdate,
}: {
  todo: TodoData;
  canManage: boolean;
  showRoom: boolean;
  rooms: string[];
  actions: Actions;
  canReopen: boolean;
  onClose: () => void;
  onUpdate: (todo: TodoData) => void;
}) {
  const { viewerId, canSupervise, nowMs } = useTodoEnv();
  const now = nowMs || Date.now();
  const [editing, setEditing] = React.useState(false);
  const [finishing, setFinishing] = React.useState(false);
  const [note, setNote] = React.useState("");
  const [events, setEvents] = React.useState<TodoEventView[] | null>(null);
  const [comment, setComment] = React.useState("");
  const [posting, setPosting] = React.useState(false);
  // Ticks show instantly; the map is dropped as soon as the server answer (the `todo` prop) arrives.
  const [ticks, setTicks] = React.useState<Record<string, boolean>>({});

  const loadEvents = React.useCallback(async () => {
    const res = await api(`/api/todos/${todo.id}/events`, "GET");
    if (res.ok && res.data.events) setEvents(res.data.events);
  }, [todo.id]);

  React.useEffect(() => {
    void loadEvents();
  }, [loadEvents, todo.version, todo.completed, todo.claimedById, todo.snoozedUntil]);

  const progress = checklistProgress(todo.checklist.map((i) => ({ ...i, done: ticks[i.id] ?? i.done })));
  const bucket = todoBucket(todo, now);
  const claimedByMe = todo.claimedById === viewerId;
  const CategoryIcon = todo.category ? CATEGORY_ICON[todo.category] : null;

  async function tick(id: string, done: boolean) {
    if (todo.completed) return;
    setTicks((prev) => ({ ...prev, [id]: done }));
    const ok = await actions.toggleStep(id, done);
    setTicks((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    if (!ok) return;
  }

  async function finish() {
    const ok = await actions.complete(note.trim());
    if (ok) onClose();
  }

  async function sendComment() {
    if (!comment.trim() || posting) return;
    setPosting(true);
    const res = await api(`/api/todos/${todo.id}/events`, "POST", { comment: comment.trim() });
    setPosting(false);
    if (!res.ok || !res.data.events) {
      toast.error(apiMessage(res, "Reactie plaatsen mislukt"));
      return;
    }
    setComment("");
    setEvents(res.data.events);
  }

  if (editing) {
    return (
      <Modal open onClose={onClose} title="Taak bewerken" className="sm:max-w-2xl">
        <TodoForm
          todoId={todo.id}
          initial={todo}
          showRoom={showRoom}
          rooms={rooms}
          onSaved={(updated) => {
            setEditing(false);
            onUpdate(updated);
          }}
          onCancel={() => setEditing(false)}
        />
      </Modal>
    );
  }

  return (
    <Modal open onClose={onClose} title={todo.title} className="sm:max-w-2xl">
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {todo.category && CategoryIcon && (
            <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium", CATEGORY_CHIP[todo.category])}>
              <CategoryIcon className="h-3 w-3" /> {TODO_CATEGORY_META[todo.category].label}
            </span>
          )}
          <span className="rounded-full bg-slate-500/15 px-2 py-0.5 font-medium text-slate-300">Prioriteit: {TODO_PRIORITY_LABEL[todo.priority].toLowerCase()}</span>
          {todo.completed && <span className="rounded-full bg-forest-500/15 px-2 py-0.5 font-medium text-forest-300">Afgerond</span>}
          {bucket === "snoozed" && todo.snoozedUntil && (
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-500/15 px-2 py-0.5 font-medium text-slate-300">
              <BellOff className="h-3 w-3" /> Uitgesteld tot {formatMoment(todo.snoozedUntil, now)}
            </span>
          )}
        </div>

        <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-slate-500">Wanneer</dt>
            <dd className="text-slate-200">{scheduleText(todo, now)}</dd>
          </div>
          {todo.clientName && (
            <div>
              <dt className="text-xs text-slate-500">Over</dt>
              <dd className="text-slate-200">{todo.clientName}</dd>
            </div>
          )}
          <div>
            <dt className="text-xs text-slate-500">Aangemaakt door</dt>
            <dd className="text-slate-200">
              {todo.createdByName} &middot; {formatDateTime(new Date(todo.createdAt))}
            </dd>
          </div>
          {todo.claimedByName && !todo.completed && (
            <div>
              <dt className="text-xs text-slate-500">Opgepakt door</dt>
              <dd className="text-slate-200">{claimedByMe ? "Jij" : todo.claimedByName}</dd>
            </div>
          )}
          {todo.completed && (
            <div className="sm:col-span-2">
              <dt className="text-xs text-slate-500">Afgerond door</dt>
              <dd className="text-forest-300">
                {todo.completedByName} &middot; {todo.completedAt && formatDateTime(new Date(todo.completedAt))}
                {todo.completionNote ? ` — ${todo.completionNote}` : ""}
              </dd>
            </div>
          )}
        </dl>

        {todo.description && <p className="whitespace-pre-wrap rounded-xl bg-surface2/40 p-3 text-sm text-slate-300">{todo.description}</p>}

        {todo.checklist.length > 0 && (
          <section aria-label="Stappen">
            <div className="mb-2 flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-slate-200">Stappen</h3>
              <span className="text-xs tabular-nums text-slate-400">
                {progress.done} van {progress.total}
              </span>
            </div>
            <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-surface2" role="progressbar" aria-valuemin={0} aria-valuemax={progress.total} aria-valuenow={progress.done}>
              <div className="h-full rounded-full bg-forest-500 transition-[width] duration-300 ease-out" style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }} />
            </div>
            <ul className="flex flex-col gap-1">
              {todo.checklist.map((item) => {
                const done = ticks[item.id] ?? item.done;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={done}
                      disabled={todo.completed}
                      onClick={() => void tick(item.id, !done)}
                      className="flex min-h-11 w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-surface2/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/60 disabled:cursor-default disabled:hover:bg-transparent"
                    >
                      <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-md border transition-colors", done ? "border-forest-500 bg-forest-500 text-white" : "border-slate-500")}>
                        {done && <Check className="h-4 w-4" />}
                      </span>
                      <span className={cn("text-sm", done ? "text-slate-500 line-through" : "text-slate-100")}>{item.text}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {!todo.completed ? (
          <section aria-label="Acties" className="flex flex-col gap-3 border-t border-border pt-4">
            {!todo.assignedToId && (
              <div className="flex flex-wrap items-center gap-2">
                {claimedByMe ? (
                  <Button size="sm" variant="outline" loading={actions.busy === "release"} onClick={() => void actions.release()}>
                    Vrijgeven
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" loading={actions.busy === "claim"} onClick={() => void actions.claim()}>
                    {actions.busy !== "claim" && <UserCheck className="h-4 w-4" />} {todo.claimedByName ? `Overnemen van ${todo.claimedByName.split(" ")[0]}` : "Ik pak dit op"}
                  </Button>
                )}
                {todo.claimedById && !claimedByMe && canSupervise && (
                  <Button size="sm" variant="ghost" onClick={() => void actions.release()}>
                    Vrijgeven
                  </Button>
                )}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-slate-500">Uitstellen:</span>
              {(["later", "tomorrow", "monday"] as SnoozePreset[]).map((p) => (
                <Button key={p} size="sm" variant="outline" disabled={actions.busy === "snooze"} onClick={() => void actions.snooze(p).then((ok) => ok && onClose())}>
                  {SNOOZE_LABEL[p]}
                </Button>
              ))}
              {bucket === "snoozed" && (
                <Button size="sm" variant="ghost" onClick={() => void actions.snooze(null)}>
                  Nu terughalen
                </Button>
              )}
            </div>
            {!finishing ? (
              <div className="flex flex-wrap gap-2">
                <Button loading={actions.busy === "complete"} onClick={() => void actions.complete().then((ok) => ok && onClose())}>
                  {actions.busy !== "complete" && <CheckCircle2 className="h-4 w-4" />} Afronden
                </Button>
                <Button variant="ghost" onClick={() => setFinishing(true)}>
                  Afronden met notitie
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <Textarea value={note} maxLength={TODO_NOTE_MAX} onChange={(e) => setNote(e.target.value)} placeholder="Notitie bij afronden" className="min-h-[72px]" autoFocus />
                <div className="flex gap-2">
                  <Button loading={actions.busy === "complete"} onClick={() => void finish()}>
                    Afronden
                  </Button>
                  <Button variant="ghost" onClick={() => setFinishing(false)}>
                    Annuleren
                  </Button>
                </div>
              </div>
            )}
          </section>
        ) : (
          canReopen && (
            <div className="border-t border-border pt-4">
              <Button variant="outline" loading={actions.busy === "reopen"} onClick={() => void actions.reopen().then(onClose)}>
                Heropenen
              </Button>
            </div>
          )
        )}

        <section aria-label="Activiteit" className="flex flex-col gap-3 border-t border-border pt-4">
          <h3 className="text-sm font-semibold text-slate-200">Activiteit</h3>
          <div className="flex gap-2">
            <Input
              value={comment}
              maxLength={TODO_COMMENT_MAX}
              placeholder="Schrijf een reactie voor je collega's…"
              aria-label="Reactie"
              onChange={(e) => setComment(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void sendComment();
                }
              }}
            />
            <Button size="icon" variant="outline" aria-label="Reactie plaatsen" loading={posting} disabled={!comment.trim()} onClick={() => void sendComment()}>
              {!posting && <Send className="h-4 w-4" />}
            </Button>
          </div>
          {events === null ? (
            <p className="text-sm text-slate-500">Laden…</p>
          ) : events.length === 0 ? (
            <p className="text-sm text-slate-500">Nog geen activiteit.</p>
          ) : (
            <ol className="flex flex-col gap-2.5">
              {events.map((e) => (
                <li key={e.id} className="text-sm">
                  {e.type === "COMMENT" ? (
                    <div className="rounded-xl bg-surface2/50 px-3 py-2">
                      <div className="text-xs text-slate-500">
                        {e.byName} &middot; {formatDateTime(new Date(e.at))}
                      </div>
                      <p className="whitespace-pre-wrap text-slate-200">{e.comment}</p>
                    </div>
                  ) : (
                    <div className="px-1 text-slate-400">
                      <span className="text-slate-300">{e.byName}</span> {TODO_EVENT_LABEL[e.type]}
                      <span className="text-xs text-slate-500"> &middot; {formatDateTime(new Date(e.at))}</span>
                      {e.comment && <span className="text-slate-500"> — {e.comment}</span>}
                    </div>
                  )}
                </li>
              ))}
            </ol>
          )}
        </section>

        {canManage && (
          <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
            <Button variant="ghost" onClick={() => setEditing(true)}>
              <Pencil className="h-4 w-4" /> Bewerken
            </Button>
            <Button variant="ghost" className="text-red-400 hover:text-red-300" loading={actions.busy === "delete"} onClick={() => void actions.remove().then((ok) => ok && onClose())}>
              {actions.busy !== "delete" && <Trash2 className="h-4 w-4" />} Verwijderen
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}
