"use client";

import * as React from "react";
import { toast } from "sonner";
import { snoozeUntil, type SnoozePreset, type TodoData } from "@/lib/todos-shared";
import { api, apiMessage, formatMoment } from "./todo-ui";
import { useTodoEnv } from "./todo-env";

export type TodoCallbacks = {
  onComplete?: (todo: TodoData) => void;
  /** Only passed by parents that can move a task back to the open list — when omitted no "Ongedaan maken" is offered. */
  onUncomplete?: (todo: TodoData) => void;
  onUpdate?: (todo: TodoData) => void;
  onDelete?: (id: string) => void;
};

/**
 * Every single-task action (complete, undo, claim, snooze, tick a step,
 * delete) in one place, shared by the card and the detail sheet. Each one
 * reports through a toast and tells the parent about the changed task, so the
 * list never needs a full reload to show it.
 */
export function useTodoActions(todo: TodoData, { onComplete, onUncomplete, onUpdate, onDelete }: TodoCallbacks) {
  const { nowMs } = useTodoEnv();
  const [busy, setBusy] = React.useState<string | null>(null);

  async function run<T>(key: string, fn: () => Promise<T>): Promise<T | undefined> {
    if (busy) return undefined;
    setBusy(key);
    try {
      return await fn();
    } finally {
      setBusy(null);
    }
  }

  const uncomplete = React.useCallback(async () => {
    const res = await api(`/api/todos/${todo.id}/complete`, "DELETE");
    if (!res.ok || !res.data.todo) {
      toast.error(apiMessage(res, "Ongedaan maken mislukt"));
      return;
    }
    toast.success("Ongedaan gemaakt");
    onUncomplete?.(res.data.todo);
  }, [todo.id, onUncomplete]);

  const setSnooze = React.useCallback(
    async (until: string | null, silent = false): Promise<boolean> => {
      const res = await api(`/api/todos/${todo.id}/snooze`, "POST", { until });
      if (!res.ok || !res.data.todo) {
        toast.error(apiMessage(res, "Uitstellen mislukt"));
        return false;
      }
      if (!silent) {
        toast.success(until ? `Uitgesteld tot ${formatMoment(until, Date.now())}` : "Weer op de lijst", {
          duration: 5000,
          action: until ? { label: "Ongedaan maken", onClick: () => void setSnooze(null, true) } : undefined,
        });
      }
      onUpdate?.(res.data.todo);
      return true;
    },
    [todo.id, onUpdate]
  );

  return {
    busy,

    complete: (note?: string) =>
      run("complete", async () => {
        const res = await api(`/api/todos/${todo.id}/complete`, "POST", { completionNote: note ?? "" });
        if (!res.ok || !res.data.todo) {
          toast.error(apiMessage(res, "Afronden mislukt"));
          return false;
        }
        const open = todo.checklist.filter((i) => !i.done).length;
        toast.success(open > 0 ? `Taak afgerond · ${open} ${open === 1 ? "stap stond" : "stappen stonden"} nog open` : "Taak afgerond", {
          duration: 5000,
          action: onUncomplete ? { label: "Ongedaan maken", onClick: () => void uncomplete() } : undefined,
        });
        onComplete?.(res.data.todo);
        return true;
      }),

    reopen: () => run("reopen", uncomplete),

    claim: (force = false) =>
      run("claim", async () => {
        let res = await api(`/api/todos/${todo.id}/claim`, "POST", { action: "claim", force });
        if (res.status === 409 && !force) {
          const takeOver = window.confirm(`${res.data.error ?? "Een collega pakt dit al op"}\n\nWil je het toch van je collega overnemen?`);
          if (!takeOver) return;
          res = await api(`/api/todos/${todo.id}/claim`, "POST", { action: "claim", force: true });
        }
        if (!res.ok || !res.data.todo) {
          toast.error(apiMessage(res, "Oppakken mislukt"));
          return;
        }
        toast.success("Jij pakt dit op");
        onUpdate?.(res.data.todo);
      }),

    release: () =>
      run("release", async () => {
        const res = await api(`/api/todos/${todo.id}/claim`, "POST", { action: "release" });
        if (!res.ok || !res.data.todo) {
          toast.error(apiMessage(res, "Vrijgeven mislukt"));
          return;
        }
        onUpdate?.(res.data.todo);
      }),

    snooze: (preset: SnoozePreset | null) => run("snooze", () => setSnooze(preset ? snoozeUntil(preset, nowMs || Date.now()) : null)),

    toggleStep: async (itemId: string, done: boolean) => {
      const res = await api(`/api/todos/${todo.id}/checklist`, "POST", { itemId, done });
      if (!res.ok || !res.data.todo) {
        toast.error(apiMessage(res, "Opslaan mislukt"));
        return false;
      }
      onUpdate?.(res.data.todo);
      return true;
    },

    remove: () =>
      run("delete", async () => {
        const ok = window.confirm(`"${todo.title}" verwijderen?\n\nDit kan niet ongedaan worden gemaakt.`);
        if (!ok) return false;
        const res = await api(`/api/todos/${todo.id}`, "DELETE");
        if (!res.ok) {
          toast.error(apiMessage(res, "Verwijderen mislukt"));
          return false;
        }
        toast.success("Taak verwijderd");
        onDelete?.(todo.id);
        return true;
      }),
  };
}
