import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect("/dashboard");

  const existingUsers = await db.user.count();
  if (existingUsers === 0) redirect("/setup");

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
            <CardTitle className="text-2xl">Woongroep Admin</CardTitle>
            <CardDescription>Log in met je naam en geboortedatum</CardDescription>
          </CardHeader>
          <CardContent>
            <Suspense fallback={null}>
              <LoginForm />
            </Suspense>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
