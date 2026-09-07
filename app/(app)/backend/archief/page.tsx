import { db } from "@/lib/db";
import { fullName } from "@/lib/utils";
import { ArchiveManager } from "./archive-manager";

export const dynamic = "force-dynamic";

export default async function ArchiefPage() {
  const [users, medications] = await Promise.all([
    db.user.findMany({ where: { active: false }, orderBy: { name: "asc" } }),
    db.medication.findMany({
      where: { active: false },
      include: { client: true },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-50">Archief</h1>
        <p className="mt-1 text-slate-400">
          Gedeactiveerde medewerkers en medicatie staan hier verzameld, zodat ze niet kwijtraken
          tussen de actieve lijsten. Niets hier is verwijderd — activeren zet iets weer terug in
          gebruik op Backend → Medewerkers / Medicatie beheer.
        </p>
      </div>
      <ArchiveManager
        users={users.map((u) => ({ id: u.id, name: u.name, role: u.role }))}
        medications={medications.map((m) => ({
          id: m.id,
          name: m.name,
          dosage: m.dosage,
          times: m.times,
          clientName: fullName(m.client),
        }))}
      />
    </div>
  );
}
