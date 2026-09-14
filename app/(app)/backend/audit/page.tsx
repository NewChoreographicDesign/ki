import { AuditLogView } from "./audit-log-view";

export const dynamic = "force-dynamic";

export default function AuditLogPage() {
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
