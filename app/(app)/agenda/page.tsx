import { CalendarDays } from "lucide-react";
import { db } from "@/lib/db";
import { fullName, formatDateTime } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AppointmentForm } from "./appointment-form";

export const dynamic = "force-dynamic";

export default async function AgendaPage() {
  const [clients, appointments] = await Promise.all([
    db.client.findMany({ where: { active: true }, orderBy: { firstName: "asc" } }),
    db.appointment.findMany({
      where: { startAt: { gte: new Date() } },
      include: { client: true, createdBy: true },
      orderBy: { startAt: "asc" },
      take: 20,
    }),
  ]);

  const clientOptions = clients.map((c) => ({ id: c.id, name: fullName(c) }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-50">Agenda</h1>
        <p className="mt-1 text-slate-400">Aankomende afspraken en herinneringen per e-mail.</p>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold text-slate-100">Aankomend</h2>
        {appointments.length === 0 ? (
          <p className="text-slate-500">Geen aankomende afspraken.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {appointments.map((a) => (
              <Card key={a.id}>
                <CardContent className="flex items-start gap-4 p-5">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky-500/15 text-sky-400">
                    <CalendarDays className="h-5 w-5" />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium text-slate-100">{a.title}</span>
                    <span className="text-sm text-slate-400">{formatDateTime(a.startAt)}</span>
                    {a.client && <span className="text-sm text-slate-400">{fullName(a.client)}</span>}
                    {a.description && <span className="text-sm text-slate-500">{a.description}</span>}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Nieuwe afspraak</CardTitle>
        </CardHeader>
        <CardContent>
          <AppointmentForm clients={clientOptions} />
        </CardContent>
      </Card>
    </div>
  );
}
