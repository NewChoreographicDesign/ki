import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AccountForm } from "./account-form";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-50">Mijn account</h1>
        <p className="mt-1 text-slate-400">
          Ingelogd als <span className="text-slate-200">{session.name}</span>. Er is geen
          wachtwoord — je geboortedatum is je inloggegeven.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Geboortedatum wijzigen</CardTitle>
        </CardHeader>
        <CardContent>
          <AccountForm />
        </CardContent>
      </Card>
    </div>
  );
}
