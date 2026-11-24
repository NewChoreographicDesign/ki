"use client";

import * as React from "react";
import { ListTodo, Timer } from "lucide-react";
import { cn } from "@/lib/utils";
import { effectiveAllowanceState, type AllowanceData } from "@/lib/allowances-shared";
import { allowanceApi } from "./allowance-ui";
import { AllowanceBoard } from "./allowance-board";
import { type AllowanceClientOption } from "./allowance-form";
import { CompletedAllowanceBanner } from "./completed-allowance-banner";
import { TodoBoard } from "./todo-board";
import type { TodoClientOption, TodoData } from "@/lib/todos-shared";

type Tab = "taken" | "toegestane-tijd";

const POLL_MS = 20_000;

export function WerklijstShell(props: {
  // Werklijst (Taken) — passed straight through to the existing TodoBoard.
  initialOpen: TodoData[];
  initialCompleted: TodoData[];
  serverNow: number;
  todoClients: TodoClientOption[];
  viewerId: string;
  canSupervise: boolean;
  // Toegestane tijd
  initialActive: AllowanceData[];
  initialCompletedToday: AllowanceData[];
  allowanceClients: AllowanceClientOption[];
}) {
  const [tab, setTab] = React.useState<Tab>("taken");
  const [active, setActive] = React.useState(props.initialActive);
  const [completedToday, setCompletedToday] = React.useState(props.initialCompletedToday);
  const [now, setNow] = React.useState(props.serverNow);

  React.useEffect(() => {
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(tick);
  }, []);

  const epoch = React.useRef(0);
  const refresh = React.useCallback(async () => {
    const startedAt = epoch.current;
    const res = await allowanceApi("/api/allowances", "GET");
    if (!res.ok || !res.data.active || !res.data.completedToday) return;
    if (epoch.current !== startedAt) return; // a local action happened while this was in flight
    setActive(res.data.active);
    setCompletedToday(res.data.completedToday);
  }, []);

  React.useEffect(() => {
    const poll = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(poll);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  function handleCreated(a: AllowanceData) {
    epoch.current++;
    setActive((prev) => [...prev, a]);
  }

  function handleUpdated(a: AllowanceData) {
    epoch.current++;
    setActive((prev) => prev.filter((x) => x.id !== a.id).concat(a.status === "COMPLETED" ? [] : [a]));
    if (a.status === "COMPLETED") {
      setCompletedToday((prev) => [a, ...prev.filter((x) => x.id !== a.id)]);
    }
  }

  const activeCount = active.filter((a) => {
    const s = effectiveAllowanceState(a, now);
    return s === "running" || s === "soon" || s === "expired";
  }).length;

  return (
    <div className="flex flex-col gap-5">
      <div role="tablist" aria-label="Werklijst" className="flex w-fit gap-1 rounded-xl border border-border bg-surface2 p-1">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "taken"}
          onClick={() => setTab("taken")}
          className={cn(
            "flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
            tab === "taken" ? "bg-surface text-slate-50 shadow-sm" : "text-slate-400 hover:text-slate-200"
          )}
        >
          <ListTodo className="h-4 w-4" /> Taken
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "toegestane-tijd"}
          onClick={() => setTab("toegestane-tijd")}
          className={cn(
            "flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
            tab === "toegestane-tijd" ? "bg-surface text-slate-50 shadow-sm" : "text-slate-400 hover:text-slate-200"
          )}
        >
          <Timer className="h-4 w-4" /> Toegestane tijd
          {activeCount > 0 && <span className="rounded-full bg-rose-500/20 px-1.5 text-xs tabular-nums text-rose-300">{activeCount}</span>}
        </button>
      </div>

      {tab === "taken" ? (
        <div className="flex flex-col gap-5">
          <CompletedAllowanceBanner items={completedToday} />
          <TodoBoard
            initialOpen={props.initialOpen}
            initialCompleted={props.initialCompleted}
            serverNow={props.serverNow}
            clients={props.todoClients}
            viewerId={props.viewerId}
            canSupervise={props.canSupervise}
          />
        </div>
      ) : (
        <AllowanceBoard active={active} now={now} clients={props.allowanceClients} onCreated={handleCreated} onUpdated={handleUpdated} />
      )}
    </div>
  );
}
