"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShiftType } from "@prisma/client";
import { formatBirthDateInput } from "@/lib/format-birthdate-input";
import { shiftLabel } from "@/lib/utils";

const SSO_ERROR_LABEL: Record<string, string> = {
  "sso-not-configured": "Inloggen met Microsoft is niet ingesteld.",
  "sso-state-mismatch": "De Microsoft-aanmelding is verlopen — probeer opnieuw.",
  "sso-missing-params": "De Microsoft-aanmelding is niet volledig teruggekomen — probeer opnieuw.",
  "sso-invalid-token": "Microsoft-aanmelding kon niet worden geverifieerd.",
  "sso-no-matching-account": "Geen gekoppeld account gevonden voor dit Microsoft-account — vraag de beheerder.",
  "sso-failed": "Microsoft-aanmelding is mislukt, probeer opnieuw.",
};

export function LoginForm({ ssoEnabled }: { ssoEnabled: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [name, setName] = React.useState("");
  const [birthDate, setBirthDate] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  // Set once naam+geboortedatum checks out but this account has MFA
  // enabled (see app/api/auth/login/route.ts) — swaps the form into the
  // second step rather than navigating anywhere, since no session exists
  // yet.
  const [mfaStep, setMfaStep] = React.useState(false);
  const [mfaCode, setMfaCode] = React.useState("");

  React.useEffect(() => {
    const error = searchParams.get("error");
    if (error) toast.error(SSO_ERROR_LABEL[error] || "Inloggen mislukt");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function completeLogin(data: { shift: ShiftType }) {
    toast.success(`Welkom, dienst gestart (${shiftLabel(data.shift).toLowerCase()})`);
    const next = searchParams.get("next") || "/dashboard";
    router.push(next);
    router.refresh();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, birthDate }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Inloggen mislukt");
        return;
      }
      if (data.mfaRequired) {
        setMfaStep(true);
        return;
      }
      completeLogin(data);
    } catch {
      toast.error("Er is iets misgegaan, probeer opnieuw");
    } finally {
      setLoading(false);
    }
  }

  async function handleMfaSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login/mfa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: mfaCode }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Ongeldige code");
        return;
      }
      completeLogin(data);
    } catch {
      toast.error("Er is iets misgegaan, probeer opnieuw");
    } finally {
      setLoading(false);
    }
  }

  if (mfaStep) {
    return (
      <form onSubmit={handleMfaSubmit} className="flex flex-col gap-5">
        <p className="text-sm text-slate-400">
          Voer de code uit je authenticator-app in, of een back-upcode als je die niet bij de
          hand hebt.
        </p>
        <div>
          <Label htmlFor="mfaCode">Code</Label>
          <Input
            id="mfaCode"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456 of XXXX-XXXX"
            value={mfaCode}
            onChange={(e) => setMfaCode(e.target.value)}
            autoFocus
            required
          />
        </div>
        <Button type="submit" size="lg" loading={loading} className="mt-2 w-full" disabled={mfaCode.trim().length < 4}>
          Bevestigen
        </Button>
        <Button type="button" variant="ghost" onClick={() => setMfaStep(false)}>
          Terug
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div>
        <Label htmlFor="name">Naam</Label>
        <Input
          id="name"
          autoComplete="name"
          placeholder="Bijv. Anna Jansen"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>
      <div>
        <Label htmlFor="birthDate">Geboortedatum</Label>
        <Input
          id="birthDate"
          type="password"
          inputMode="numeric"
          autoComplete="current-password"
          placeholder="DD-MM-JJJJ"
          value={birthDate}
          onChange={(e) => setBirthDate(formatBirthDateInput(e.target.value))}
          maxLength={10}
          required
        />
      </div>
      <Button type="submit" size="lg" loading={loading} className="mt-2 w-full">
        Inloggen
      </Button>
      {ssoEnabled && (
        <>
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span className="h-px flex-1 bg-border" />
            of
            <span className="h-px flex-1 bg-border" />
          </div>
          <a href="/api/auth/sso/microsoft/start" className="block">
            <Button type="button" variant="outline" size="lg" className="w-full">
              Inloggen met Microsoft
            </Button>
          </a>
        </>
      )}
    </form>
  );
}
