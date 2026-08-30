import { db } from "@/lib/db";
import { fullName } from "@/lib/utils";
import { DocumentManager } from "../../documenten/document-manager";

export const dynamic = "force-dynamic";

export default async function BackendDocumentenPage() {
  const [documents, clients] = await Promise.all([
    db.document.findMany({ include: { client: true }, orderBy: { createdAt: "desc" } }),
    db.client.findMany({ where: { active: true }, orderBy: { firstName: "asc" } }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-50">Documenten</h1>
        <p className="mt-1 text-slate-400">
          Uploaden en verwijderen (alleen admin). Iedereen met een account ziet en opent deze
          documenten via het hoofdmenu-onderdeel Documenten.
        </p>
      </div>
      <DocumentManager
        documents={documents.map((d) => ({
          id: d.id,
          title: d.title,
          url: d.url,
          clientId: d.clientId,
          clientName: d.client ? fullName(d.client) : null,
          category: d.category,
        }))}
        clients={clients.map((c) => ({ id: c.id, name: fullName(c) }))}
        canUpload={true}
        canDelete={true}
      />
    </div>
  );
}
