import { db } from "@/lib/db";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LogoMark } from "@/components/brand/logo";
import { InvallerRegisterForm } from "./invaller-register-form";

export const dynamic = "force-dynamic";

function ErrorCard({ message }: { message: string }) {
  return (
    <Card className="w-full animate-fade-in-up" style={{ animationDelay: "120ms" }}>
      <CardHeader>
        <CardTitle className="text-2xl">Registratie niet beschikbaar</CardTitle>
        <CardDescription>{message}</CardDescription>
      </CardHeader>
    </Card>
  );
}

// Self-service account creation for flexwerkers — see
// app/api/auth/invaller-register/route.ts for the actual account
// creation and InvallerRegistration's schema.prisma comment for the
// reusable-code mechanism.
export default async function InvallerRegistratiePage() {
  const registration = await db.invallerRegistration.findUnique({ where: { id: "singleton" } });
  const orgName = (await db.setting.findUnique({ where: { key: "ORG_NAME" } }))?.value ?? "de organisatie";

  const card = !registration?.enabled ? (
    <ErrorCard message="Invallerregistratie staat momenteel niet open — vraag de beheerder om deze aan te zetten." />
  ) : (
    <Card className="w-full animate-fade-in-up" style={{ animationDelay: "120ms" }}>
      <CardHeader>
        <CardTitle className="text-2xl">Invaller-account aanmaken</CardTitle>
        <CardDescription>
          Voor flexwerkers die soms bij <strong>{orgName}</strong> invallen. Je eigen
          rapportages zijn alleen zichtbaar voor de beheerder.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <InvallerRegisterForm />
      </CardContent>
    </Card>
  );

  return (
    <main className="relative flex min-h-dvh items-center justify-center bg-background p-4">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-brand-grid" />
        <div className="absolute left-1/2 top-1/2 h-[28rem] w-[28rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-gradient opacity-[0.1] blur-3xl" />
      </div>
      <div className="relative flex w-full max-w-md flex-col items-center gap-8">
        <LogoMark size="lg" className="animate-scale-in" />
        {card}
      </div>
    </main>
  );
}
