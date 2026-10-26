"use client";

import * as React from "react";
import type { AgendaClientOption, AgendaStaffOption } from "@/lib/agenda-shared";

type AgendaEnv = {
  clients: AgendaClientOption[];
  staff: AgendaStaffOption[];
  viewerId: string;
  /** Admin / coordinator. */
  canSupervise: boolean;
  /** "Now" — server clock at first render (so SSR and hydration agree), then the device clock every 30 s. */
  nowMs: number;
};

const DEFAULT_ENV: AgendaEnv = { clients: [], staff: [], viewerId: "", canSupervise: false, nowMs: 0 };
const AgendaEnvContext = React.createContext<AgendaEnv>(DEFAULT_ENV);

export function useAgendaEnv(): AgendaEnv {
  return React.useContext(AgendaEnvContext);
}

const TICK_MS = 30_000;

export function AgendaEnvProvider({ serverNow, children, ...rest }: Omit<AgendaEnv, "nowMs"> & { serverNow: number; children: React.ReactNode }) {
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
  const { clients, staff, viewerId, canSupervise } = rest;
  const value = React.useMemo(() => ({ clients, staff, viewerId, canSupervise, nowMs }), [clients, staff, viewerId, canSupervise, nowMs]);
  return <AgendaEnvContext.Provider value={value}>{children}</AgendaEnvContext.Provider>;
}
