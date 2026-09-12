"use client";

import * as React from "react";
import { CalendarDays, Pencil } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AppointmentForm } from "./appointment-form";

export type AppointmentRow = {
  id: string;
  title: string;
  description: string | null;
  clientId: string | null;
  clientName: string | null;
  startAtDisplay: string;
  startAtLocal: string;
};

// Any staff member can edit a planned appointment (fix a wrong time, client,
// or typo) - the edit itself is unrestricted, but the API logs who changed
// what to the audit trail, which also surfaces in the weekrapport changelog.
export function AppointmentList({
  appointments,
  clients,
}: {
  appointments: AppointmentRow[];
  clients: { id: string; name: string }[];
}) {
  const [editingId, setEditingId] = React.useState<string | null>(null);

  return (
    <div className="flex flex-col gap-3">
      {appointments.map((a) =>
        editingId === a.id ? (
          <Card key={a.id}>
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
          <Card key={a.id}>
            <CardContent className="flex items-start gap-4 p-5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky-500/15 text-sky-400">
                <CalendarDays className="h-5 w-5" />
              </div>
              <div className="flex flex-1 flex-col gap-0.5">
                <span className="font-medium text-slate-100">{a.title}</span>
                <span className="text-sm text-slate-400">{a.startAtDisplay}</span>
                {a.clientName && <span className="text-sm text-slate-400">{a.clientName}</span>}
                {a.description && <span className="text-sm text-slate-500">{a.description}</span>}
              </div>
              <Button size="icon" variant="ghost" onClick={() => setEditingId(a.id)} aria-label="Afspraak bewerken">
                <Pencil className="h-4 w-4 text-slate-400" />
              </Button>
            </CardContent>
          </Card>
        )
      )}
    </div>
  );
}
