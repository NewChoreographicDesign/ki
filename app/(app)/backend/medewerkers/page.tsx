import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { UserManager } from "./user-manager";
import { InvallerRegistrationPanel } from "./invaller-registration-panel";
import { decryptForDisplay } from "@/lib/passcode";

export const dynamic = "force-dynamic";

export default async function MedewerkersPage() {
  const [users, session, registration] = await Promise.all([
    db.user.findMany({ orderBy: { name: "asc" } }),
    getSession(),
    db.invallerRegistration.findUnique({ where: { id: "singleton" } }),
  ]);

  const invallerCode =
    registration?.enabled && registration.codeEncrypted ? decryptForDisplay(registration.codeEncrypted) : null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-50">Medewerkers</h1>
        <p className="mt-1 text-slate-400">Beheer accounts en rollen (alleen admin).</p>
      </div>
      <UserManager users={users} currentUserId={session?.sub ?? ""} />
      <InvallerRegistrationPanel enabled={registration?.enabled ?? false} code={invallerCode} />
    </div>
  );
}
