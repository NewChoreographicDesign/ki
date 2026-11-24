"use client";

import * as React from "react";
import { toast } from "sonner";
import { Plus, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/empty-state";
import { ALLOWANCE_STATE_LABEL, compareAllowanceUrgency, effectiveAllowanceState, type AllowanceData, type AllowanceEffectiveState } from "@/lib/allowances-shared";
import { allowanceApi, allowanceApiMessage } from "./allowance-ui";
import { AllowanceCard } from "./allowance-card";
import { AllowanceForm, type AllowanceClientOption } from "./allowance-form";

type Action = "start" | "pause" | "resume" | "complete" | "extend";

// Order matters: most urgent first. "soon" and "running" are kept as
// separate groups (rather than folded together) so a card that's about to
// run out doesn't get buried among several that aren't.
const GROUP_ORDER: AllowanceEffectiveState[] = ["expired", "running", "soon", "paused", "scheduled"];

export function AllowanceBoard({
  active,
  now,
  clients,
  onCreated,
  onUpdated,
}: {
  active: AllowanceData[];
  now: number;
  clients: AllowanceClientOption[];
  onCreated: (a: AllowanceData) => void;
  onUpdated: (a: AllowanceData) => void;
}) {
  const [formOpen, setFormOpen] = React.useState(false);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  async function act(a: AllowanceData, action: Action) {
    setBusyId(a.id);
    const res = await allowanceApi(`/api/allowances/${a.id}`, "PATCH", { action });
    setBusyId(null);
    if (!res.ok || !res.data.allowance) {
      toast.error(allowanceApiMessage(res, "Actie mislukt"));
      return;
    }
    onUpdated(res.data.allowance);
  }

  const grouped = GROUP_ORDER.map((state) => ({
    state,
    items: active.filter((a) => effectiveAllowanceState(a, now) === state).sort((a, b) => compareAllowanceUrgency(a, b, now)),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">Toegestane tijd</h2>
          <p className="mt-0.5 text-sm text-slate-400">Telefoon, bezoek, buiten en meer — met een timer of een eindtijd per cliënt.</p>
        </div>
        <Button onClick={() => setFormOpen(true)} disabled={clients.length === 0}>
          <Plus className="h-4 w-4" /> Nieuwe toestemming
        </Button>
      </div>

      {grouped.length === 0 ? (
        <EmptyState
          icon={Timer}
          title="Nog geen toegestane tijd"
          description="Geef een cliënt toestemming voor telefoon, bezoek of buiten met de knop hierboven."
          action={clients.length > 0 ? { label: "Nieuwe toestemming", onClick: () => setFormOpen(true) } : undefined}
        />
      ) : (
        grouped.map((g) => (
          <section key={g.state} className="flex flex-col gap-2.5">
            <h3 className={g.state === "expired" ? "flex items-baseline gap-2 text-sm font-semibold text-red-300" : "flex items-baseline gap-2 text-sm font-semibold text-slate-400"}>
              {ALLOWANCE_STATE_LABEL[g.state]}
              <span className="text-xs font-normal tabular-nums text-slate-500">{g.items.length}</span>
            </h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {g.items.map((a) => (
                <AllowanceCard key={a.id} allowance={a} now={now} busy={busyId === a.id} onAction={(action) => void act(a, action)} />
              ))}
            </div>
          </section>
        ))
      )}

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title="Nieuwe toestemming">
        <AllowanceForm
          clients={clients}
          onCreated={(a) => {
            setFormOpen(false);
            onCreated(a);
          }}
          onCancel={() => setFormOpen(false)}
        />
      </Modal>
    </div>
  );
}
