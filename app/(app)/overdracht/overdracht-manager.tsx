"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ListChecks, Plus, StickyNote, ClipboardList, Workflow } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { isOpenAction, isUnread, type HandoverDigest, type HandoverNote } from "@/lib/handover-shared";
import { type InterventionPlanRow } from "./intervention-plan-panel";
import { ClientPlanCard, InterventionCard, NewInterventionForm, type InterventionRow } from "./interventions-panel";
import { HandoverBoard } from "./handover-board";
import { HandoverComposer, type ComposerClient } from "./handover-composer";
import { HandoverDigestPanel } from "./handover-digest";

export type { InterventionRow };

type View = "notities" | "overzicht" | "interventies" | "plannen";
const VIEWS: View[] = ["notities", "overzicht", "interventies", "plannen"];

export function OverdrachtManager({
  notes,
  digest,
  interventions,
  plans,
  clients,
  viewerId,
  canPrint,
}: {
  notes: HandoverNote[];
  digest: HandoverDigest;
  interventions: InterventionRow[];
  plans: InterventionPlanRow[];
  clients: ComposerClient[];
  viewerId: string;
  canPrint: boolean;
}) {
  const router = useRouter();
  const [view, setView] = React.useState<View>("notities");
  const [composerOpen, setComposerOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<HandoverNote | null>(null);
  const [interventionFormOpen, setInterventionFormOpen] = React.useState(false);

  // The active tab lives in the URL hash so a refresh or a shared link lands in the same place.
  React.useEffect(() => {
    const fromHash = window.location.hash.replace("#", "") as View;
    if (VIEWS.includes(fromHash)) setView(fromHash);
  }, []);
  function selectView(next: View) {
    setView(next);
    window.history.replaceState(null, "", `#${next}`);
  }

  const unread = React.useMemo(() => notes.filter((n) => isUnread(n, viewerId)).length, [notes, viewerId]);
  const openActions = React.useMemo(() => notes.filter(isOpenAction).length, [notes]);
  const openInterventions = React.useMemo(() => interventions.filter((i) => i.status === "OPEN"), [interventions]);
  const activePlanCount = React.useMemo(() => plans.filter((p) => p.status === "ACTIEF").length, [plans]);

  const refresh = React.useCallback(() => router.refresh(), [router]);
  const openComposer = React.useCallback(() => {
    setEditing(null);
    setComposerOpen(true);
  }, []);

  const tabs: { key: View; label: string; count?: number; dot?: boolean; icon: typeof StickyNote }[] = [
    { key: "notities", label: "Notities", count: notes.length, dot: unread > 0, icon: StickyNote },
    { key: "overzicht", label: "Dienstoverzicht", icon: ListChecks },
    { key: "interventies", label: "Interventies", count: interventions.length, icon: ClipboardList },
    { key: "plannen", label: "Interventieplan", count: activePlanCount, icon: Workflow },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <div role="tablist" aria-label="Overdracht" className="-mx-4 flex flex-1 gap-1 overflow-x-auto border-b border-border px-4 sm:mx-0 sm:px-0">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={view === t.key}
              onClick={() => selectView(t.key)}
              className={cn(
                "relative flex h-11 shrink-0 items-center gap-2 border-b-2 px-3 text-sm font-medium transition-colors",
                view === t.key ? "border-rose-400 text-slate-100" : "border-transparent text-slate-500 hover:text-slate-300"
              )}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
              {t.count !== undefined && <span className="text-xs tabular-nums text-slate-500">{t.count}</span>}
              {t.dot && (
                <span className="absolute right-1 top-2 flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400/60 motion-reduce:hidden" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-rose-400" />
                  <span className="sr-only">{unread} ongelezen</span>
                </span>
              )}
            </button>
          ))}
        </div>
        {view === "notities" && (
          <Button size="sm" onClick={openComposer} className="hidden shrink-0 sm:inline-flex">
            <Plus className="h-4 w-4" /> Nieuwe overdracht
          </Button>
        )}
      </div>

      {(openActions > 0 || openInterventions.length > 0) && view !== "interventies" && (
        <div className="flex flex-wrap gap-2 text-sm">
          {openActions > 0 && view !== "notities" && (
            <button type="button" onClick={() => selectView("notities")} className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-500/10 px-3.5 py-1.5 text-amber-300">
              <AlertTriangle className="h-4 w-4" /> {openActions} open actie{openActions === 1 ? "" : "s"} in de notities
            </button>
          )}
          {openInterventions.length > 0 && (
            <button type="button" onClick={() => selectView("interventies")} className="inline-flex items-center gap-2 rounded-full border border-rose-500/30 bg-rose-500/10 px-3.5 py-1.5 text-rose-300">
              <AlertTriangle className="h-4 w-4" /> {openInterventions.length} openstaande interventie{openInterventions.length === 1 ? "" : "s"}
            </button>
          )}
        </div>
      )}

      {view === "notities" && (
        <HandoverBoard
          notes={notes}
          viewerId={viewerId}
          onCompose={openComposer}
          onEdit={(n) => {
            setEditing(n);
            setComposerOpen(true);
          }}
        />
      )}

      {view === "overzicht" && <HandoverDigestPanel digest={digest} canPrint={canPrint} />}

      {view === "interventies" && (
        <>
          {openInterventions.length > 0 && (
            <Card className="border-rose-500/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <AlertTriangle className="h-4.5 w-4.5 text-rose-400" />
                  Openstaande interventies ({openInterventions.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {openInterventions.map((i) => (
                  <InterventionCard key={i.id} intervention={i} onChanged={refresh} />
                ))}
              </CardContent>
            </Card>
          )}
          <div>
            {!interventionFormOpen && (
              <div className="mb-3 flex justify-end">
                <Button size="sm" variant="outline" onClick={() => setInterventionFormOpen(true)}>
                  <Plus className="h-4 w-4" /> Nieuwe interventie
                </Button>
              </div>
            )}
            {interventionFormOpen && (
              <Card>
                <CardHeader>
                  <CardTitle>Nieuwe interventie</CardTitle>
                </CardHeader>
                <CardContent>
                  <NewInterventionForm
                    clients={clients}
                    onSaved={() => {
                      setInterventionFormOpen(false);
                      refresh();
                    }}
                    onCancel={() => setInterventionFormOpen(false)}
                  />
                </CardContent>
              </Card>
            )}
          </div>
          <div className="flex flex-col gap-3">
            {interventions.length === 0 ? (
              <p className="text-slate-500">Nog geen interventies geregistreerd.</p>
            ) : (
              interventions.filter((i) => i.status !== "OPEN").map((i) => <InterventionCard key={i.id} intervention={i} onChanged={refresh} />)
            )}
          </div>
        </>
      )}

      {view === "plannen" && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-slate-400">
            Een interventieplan is een team-traject: een vooraf gepland doel, uitgewerkt per pijler van Verbindend Gezag — los van losse interventies.
          </p>
          {clients.length === 0 ? (
            <p className="text-slate-500">Geen actieve cliënten gevonden.</p>
          ) : (
            clients.map((c) => <ClientPlanCard key={c.id} client={c} plans={plans.filter((p) => p.clientId === c.id)} onChanged={refresh} />)
          )}
        </div>
      )}

      {/* Thumb-reachable primary action on phones, where the header button is hidden. */}
      {view === "notities" && (
        <button
          type="button"
          onClick={openComposer}
          aria-label="Nieuwe overdracht"
          className="fixed bottom-24 right-5 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-brand-gradient text-white shadow-lift transition-transform active:scale-95 sm:hidden"
        >
          <Plus className="h-6 w-6" />
        </button>
      )}

      <HandoverComposer open={composerOpen} onClose={() => setComposerOpen(false)} onSaved={refresh} clients={clients} editing={editing} />
    </div>
  );
}
