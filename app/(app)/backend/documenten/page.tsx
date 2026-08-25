import { db } from "@/lib/db";
import { fullName } from "@/lib/utils";
import { DocumentManager } from "./document-manager";

export const dynamic = "force-dynamic";

export default async function DocumentenPage() {
  const [documents, clients] = await Promise.all([
    db.document.findMany({ include: { client: true }, orderBy: { createdAt: "desc" } }),
    db.client.findMany({ where: { active: true }, orderBy: { firstName: "asc" } }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-50">Documenten</h1>
        <p className="mt-1 text-slate-400">Algemene en cliëntspecifieke documenten.</p>
      </div>
      <DocumentManager
        documents={documents.map((d) => ({
          id: d.id,
          title: d.title,
          url: d.url,
          clientName: d.client ? fullName(d.client) : null,
        }))}
        clients={clients.map((c) => ({ id: c.id, name: fullName(c) }))}
      />
    </div>
  );
}
