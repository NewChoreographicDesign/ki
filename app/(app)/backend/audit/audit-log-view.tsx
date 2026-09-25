import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AuditReviewPanel } from "./audit-review-panel";

const ACTION_LABELS: Record<string, string> = {
  "login.success": "Ingelogd",
  "login.failed": "Mislukte inlogpoging",
  "report.create": "Rapportage aangemaakt",
  "document.delete": "Document verwijderd",
  "protocol.delete": "Protocol verwijderd",
  "user.create": "Gebruiker aangemaakt",
  "user.update": "Gebruiker gewijzigd",
  "user.reset-birthdate": "Geboortedatum gereset door admin",
  "user.change-own-birthdate": "Geboortedatum zelf gewijzigd",
  "user.delete": "Gebruiker verwijderd",
  "client.create": "Cliënt aangemaakt",
  "client.update": "Cliënt gewijzigd",
  "medication.update": "Medicatie gewijzigd",
  "medication.delete": "Medicatie verwijderd",
  "todo.update": "Taak gewijzigd",
  "todo.delete": "Taak verwijderd",
  "handover.delete": "Overdracht verwijderd",
  "setting.update": "Instelling gewijzigd",
  "user.email.set-by-admin": "E-mailadres ingesteld door admin",
  "user.mfa.enabled": "Tweestapsverificatie ingesteld",
  "user.mfa.disabled": "Tweestapsverificatie uitgezet",
  "user.mfa.reset": "Tweestapsverificatie gereset door admin",
  "login.mfa.failed": "Onjuiste tweestapsverificatie-code",
  "login.mfa.backup-code-used": "Back-upcode gebruikt om in te loggen",
  "user.sso.linked": "Microsoft-account gekoppeld",
  "invaller.self_register": "Invaller-account zelf geregistreerd",
  "invaller_registration.rotate": "Invaller-registratiecode aangezet/vervangen",
  "invaller_registration.disable": "Invaller-registratie uitgezet",
  "data_breach.report": "Datalek gemeld",
  "data_breach.update": "Datalek bijgewerkt",
  "audit_finding.resolve": "Logcontrole-bevinding afgehandeld",
};

// Shared by app/(app)/backend/audit (admin, nested under the admin-only
// Backend section) and app/(app)/auditlog (coordinator, its own top-level
// route — see lib/auth.ts's canAccessAuditLog for why this needs a second
// entry point instead of just widening /backend to COORDINATOR).
export async function AuditLogView() {
  const [entries, reviewRuns, reviewFindings] = await Promise.all([
    db.auditLog.findMany({
      include: { user: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    db.auditReviewRun.findMany({ orderBy: { createdAt: "desc" }, take: 14 }),
    db.auditReviewFinding.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
  ]);

  const resolverIds = Array.from(
    new Set(reviewFindings.map((f) => f.resolvedByUserId).filter((id): id is string => Boolean(id)))
  );
  const resolvers = resolverIds.length
    ? await db.user.findMany({ where: { id: { in: resolverIds } }, select: { id: true, name: true } })
    : [];
  const resolverName = new Map(resolvers.map((u) => [u.id, u.name]));

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Periodieke logcontrole</CardTitle>
          <CardDescription>
            Elke dag doorzoekt het systeem de auditlog van de afgelopen 24 uur automatisch op
            afwijkende patronen (veel mislukte inlogpogingen, veel mislukte
            tweestapsverificatiepogingen) — dit is de aantoonbare, regelmatige controle, niet
            alleen een reactie op een klacht.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AuditReviewPanel
            runs={reviewRuns.map((r) => ({
              id: r.id,
              windowStart: r.windowStart.toISOString(),
              windowEnd: r.windowEnd.toISOString(),
              findingsCount: r.findingsCount,
              createdAt: r.createdAt.toISOString(),
            }))}
            findings={reviewFindings.map((f) => ({
              id: f.id,
              category: f.category,
              severity: f.severity,
              summary: f.summary,
              resolved: f.resolved,
              resolvedByName: f.resolvedByUserId ? (resolverName.get(f.resolvedByUserId) ?? null) : null,
              resolvedAt: f.resolvedAt ? f.resolvedAt.toISOString() : null,
              createdAt: f.createdAt.toISOString(),
            }))}
          />
        </CardContent>
      </Card>
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
