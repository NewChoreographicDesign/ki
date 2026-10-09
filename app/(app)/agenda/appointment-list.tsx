"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarDays, Pencil, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AnimatedListItem } from "@/components/ui/animated-list-item";
import { Modal } from "@/components/ui/modal";
import { AppointmentForm } from "./appointment-form";

export type AppointmentRow = {
  id: string;
  title: string;
  description: string | null;
  clientId: string | null;
  clientName: string | null;
  startAtDisplay: string;
  startAtLocal: string;
  endAtLocal?: string | null;
  seriesId?: string | null;
};

// Any staff member can edit a planned appointment (fix a wrong time, client,
// or typo) - the edit itself is unrestricted, but the API logs who changed
// what to the audit trail, which also surfaces in the weekrapport changelog.
// Deleting follows the same no-gate-but-audited model (see
// app/api/appointments/[id]/route.ts) — no are-you-sure dialog, since the
// 5s "Ongedaan maken" toast covers the same mistake far less intrusively
// for something this reversible.
export function AppointmentList({
  appointments,
  clients,
}: {
  appointments: AppointmentRow[];
  clients: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [rows, setRows] = React.useState(appointments);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [exitingIds, setExitingIds] = React.useState<Set<string>>(new Set());
  const [scopePrompt, setScopePrompt] = React.useState<AppointmentRow | null>(null);

  React.useEffect(() => setRows(appointments), [appointments]);

  // Part of a reeks: ask how much to remove first. Standalone: delete at once.
  function requestDelete(a: AppointmentRow) {
    if (a.seriesId) setScopePrompt(a);
    else void handleDelete(a, "this");
  }

  async function handleDelete(a: AppointmentRow, scope: "this" | "following" | "all") {
    setScopePrompt(null);
    try {
      const res = await fetch(`/api/appointments/${a.id}?scope=${scope}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Verwijderen mislukt");
        return;
      }
      if (scope === "this") {
        toast.success("Afspraak verwijderd", {
          duration: 5000,
          action: { label: "Ongedaan maken", onClick: () => handleRestore(a) },
        });
        setExitingIds((prev) => new Set(prev).add(a.id));
      } else {
        toast.success(scope === "all" ? "Hele reeks verwijderd" : "Afspraak en volgende verwijderd");
        router.refresh();
      }
    } catch {
      toast.error("Verwijderen mislukt");
    }
  }

  // Undo re-creates the appointment through the normal create endpoint
  // rather than restoring the deleted row — there's no soft-delete here,
  // so this is a new Appointment with a new id, not literally the same
  // database row. Functionally indistinguishable to the person who just
  // deleted it by mistake.
  async function handleRestore(a: AppointmentRow) {
    try {
      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: a.title, description: a.description, clientId: a.clientId, startAt: a.startAtLocal, endAt: a.endAtLocal ?? "" }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Ongedaan maken mislukt");
        return;
      }
      toast.success("Ongedaan gemaakt");
      router.refresh();
    } catch {
      toast.error("Ongedaan maken mislukt");
    }
  }

  function finishExit(id: string) {
    setExitingIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setRows((prev) => prev.filter((r) => r.id !== id));
  }

  return (
    <div className="flex flex-col gap-3">
      {rows.map((a) => (
        <AnimatedListItem key={a.id} exiting={exitingIds.has(a.id)} onExited={() => finishExit(a.id)}>
          {editingId === a.id ? (
            <Card>
              <CardContent className="p-5">
                <AppointmentForm
                  clients={clients}
                  appointment={a}
                  onSaved={() => setEditingId(null)}
                  onCancel={() => setEditingId(null)}
                />
              </CardContent>
            </Card>
          ) : (
            <Card className="animate-fade-in-up">
              <CardContent className="flex items-start gap-4 p-5">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-500/15 text-rose-400">
                  <CalendarDays className="h-5 w-5" />
                </div>
                <div className="flex flex-1 flex-col gap-0.5">
                  <span className="font-medium text-slate-100">{a.title}</span>
                  <span className="text-sm text-slate-400">
                    {a.startAtDisplay}
                    {a.seriesId && <span className="ml-2 rounded-full bg-surface2 px-2 py-0.5 text-[11px] text-slate-400">reeks</span>}
                  </span>
                  {a.clientName && <span className="text-sm text-slate-400">{a.clientName}</span>}
                  {a.description && <span className="text-sm text-slate-500">{a.description}</span>}
                </div>
                <Button size="icon" variant="ghost" onClick={() => setEditingId(a.id)} aria-label="Afspraak bewerken">
                  <Pencil className="h-4 w-4 text-slate-400" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => requestDelete(a)}
                  aria-label="Afspraak verwijderen"
                  className="text-red-400 hover:text-red-300"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          )}
        </AnimatedListItem>
      ))}
      <Modal open={scopePrompt !== null} onClose={() => setScopePrompt(null)} title="Afspraak verwijderen" className="sm:max-w-sm">
        <p className="mb-4 text-sm text-slate-400">&ldquo;{scopePrompt?.title}&rdquo; is onderdeel van een reeks. Wat wil je verwijderen?</p>
        <div className="flex flex-col gap-2">
          <Button variant="outline" onClick={() => scopePrompt && handleDelete(scopePrompt, "this")}>
            Alleen deze afspraak
          </Button>
          <Button variant="outline" onClick={() => scopePrompt && handleDelete(scopePrompt, "following")}>
            Deze en alle volgende
          </Button>
          <Button variant="danger" onClick={() => scopePrompt && handleDelete(scopePrompt, "all")}>
            Hele reeks
          </Button>
        </div>
      </Modal>
    </div>
  );
}
