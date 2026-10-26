"use client";

import * as React from "react";
import { toast } from "sonner";
import { CalendarDays, Clock, Flag, HelpCircle, Plus, SlidersHorizontal, Tag, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { amsterdamNow, parseQuickAdd, TODO_TITLE_MAX, type QuickAddResult, type TodoData } from "@/lib/todos-shared";
import { api, apiMessage } from "./todo-ui";
import { useTodoEnv } from "./todo-env";

const CHIP_ICON = { time: Clock, date: CalendarDays, priority: Flag, category: Tag, client: User } as const;
const PLACEHOLDER = "Nieuwe taak, bijv. morgen 9:30 bellen !hoog";

/**
 * One line, Enter, done. Understands a time, a day, a priority, a category and
 * a client typed inline (see parseQuickAdd) and shows what it understood
 * before anything is saved. Deterministic, no AI involved.
 */
export function QuickAdd({
  onCreated,
  onMore,
  inputRef,
}: {
  onCreated: (todo: TodoData) => void;
  /** Open the full form with what was typed so far. */
  onMore: (parsed: QuickAddResult) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}) {
  const { clients, nowMs } = useTodoEnv();
  const [text, setText] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [help, setHelp] = React.useState(false);

  const today = amsterdamNow(nowMs || Date.now()).dateISO;
  const parsed = React.useMemo(() => parseQuickAdd(text, today, clients), [text, today, clients]);
  const canAdd = parsed.title.length > 0 && !saving;

  async function submit() {
    if (!canAdd) {
      if (text.trim() && !parsed.title) toast.error("Geef de taak ook een naam");
      return;
    }
    setSaving(true);
    const res = await api("/api/todos", "POST", {
      title: parsed.title,
      priority: parsed.priority ?? "MEDIUM",
      time: parsed.time ?? undefined,
      dueDate: parsed.dueDate ?? undefined,
      category: parsed.category,
      clientId: parsed.clientId,
    });
    setSaving(false);
    if (!res.ok || !res.data.todo) {
      toast.error(apiMessage(res, "Toevoegen mislukt"));
      return;
    }
    setText("");
    toast.success("Taak toegevoegd");
    onCreated(res.data.todo);
    inputRef.current?.focus();
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      className="flex flex-col gap-2"
      aria-label="Snel een taak toevoegen"
    >
      <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
        <div className="relative min-w-[11rem] flex-1">
          <Plus className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" aria-hidden="true" />
          <input
            ref={inputRef}
            value={text}
            maxLength={TODO_TITLE_MAX + 60}
            onChange={(e) => setText(e.target.value)}
            placeholder={PLACEHOLDER}
            aria-label="Nieuwe taak"
            enterKeyHint="done"
            autoComplete="off"
            className="h-12 w-full rounded-xl border border-border bg-surface2 pl-11 pr-3 text-base text-slate-100 placeholder:text-slate-500 focus:border-rose-400/70 focus:outline-none focus:ring-2 focus:ring-rose-400/30"
          />
        </div>
        <Button type="submit" size="lg" className="h-12 px-4 sm:px-5" loading={saving} disabled={!canAdd}>
          Toevoegen
        </Button>
        <Button type="button" variant="outline" className="h-12 w-12 px-0" aria-label="Alle opties" title="Alle opties (omschrijving, stappen, herhaling)" onClick={() => onMore(parsed)}>
          <SlidersHorizontal className="h-5 w-5" />
        </Button>
        <button
          type="button"
          onClick={() => setHelp((v) => !v)}
          aria-expanded={help}
          aria-label="Uitleg snel toevoegen"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:text-slate-200"
        >
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
          <span className="text-slate-600">· Enter om toe te voegen</span>
        </div>
      )}

      {help && (
        <ul className="grid gap-1 rounded-xl border border-border bg-surface2/40 p-3 text-xs text-slate-400 sm:grid-cols-2">
          <li><strong className="text-slate-300">Tijd:</strong> 09:30, 9.30 of &quot;om 9 uur&quot;</li>
          <li><strong className="text-slate-300">Dag:</strong> vandaag, morgen, overmorgen, vrijdag, 12-3</li>
          <li><strong className="text-slate-300">Prioriteit:</strong> !hoog, !laag, of !! voor hoog</li>
          <li><strong className="text-slate-300">Categorie:</strong> #zorg, #medicatie, #huishouding, #admin, #afspraak</li>
          <li><strong className="text-slate-300">Cliënt:</strong> @ en het begin van de naam, bijv. @els</li>
          <li><strong className="text-slate-300">Meer:</strong> stappen, herhaling en omschrijving via de knop &quot;Alle opties&quot;</li>
        </ul>
      )}
    </form>
  );
}
