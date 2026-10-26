import { db } from "@/lib/db";
import { fullName } from "@/lib/utils";
import { getDataset } from "@/lib/interaction-data";
import { MedicationManager } from "./medication-manager";
import { InteractionDatasetCard } from "./interaction-dataset-card";

export const dynamic = "force-dynamic";

export default async function BackendMedicatiePage() {
  const [medications, clients, dataset] = await Promise.all([
    db.medication.findMany({ include: { client: true }, orderBy: { createdAt: "desc" } }),
    db.client.findMany({ where: { active: true }, orderBy: { firstName: "asc" } }),
    getDataset(),
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
          instructions: m.instructions,
          times: m.times,
          asNeeded: m.asNeeded,
          active: m.active,
          atcCode: m.atcCode,
          clientName: fullName(m.client),
        }))}
        clients={clients.map((c) => ({ id: c.id, name: fullName(c) }))}
      />
      <InteractionDatasetCard
        dataset={
          dataset
            ? { source: dataset.source, version: dataset.version, rowCount: dataset.rowCount, importedAt: dataset.importedAt.toISOString() }
            : null
        }
      />
    </div>
  );
}
