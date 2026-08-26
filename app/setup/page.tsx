import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SetupForm } from "./setup-form";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  const existingUsers = await db.user.count();
  if (existingUsers > 0) {
    redirect("/login");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Welkom bij Woongroep Admin</CardTitle>
          <CardDescription>
            Dit is de allereerste keer dat de app wordt gestart. Maak hieronder je eigen
            beheerdersaccount aan om te beginnen — dit kan maar één keer.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SetupForm />
        </CardContent>
      </Card>
    </main>
  );
}
