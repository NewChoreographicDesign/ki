import { db } from "@/lib/db";
import { fullName } from "@/lib/utils";
import { MedicationManager } from "./medication-manager";

export const dynamic = "force-dynamic";

export default async function BackendMedicatiePage() {
  const [medications, clients] = await Promise.all([
    db.medication.findMany({ include: { client: true }, orderBy: { createdAt: "desc" } }),
    db.client.findMany({ where: { active: true }, orderBy: { firstName: "asc" } }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-50">Medicatie beheer</h1>
        <p className="mt-1 text-slate-400">Voeg medicatie toe per cliënt.</p>
      </div>
      <MedicationManager
        medications={medications.map((m) => ({
          id: m.id,
          name: m.name,
          dosage: m.dosage,
          times: m.times,
          active: m.active,
          clientName: fullName(m.client),
        }))}
        clients={clients.map((c) => ({ id: c.id, name: fullName(c) }))}
      />
    </div>
  );
}
