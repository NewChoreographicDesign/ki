import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

const ACTION_LABELS: Record<string, string> = {
  "login.success": "Ingelogd",
  "login.failed": "Mislukte inlogpoging",
  "report.create": "Rapportage aangemaakt",
  "document.delete": "Document verwijderd",
  "protocol.delete": "Protocol verwijderd",
  "user.create": "Gebruiker aangemaakt",
  "user.update": "Gebruiker gewijzigd",
  "client.create": "Cliënt aangemaakt",
  "client.update": "Cliënt gewijzigd",
  "setting.update": "Instelling gewijzigd",
};

export default async function AuditLogPage() {
  const entries = await db.auditLog.findMany({
    include: { user: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-50">Auditlog</h1>
        <p className="mt-1 text-slate-400">
          De 200 meest recente gevoelige acties: inloggen, aanmaken/wijzigen van cliënten en
          accounts, verwijderen van documenten/protocollen, en instellingswijzigingen. Niet elke
          paginaweergave wordt gelogd — alleen wijzigingen.
        </p>
      </div>
      <Card>
        <CardContent className="p-0">
          {entries.length === 0 ? (
            <p className="p-5 text-slate-500">Nog geen acties gelogd.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-slate-400">
                    <th className="px-4 py-3 font-medium">Tijdstip</th>
                    <th className="px-4 py-3 font-medium">Door</th>
                    <th className="px-4 py-3 font-medium">Actie</th>
                    <th className="px-4 py-3 font-medium">Doel</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr key={entry.id} className="border-b border-border/50 last:border-0">
                      <td className="whitespace-nowrap px-4 py-3 text-slate-400">
                        {formatDateTime(entry.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-slate-200">{entry.user?.name ?? "Onbekend"}</td>
                      <td className="px-4 py-3 text-slate-200">
                        {ACTION_LABELS[entry.action] ?? entry.action}
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {entry.targetType ? `${entry.targetType} (${entry.targetId ?? "-"})` : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
