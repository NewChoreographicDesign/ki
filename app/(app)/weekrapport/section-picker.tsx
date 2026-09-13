"use client";

import * as React from "react";
import { Download, Archive } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";

// Keys must match WEEKLY_REPORT_SECTION_KEYS in lib/weekly-report.ts. Not
// imported directly — that file is "server-only" and would break this
// client component — so the five keys are just duplicated here as a small,
// stable, rarely-changing list.
const SECTIONS = [
  { key: "reports", label: "Rapportages" },
  { key: "medication", label: "Medicatie" },
  { key: "todos", label: "Werklijst" },
  { key: "appointments", label: "Afspraken" },
  { key: "changelog", label: "Wijzigingen" },
] as const;

export type ArchiveRow = { id: string; isoYear: number; isoWeek: number; weekStart: string };

/**
 * One shared section selection drives every download control on the page:
 * the live week's .txt export and every archived week's PDF link. Picking
 * once applies everywhere, rather than repeating five checkboxes per
 * archived row — a list that can grow to a year's worth of weeks. Renders
 * the section picker, the Archief card, and the live-week download row as
 * one unit so they can all share this component's state; the rest of the
 * page (the actual data cards) stays server-rendered underneath it.
 */
export function WeekrapportDownloads({
  archive,
  weekStartLabel,
}: {
  archive: ArchiveRow[];
  weekStartLabel: string;
}) {
  const [selected, setSelected] = React.useState<Set<string>>(() => new Set(SECTIONS.map((s) => s.key)));

  function toggle(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const sectionsParam = SECTIONS.filter((s) => selected.has(s.key))
    .map((s) => s.key)
    .join(",");
  const noneSelected = selected.size === 0;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Secties</CardTitle>
          <CardDescription>
            Kies welke onderdelen worden meegenomen bij het downloaden — geldt voor de export
            hieronder en voor elk gearchiveerd weekrapport.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-x-6 gap-y-2">
          {SECTIONS.map((s) => (
            <label key={s.key} className="flex items-center gap-2 text-sm text-slate-200">
              <input
                type="checkbox"
                checked={selected.has(s.key)}
                onChange={() => toggle(s.key)}
                className="h-4 w-4 rounded border-slate-600 bg-surface2 accent-sky-500"
              />
              {s.label}
            </label>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Archive className="h-4 w-4" /> Archief (automatisch, per kalenderweek)
          </CardTitle>
          <CardDescription>
            Elke maandagochtend wordt de afgelopen week automatisch vastgelegd als PDF — hierin
            staan alle acties van die week. PDF&apos;s worden 1 jaar bewaard; oudere worden
            automatisch verwijderd.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {archive.length === 0 ? (
            <p className="text-slate-500">
              Nog geen afgeronde week gearchiveerd — dat gebeurt vanaf de eerstvolgende maandag.
            </p>
          ) : (
            archive.map((a) => (
              <div
                key={a.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface2 px-3 py-2"
              >
                <span className="text-sm text-slate-200">
                  Week {a.isoWeek}, {a.isoYear}{" "}
                  <span className="text-slate-500">({formatDate(new Date(a.weekStart))})</span>
                </span>
                <a
                  href={noneSelected ? undefined : `/api/weekrapport/archive/${a.id}?sections=${sectionsParam}`}
                  aria-disabled={noneSelected}
                  onClick={(e) => noneSelected && e.preventDefault()}
                >
                  <Button size="sm" variant="outline" className="gap-2" disabled={noneSelected}>
                    <Download className="h-4 w-4" /> PDF
                  </Button>
                </a>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">Deze week (nog niet afgerond)</h2>
          <p className="mt-1 text-sm text-slate-400">
            Live overzicht sinds {weekStartLabel} — wordt aankomende maandag automatisch aan het
            archief hierboven toegevoegd.
          </p>
        </div>
        <a
          href={noneSelected ? undefined : `/api/weekrapport/download?sections=${sectionsParam}`}
          aria-disabled={noneSelected}
          onClick={(e) => noneSelected && e.preventDefault()}
        >
          <Button variant="outline" className="gap-2" disabled={noneSelected}>
            <Download className="h-4 w-4" />
            Voortgang (.txt)
          </Button>
        </a>
      </div>
    </>
  );
}
