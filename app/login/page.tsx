import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LogoMark } from "@/components/brand/logo";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect("/dashboard");

  const existingUsers = await db.user.count();
  if (existingUsers === 0) redirect("/setup");

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-4">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-brand-grid" />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 h-[28rem] w-[28rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-gradient opacity-[0.1] blur-3xl"
      />
      <div className="relative flex w-full max-w-md flex-col items-center gap-8">
        <LogoMark size="lg" className="animate-scale-in" />
        <Card className="w-full animate-fade-in-up" style={{ animationDelay: "120ms" }}>
          <CardHeader>
            <CardTitle className="text-2xl">Welkom terug</CardTitle>
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
