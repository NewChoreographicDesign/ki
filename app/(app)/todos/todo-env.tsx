"use client";

import * as React from "react";
import type { TodoClientOption } from "@/lib/todos-shared";

type TodoEnv = {
  clients: TodoClientOption[];
  viewerId: string;
  /** Admin / coordinator: may select several tasks and manage everyone's. */
  canSupervise: boolean;
  /** "Now" — server clock at first render (so SSR and hydration agree), then the device clock every 30 s. */
  nowMs: number;
};

const DEFAULT_ENV: TodoEnv = { clients: [], viewerId: "", canSupervise: false, nowMs: 0 };
const TodoEnvContext = React.createContext<TodoEnv>(DEFAULT_ENV);

export function useTodoEnv(): TodoEnv {
  return React.useContext(TodoEnvContext);
}

const TICK_MS = 30_000;

/** Everything the task components share, so the Werklijst, the Dashboard widget and "Taken toewijzen" don't each thread props through. */
export function TodoEnvProvider({
  serverNow,
  clients = [],
  viewerId,
  canSupervise = false,
  children,
}: {
  serverNow: number;
  clients?: TodoClientOption[];
  viewerId: string;
  canSupervise?: boolean;
  children: React.ReactNode;
}) {
  const [nowMs, setNowMs] = React.useState(serverNow);
  React.useEffect(() => {
    const tick = window.setInterval(() => setNowMs(Date.now()), TICK_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") setNowMs(Date.now());
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(tick);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
  const value = React.useMemo(() => ({ clients, viewerId, canSupervise, nowMs }), [clients, viewerId, canSupervise, nowMs]);
  return <TodoEnvContext.Provider value={value}>{children}</TodoEnvContext.Provider>;
}
