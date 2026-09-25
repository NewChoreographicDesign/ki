"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { formatBirthDateInput } from "@/lib/format-birthdate-input";
import { formatDateTime } from "@/lib/utils";

type Status = { enabled: boolean; enrolledAt: string | null; remainingBackupCodes: number };
type SetupData = { secret: string; otpauthUri: string; qrDataUrl: string };

// Self-service TOTP (RFC 6238) enrollment/disablement for the current
// account — see lib/mfa.ts. Used from /account (Mijn account).
export function MfaPanel() {
  const router = useRouter();
  const [status, setStatus] = React.useState<Status | null>(null);
  const [setupData, setSetupData] = React.useState<SetupData | null>(null);
  const [confirmCode, setConfirmCode] = React.useState("");
  const [backupCodes, setBackupCodes] = React.useState<string[] | null>(null);
  const [disableBirthDate, setDisableBirthDate] = React.useState("");
  const [showDisableForm, setShowDisableForm] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  const loadStatus = React.useCallback(async () => {
    const res = await fetch("/api/account/mfa");
    if (res.ok) setStatus(await res.json());
  }, []);

  React.useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  async function startSetup() {
    setLoading(true);
    try {
      const res = await fetch("/api/account/mfa/setup", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Starten mislukt");
        return;
      }
      setSetupData(data);
    } catch {
      toast.error("Er is iets misgegaan");
    } finally {
      setLoading(false);
    }
  }

  async function confirmSetup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/account/mfa/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: confirmCode }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Code onjuist");
        return;
      }
      setBackupCodes(data.backupCodes);
      setSetupData(null);
      setConfirmCode("");
      await loadStatus();
      router.refresh();
    } catch {
      toast.error("Er is iets misgegaan");
    } finally {
      setLoading(false);
    }
  }

  async function disable(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/account/mfa", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ birthDate: disableBirthDate }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Uitzetten mislukt");
        return;
      }
      toast.success("Tweestapsverificatie uitgezet");
      setDisableBirthDate("");
      setShowDisableForm(false);
      await loadStatus();
    } catch {
      toast.error("Er is iets misgegaan");
    } finally {
      setLoading(false);
    }
  }

  if (backupCodes) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Bewaar je back-upcodes</CardTitle>
          <CardDescription>
            Elke code werkt één keer, als je authenticator-app niet beschikbaar is. Dit is de
            enige keer dat ze worden getoond — schrijf ze op of sla ze op in een
            wachtwoordmanager.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-2 rounded-md bg-surface2 p-4 font-mono text-sm sm:grid-cols-5">
            {backupCodes.map((code) => (
              <span key={code}>{code}</span>
            ))}
          </div>
          <Button
            type="button"
            className="self-start"
            onClick={() => {
              setBackupCodes(null);
              router.refresh();
            }}
          >
            Ik heb ze veilig bewaard
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (setupData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Scan de QR-code</CardTitle>
          <CardDescription>
            Met Google Authenticator, Microsoft Authenticator, Authy of een vergelijkbare app.
            Kun je niet scannen? Voer de sleutel hieronder handmatig in.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            {/* eslint-disable-next-line @next/next/no-img-element -- a same-request data: URL, not a remote image */}
            <img src={setupData.qrDataUrl} alt="QR-code voor tweestapsverificatie" width={200} height={200} className="rounded-md border border-border bg-white p-2" />
            <div className="flex flex-col gap-1">
              <Label>Sleutel (handmatig invoeren)</Label>
              <code className="rounded bg-surface2 px-2 py-1 text-sm">{setupData.secret}</code>
            </div>
          </div>
          <form onSubmit={confirmSetup} className="flex max-w-xs flex-col gap-3">
            <div>
              <Label htmlFor="mfa-confirm-code">Voer de code uit je app in</Label>
              <Input
                id="mfa-confirm-code"
                inputMode="numeric"
                maxLength={6}
                placeholder="123456"
                value={confirmCode}
                onChange={(e) => setConfirmCode(e.target.value.replace(/\D/g, ""))}
                required
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" loading={loading} disabled={confirmCode.length !== 6}>
                Bevestigen en aanzetten
              </Button>
              <Button type="button" variant="outline" onClick={() => setSetupData(null)}>
                Annuleren
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Tweestapsverificatie</CardTitle>
        <CardDescription>
          Een extra code uit een authenticator-app naast je naam en geboortedatum bij het
          inloggen.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={status?.enabled ? "forest" : "slate"}>
            {status?.enabled ? "Actief" : "Uit"}
          </Badge>
          {status?.enabled && status.enrolledAt && (
            <span className="text-xs text-slate-500">
              Ingesteld op {formatDateTime(new Date(status.enrolledAt))} · {status.remainingBackupCodes} back-upcode
              {status.remainingBackupCodes === 1 ? "" : "s"} over
            </span>
          )}
        </div>

        {!status?.enabled && (
          <Button type="button" loading={loading} onClick={startSetup} className="self-start">
            Instellen
          </Button>
        )}

        {status?.enabled && !showDisableForm && (
          <Button type="button" variant="outline" className="self-start" onClick={() => setShowDisableForm(true)}>
            Uitzetten
          </Button>
        )}

        {status?.enabled && showDisableForm && (
          <form onSubmit={disable} className="flex max-w-xs flex-col gap-3">
            <div>
              <Label htmlFor="mfa-disable-birthdate">Bevestig je geboortedatum</Label>
              <Input
                id="mfa-disable-birthdate"
                inputMode="numeric"
                placeholder="DD-MM-JJJJ"
                value={disableBirthDate}
                onChange={(e) => setDisableBirthDate(formatBirthDateInput(e.target.value))}
                maxLength={10}
                required
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" variant="outline" loading={loading} disabled={disableBirthDate.length !== 10}>
                Bevestig uitzetten
              </Button>
              <Button type="button" variant="ghost" onClick={() => setShowDisableForm(false)}>
                Annuleren
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
