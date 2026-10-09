"use client";

import * as React from "react";
import { CalendarDays, List } from "lucide-react";
import { cn } from "@/lib/utils";

/** Agenda: "Lijst" (aankomend + nieuwe afspraak) and "Kalender" (dag/week/maand met kleuren per cliënt). */
export function AgendaTabs({
  initial,
  list,
  calendar,
}: {
  initial: "lijst" | "kalender";
  list: React.ReactNode;
  calendar: React.ReactNode;
}) {
  const [tab, setTab] = React.useState(initial);
  const tabs = [
    { id: "lijst", label: "Lijst", icon: <List className="h-4 w-4" /> },
    { id: "kalender", label: "Kalender", icon: <CalendarDays className="h-4 w-4" /> },
  ] as const;

  function select(id: "lijst" | "kalender") {
    setTab(id);
    // Keep the URL shareable/reload-safe without a navigation.
    const url = new URL(window.location.href);
    url.searchParams.set("weergave", id);
    window.history.replaceState(null, "", url);
  }

  return (
    <div className="flex flex-col gap-5">
      <div role="tablist" aria-label="Agenda-weergave" className="flex w-fit gap-1 rounded-2xl border border-border bg-surface2/40 p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={tab === t.id}
            onClick={() => select(t.id)}
            className={cn(
              "flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors",
              tab === t.id ? "bg-brand-gradient-soft text-rose-300 ring-1 ring-inset ring-rose-400/30" : "text-slate-400 hover:text-slate-200"
            )}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>
      {/* Both stay mounted-on-demand: the calendar fetches its own data only when opened. */}
      {tab === "lijst" ? list : calendar}
    </div>
  );
}
