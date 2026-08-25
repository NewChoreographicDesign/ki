import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { UserManager } from "./user-manager";

export const dynamic = "force-dynamic";

export default async function MedewerkersPage() {
  const [users, session] = await Promise.all([
    db.user.findMany({ orderBy: { name: "asc" } }),
    getSession(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-50">Medewerkers</h1>
        <p className="mt-1 text-slate-400">Beheer accounts en rollen (alleen admin).</p>
      </div>
      <UserManager users={users} currentUserId={session?.sub ?? ""} />
    </div>
  );
}
