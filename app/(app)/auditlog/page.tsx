import { redirect } from "next/navigation";
import { getSession, canAccessAuditLog } from "@/lib/auth";
import { AuditLogView } from "../backend/audit/audit-log-view";

export const dynamic = "force-dynamic";

// Coordinator's own entry point to the auditlog — separate from
// /backend/audit (ADMIN-only, see middleware.ts) since a coordinator needs
// this too but shouldn't gain the rest of Backend along with it. See
// lib/auth.ts's canAccessAuditLog. Same pattern as /persoonlijke-taken.
export default async function AuditLogPage() {
  const session = await getSession();
  if (!session || !canAccessAuditLog(session.role)) {
    redirect("/dashboard");
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-50">Auditlog</h1>
        <p className="mt-1 text-slate-400">
          De 200 meest recente gevoelige acties: inloggen, aanmaken/wijzigen van cliënten en
          accounts, verwijderen van protocollen, en instellingswijzigingen. Niet elke
          paginaweergave wordt gelogd — alleen wijzigingen.
        </p>
      </div>
      <AuditLogView />
    </div>
  );
}
