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
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-4">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 h-[28rem] w-[28rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-gradient opacity-[0.08] blur-3xl"
      />
      <div className="relative flex w-full max-w-md flex-col items-center gap-6 animate-fade-in-up">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-gradient shadow-glow-sky">
          <span className="text-xl font-bold text-white">W</span>
        </div>
        <Card className="w-full">
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
      </div>
    </main>
  );
}
