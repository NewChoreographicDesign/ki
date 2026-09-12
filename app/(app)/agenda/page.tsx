import { db } from "@/lib/db";
import { fullName, formatDateTime, toDatetimeLocalValue } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AppointmentForm } from "./appointment-form";
import { AppointmentList } from "./appointment-list";

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
        <p className="mt-1 text-slate-400">Aankomende afspraken, voor iedereen zichtbaar in de app.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Nieuwe afspraak</CardTitle>
        </CardHeader>
        <CardContent>
          <AppointmentForm clients={clientOptions} />
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-3 text-lg font-semibold text-slate-100">Aankomend</h2>
        {appointments.length === 0 ? (
          <p className="text-slate-500">Geen aankomende afspraken.</p>
        ) : (
          <AppointmentList
            clients={clientOptions}
            appointments={appointments.map((a) => ({
              id: a.id,
              title: a.title,
              description: a.description,
              clientId: a.clientId,
              clientName: a.client ? fullName(a.client) : null,
              startAtDisplay: formatDateTime(a.startAt),
              startAtLocal: toDatetimeLocalValue(a.startAt),
            }))}
          />
        )}
      </div>
    </div>
  );
}
