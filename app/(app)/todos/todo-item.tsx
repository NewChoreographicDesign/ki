"use client";

import * as React from "react";
import { BellOff, CalendarDays, CheckCircle2, Circle, Clock, DoorOpen, Flag, ListChecks, Moon, Repeat, Trash2, User, UserCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { SwipeRow, type SwipeAction } from "@/components/ui/swipe-row";
import { cn, formatDateTime } from "@/lib/utils";
import { checklistProgress, isLate, TODO_CATEGORY_META, todoBucket, type TodoData } from "@/lib/todos-shared";
import { CATEGORY_CHIP, CATEGORY_ICON, DUE_TONE_CLASS, dueChip, formatMoment } from "./todo-ui";
import { useTodoEnv } from "./todo-env";
import { useTodoActions, type TodoCallbacks } from "./use-todo-actions";
import { TodoDetail } from "./todo-detail";

const chip = "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium";

function Chip({ className, title, children }: { className?: string; title?: string; children: React.ReactNode }) {
  return (
    <span title={title} className={cn(chip, className)}>
      {children}
    </span>
  );
}

export function TodoItem({
  todo,
  canManage = false,
  showRoom = false,
  rooms = [],
  onComplete,
  onUncomplete,
  onUpdate,
  onDelete,
  selectable = false,
  selected = false,
  onToggleSelect,
}: {
  todo: TodoData;
  /** May edit / delete this task (the parent decides; the server enforces it). */
  canManage?: boolean;
  /** Forwarded to the edit form — only meaningful for personal to-do's. */
  showRoom?: boolean;
  rooms?: string[];
  /** Bulk-select mode (Werklijst, supervisors): swaps the normal actions for a checkbox. */
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
} & TodoCallbacks) {
  const { viewerId, nowMs } = useTodoEnv();
  const now = nowMs || Date.now();
  const [detailOpen, setDetailOpen] = React.useState(false);
  const [optimisticDone, setOptimisticDone] = React.useState(false);
  const actions = useTodoActions(todo, { onComplete, onUncomplete, onUpdate, onDelete });

  const progress = checklistProgress(todo.checklist);
  const late = isLate(todo, now);
  const due = dueChip(todo, now);
  const bucket = todoBucket(todo, now);
  const shared = !todo.assignedToId;
  const claimedByMe = todo.claimedById !== null && todo.claimedById === viewerId;
  const claimedByOther = todo.claimedById !== null && !claimedByMe;
  const done = todo.completed || optimisticDone;
  const CategoryIcon = todo.category ? CATEGORY_ICON[todo.category] : null;

  async function toggleDone() {
    if (selectable || actions.busy) return;
    if (todo.completed) {
      if (onUncomplete) await actions.reopen();
      return;
    }
    setOptimisticDone(true); // instant feedback; rolled back if the server says no
    const ok = await actions.complete();
    if (!ok) setOptimisticDone(false);
  }

  const swipeActions: SwipeAction[] = [];
  if (!selectable && !todo.completed) {
    swipeActions.push({ label: "Voltooien", icon: CheckCircle2, onTrigger: () => void toggleDone() });
    swipeActions.push({ label: "Morgen", icon: Moon, onTrigger: () => void actions.snooze("tomorrow") });
  }
  if (!selectable && canManage) swipeActions.push({ label: "Verwijderen", icon: Trash2, onTrigger: () => void actions.remove(), variant: "danger" });

  const accent = late ? "border-l-red-500" : claimedByMe ? "border-l-forest-500" : todo.priority === "HIGH" ? "border-l-rose-400" : "border-l-transparent";

  const card = (
    <Card className={cn("animate-fade-in-up border-l-4 transition-colors", accent, done && "opacity-80")}>
      <div className="flex items-start gap-1 p-2 sm:p-3">
        {selectable ? (
          <div className="flex h-11 w-11 shrink-0 items-center justify-center">
            <Checkbox checked={selected} onChange={() => onToggleSelect?.()} aria-label={`"${todo.title}" selecteren`} />
          </div>
        ) : (
          <button
            type="button"
            onClick={toggleDone}
            disabled={todo.completed && !onUncomplete}
            aria-label={todo.completed ? `"${todo.title}" heropenen` : `"${todo.title}" afronden`}
            className="group flex h-11 w-11 shrink-0 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/60 disabled:cursor-default"
          >
            {done ? (
              <CheckCircle2 className="h-7 w-7 text-forest-400" />
            ) : (
              <Circle className={cn("h-7 w-7 transition-colors group-hover:text-forest-400", late ? "text-red-400" : "text-slate-500")} />
            )}
          </button>
        )}

        <div className="flex min-w-0 flex-1 flex-col gap-1.5 py-1.5 pr-1">
          <button
            type="button"
            onClick={() => (selectable ? onToggleSelect?.() : setDetailOpen(true))}
            className="flex min-w-0 flex-col gap-1.5 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/60"
          >
            <span className="flex flex-wrap items-baseline gap-x-2">
              {todo.time && (
                <span className={cn("inline-flex items-center gap-1 text-sm font-semibold tabular-nums", late ? "text-red-300" : "text-slate-200")}>
                  <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                  {todo.time}
                </span>
              )}
              <span className={cn("min-w-0 break-words font-medium", done ? "text-slate-500 line-through" : "text-slate-100")}>{todo.title}</span>
            </span>

            <span className="flex flex-wrap items-center gap-1.5">
              {due && <Chip className={DUE_TONE_CLASS[due.tone]}>{due.text}</Chip>}
              {todo.category && CategoryIcon && (
                <Chip className={CATEGORY_CHIP[todo.category]}>
                  <CategoryIcon className="h-3 w-3" /> {TODO_CATEGORY_META[todo.category].label}
                </Chip>
              )}
              {todo.clientName && (
                <Chip className="bg-slate-500/15 text-slate-300" title="Over deze cliënt">
                  <User className="h-3 w-3" /> {todo.clientName}
                </Chip>
              )}
              {progress.total > 0 && (
                <Chip className={progress.done === progress.total ? "bg-forest-500/15 text-forest-300" : "bg-slate-500/15 text-slate-300"} title="Stappen afgevinkt">
                  <ListChecks className="h-3 w-3" /> {progress.done}/{progress.total}
                </Chip>
              )}
              {todo.priority === "HIGH" && (
                <Chip className="bg-rose-500/15 text-rose-300">
                  <Flag className="h-3 w-3" /> Hoog
                </Chip>
              )}
              {todo.priority === "LOW" && (
                <Chip className="bg-slate-500/15 text-slate-400">
                  <Flag className="h-3 w-3" /> Laag
                </Chip>
              )}
              {(todo.recurring || todo.intervalDays || (todo.daysOfWeek.length > 0 && !todo.completed)) && (
                <Chip className="bg-slate-500/15 text-slate-400" title="Terugkerende of vaste-dagentaak">
                  <Repeat className="h-3 w-3" />
                </Chip>
              )}
              {bucket === "snoozed" && todo.snoozedUntil && (
                <Chip className="bg-slate-500/15 text-slate-300">
                  <BellOff className="h-3 w-3" /> tot {formatMoment(todo.snoozedUntil, now)}
                </Chip>
              )}
              {todo.claimedByName && !todo.completed && (
                <Chip className={claimedByMe ? "bg-forest-500/15 text-forest-300" : "bg-slate-500/15 text-slate-300"}>
                  <UserCheck className="h-3 w-3" /> {claimedByMe ? "Jij pakt dit op" : `${todo.claimedByName.split(" ")[0]} pakt dit op`}
                </Chip>
              )}
              {todo.assignedToId && (
                <Chip className="bg-slate-500/15 text-slate-300">
                  <DoorOpen className="h-3 w-3" /> {todo.room || "Algemeen"}
                </Chip>
              )}
              {todo.dueDate && todo.completed && (
                <Chip className="bg-slate-500/15 text-slate-400">
                  <CalendarDays className="h-3 w-3" /> uiterlijk {todo.dueDate.slice(8, 10)}-{todo.dueDate.slice(5, 7)}
                </Chip>
              )}
            </span>

            {todo.completed && (
              <span className="text-xs text-forest-400">
                Afgerond door {todo.completedByName} &middot; {todo.completedAt && formatDateTime(new Date(todo.completedAt))}
                {todo.completionNote ? ` — ${todo.completionNote}` : ""}
              </span>
            )}
          </button>
        </div>

        {!selectable && !todo.completed && shared && !claimedByOther && (
          <div className="shrink-0 self-start pt-1">
            {claimedByMe ? (
              <button
                type="button"
                onClick={() => void actions.release()}
                disabled={actions.busy === "release"}
                aria-label="Niet meer oppakken"
                title="Vrijgeven"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-forest-500/15 text-forest-300 transition-colors hover:bg-forest-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-400/60"
              >
                <UserCheck className="h-5 w-5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void actions.claim()}
                disabled={actions.busy === "claim"}
                aria-label={`"${todo.title}" oppakken`}
                title="Ik pak dit op"
                className="flex h-10 items-center justify-center gap-1.5 rounded-full px-2.5 text-xs font-medium text-slate-400 transition-colors hover:bg-surface2 hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/60 sm:border sm:border-border sm:px-3"
              >
                <UserCheck className="h-5 w-5 sm:h-4 sm:w-4" /> <span className="hidden sm:inline">Oppakken</span>
              </button>
            )}
          </div>
        )}
      </div>
    </Card>
  );

  return (
    <>
      {swipeActions.length > 0 ? <SwipeRow actions={swipeActions}>{card}</SwipeRow> : card}
      {detailOpen && (
        <TodoDetail
          todo={todo}
          canManage={canManage}
          showRoom={showRoom}
          rooms={rooms}
          actions={actions}
          onClose={() => setDetailOpen(false)}
          onUpdate={(t) => onUpdate?.(t)}
          canReopen={Boolean(onUncomplete)}
        />
      )}
    </>
  );
}
