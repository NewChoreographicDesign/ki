import { Suspense } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ApparaatForm } from "./apparaat-form";

// Without this, Next statically prerenders the page at build time (nothing
// here reads cookies/DB to force dynamic rendering automatically) and bakes
// in that build's CSP nonce — which never matches the per-request nonce
// middleware.ts generates, so the browser blocks every script and the form
// never hydrates. Same class of issue as /setup and /login, which force
// dynamic rendering via a DB/cookie read; this page has none, so it needs
// the export explicitly.
export const dynamic = "force-dynamic";

export default function ApparaatPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Apparaat vrijgeven</CardTitle>
          <CardDescription>
            Dit apparaat is nog niet vrijgegeven voor Woongroep Admin. Voer het
            apparaat-wachtwoord in (vraag dit na bij een beheerder) — dit hoef je maar één keer
            per apparaat te doen.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={null}>
            <ApparaatForm />
          </Suspense>
        </CardContent>
      </Card>
    </main>
  );
}
