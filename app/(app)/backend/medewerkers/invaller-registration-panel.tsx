"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// Manages the app's reusable invaller self-registration code — see
// app/api/backend/invaller-registration/route.ts and
// InvallerRegistration's schema.prisma comment. Unlike a one-time reveal,
// this code is meant to be handed out repeatedly (to a revolving cast of
// flexwerkers), so it stays visible here for as long as it's active.
export function InvallerRegistrationPanel({ enabled, code }: { enabled: boolean; code: string | null }) {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);

  async function rotate() {
    setLoading(true);
    try {
      const res = await fetch("/api/backend/invaller-registration", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Aanmaken mislukt");
        return;
      }
      toast.success(enabled ? "Registratiecode vervangen" : "Invaller-registratie aangezet");
      router.refresh();
    } catch {
      toast.error("Er is iets misgegaan");
    } finally {
      setLoading(false);
    }
  }

  async function disable() {
    if (!window.confirm("Invaller-registratie uitzetten? Bestaande invaller-accounts blijven gewoon werken.")) {
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/backend/invaller-registration", { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Invaller-registratie uitgezet");
      router.refresh();
    } catch {
      toast.error("Uitzetten mislukt");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invaller-registratie</CardTitle>
        <CardDescription>
          Flexwerkers van een uitzendbureau maken zelf een account aan op{" "}
          <code className="rounded bg-surface2 px-1.5 py-0.5">/invaller-registratie</code> — met
          naam, geboortedatum, hun uitzendbureau en de code hieronder.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={enabled ? "forest" : "slate"}>{enabled ? "Registratie open" : "Registratie uit"}</Badge>
        </div>
        {enabled && code && (
          <div>
            <div className="text-xs font-medium text-slate-400">Registratiecode</div>
            <code className="mt-1 block w-fit rounded bg-surface2 px-2 py-1.5 text-lg tracking-wider text-slate-100">
              {code}
            </code>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <Button size="sm" loading={loading} onClick={rotate}>
            {enabled ? "Code vervangen" : "Registratie aanzetten"}
          </Button>
          {enabled && (
            <Button size="sm" variant="outline" loading={loading} onClick={disable}>
              Registratie uitzetten
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
