"use client";

import * as React from "react";
import { toast } from "sonner";
import { CalendarDays, Clock, HelpCircle, Plus, SlidersHorizontal, Tag, Timer, User, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AGENDA_TITLE_MAX, parseAgendaQuickAdd, quickAddToLocal, type AgendaItem, type AgendaQuickAddResult } from "@/lib/agenda-shared";
import { amsterdamNow } from "@/lib/date-shared";
import { api, apiMessage } from "./agenda-ui";
import { useAgendaEnv } from "./agenda-env";
import type { AppointmentPrefill } from "./appointment-form";

const CHIP_ICON = { time: Clock, date: CalendarDays, duration: Timer, allday: CalendarDays, category: Tag, client: User, assignee: UserCheck } as const;
const PLACEHOLDER = "Nieuwe afspraak, bijv. morgen 14:00 tandarts @els";

/** Everything a parsed line says, as form values (used for "Alle opties" and when the time is missing). */
export function prefillFromQuickAdd(parsed: AgendaQuickAddResult, today: string, viewerId: string): AppointmentPrefill {
  const local = quickAddToLocal(parsed, today);
  const date = parsed.date ?? today;
  return {
    title: parsed.title,
    startAt: local?.startAt ?? `${date}T09:00`,
    endAt: local?.endAt ?? "",
    allDay: parsed.allDay,
    category: parsed.category,
    clientId: parsed.clientId,
    assigneeId: parsed.assigneeId === "me" ? viewerId : parsed.assigneeId,
  };
}

/**
 * One line, Enter, done. Understands a time, a day, a length, a category, a
 * cliënt and a begeleider typed inline (see parseAgendaQuickAdd) and shows
 * what it understood before anything is saved. Covers the everyday case
 * instantly. Without a time it opens the full form with what was typed
 * instead of guessing one.
 */
export function QuickAdd({
  onCreated,
  onMore,
  inputRef,
}: {
  onCreated: (item: AgendaItem | null) => void;
  onMore: (prefill: AppointmentPrefill) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}) {
  const { clients, staff, viewerId, nowMs } = useAgendaEnv();
  const [text, setText] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [help, setHelp] = React.useState(false);

  const today = amsterdamNow(nowMs || Date.now()).dateISO;
  const parsed = React.useMemo(() => parseAgendaQuickAdd(text, today, clients, staff), [text, today, clients, staff]);
  const local = quickAddToLocal(parsed, today);
  const canAdd = parsed.title.length > 0 && !saving;

  async function submit() {
    if (!canAdd) {
      if (text.trim() && !parsed.title) toast.error("Geef de afspraak ook een naam");
      return;
    }
    if (!local) {
      // No time typed: let the person choose one instead of inventing it.
      onMore(prefillFromQuickAdd(parsed, today, viewerId));
      setText("");
      return;
    }
    setSaving(true);
    const res = await api("/api/appointments", "POST", {
      title: parsed.title,
      startAt: local.startAt,
      endAt: local.endAt,
      allDay: parsed.allDay,
      category: parsed.category ?? "",
      clientId: parsed.clientId ?? "",
      assigneeId: parsed.assigneeId === "me" ? viewerId : parsed.assigneeId ?? "",
    });
    setSaving(false);
    if (!res.ok) {
      toast.error(apiMessage(res, "Toevoegen mislukt"));
      return;
    }
    setText("");
    const created: AgendaItem | null = res.data.appointment ?? null;
    toast.success("Afspraak toegevoegd", {
      duration: 6000,
      action: created ? { label: "Ongedaan maken", onClick: () => void api(`/api/appointments/${created.id}?scope=this`, "DELETE").then((r) => r.ok && onCreated(null)) } : undefined,
    });
    onCreated(created);
    inputRef.current?.focus();
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      className="flex flex-col gap-2"
      aria-label="Snel een afspraak toevoegen"
    >
      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Plus className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" aria-hidden="true" />
          <input
            ref={inputRef}
            value={text}
            maxLength={AGENDA_TITLE_MAX + 80}
            onChange={(e) => setText(e.target.value)}
            placeholder={PLACEHOLDER}
            aria-label="Nieuwe afspraak"
            enterKeyHint="done"
            autoComplete="off"
            className="h-12 w-full rounded-xl border border-border bg-surface2 pl-11 pr-3 text-base text-slate-100 placeholder:text-slate-500 focus:border-rose-400/70 focus:outline-none focus:ring-2 focus:ring-rose-400/30"
          />
        </div>
        <Button type="submit" size="lg" className="h-12 px-3.5 sm:px-5" loading={saving} disabled={!canAdd} aria-label="Afspraak toevoegen">
          <Plus className="h-5 w-5 sm:hidden" aria-hidden="true" />
          <span className="hidden sm:inline">{text.trim() && canAdd && !local ? "Kies tijd" : "Toevoegen"}</span>
        </Button>
        <Button type="button" variant="outline" className="h-12 w-12 shrink-0 px-0" aria-label="Alle opties" title="Alle opties (omschrijving, herhaling, herinnering)" onClick={() => onMore(prefillFromQuickAdd(parsed, today, viewerId))}>
          <SlidersHorizontal className="h-5 w-5" />
        </Button>
        <button type="button" onClick={() => setHelp((v) => !v)} aria-expanded={help} aria-label="Uitleg snel toevoegen" className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:text-slate-200 sm:flex">
          <HelpCircle className="h-5 w-5" />
        </button>
      </div>

      {text.trim() && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs" aria-live="polite">
          <span className="text-slate-500">Wordt:</span>
          <span className={cn("rounded-full bg-surface2 px-2 py-0.5 font-medium", parsed.title ? "text-slate-100" : "text-slate-500")}>{parsed.title || "(geef een naam)"}</span>
          {parsed.chips.map((c, i) => {
            const Icon = CHIP_ICON[c.kind];
            return (
              <span key={`${c.kind}-${i}`} className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2 py-0.5 font-medium text-rose-300">
                <Icon className="h-3 w-3" /> {c.label}
              </span>
            );
          })}
          <span className="text-slate-600">{local ? "· Enter om toe te voegen" : "· geen tijd herkend: Enter opent het formulier"}</span>
        </div>
      )}

      {help && (
        <ul className="grid gap-1 rounded-xl border border-border bg-surface2/40 p-3 text-xs text-slate-400 sm:grid-cols-2">
          <li><strong className="text-slate-300">Tijd:</strong> 14:00, 9.30, &quot;om 9 uur&quot;, 14:00-15:30 of &quot;tot 15:30&quot;</li>
          <li><strong className="text-slate-300">Duur:</strong> 45min, 1u of 1,5u</li>
          <li><strong className="text-slate-300">Dag:</strong> vandaag, morgen, overmorgen, vrijdag, 12-3 — of &quot;hele dag&quot;</li>
          <li><strong className="text-slate-300">Soort:</strong> #medisch, #fysio, #bezoek, #activiteit, #overleg, #vervoer</li>
          <li><strong className="text-slate-300">Cliënt:</strong> @ en het begin van de naam, bijv. @els</li>
          <li><strong className="text-slate-300">Wie gaat mee:</strong> +ik of + het begin van een naam</li>
        </ul>
      )}
    </form>
  );
}
