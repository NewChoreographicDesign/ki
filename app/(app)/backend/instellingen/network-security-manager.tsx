"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

async function saveSetting(key: string, value: string) {
  const res = await fetch("/api/backend/settings", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key, value }),
  });
  if (!res.ok) throw new Error();
}

export function NetworkSecurityManager({
  enabled,
  allowedIps,
  currentIp,
}: {
  enabled: boolean;
  allowedIps: string;
  currentIp: string | null;
}) {
  const router = useRouter();
  const [checked, setChecked] = React.useState(enabled);
  const [ips, setIps] = React.useState(allowedIps);
  const [saving, setSaving] = React.useState(false);

  async function handleSave() {
    if (checked && ips.trim() === "") {
      toast.error("Vul minstens één IP-adres of bereik in voordat je dit inschakelt");
      return;
    }
    setSaving(true);
    try {
      await saveSetting("NETWORK_ALLOWED_IPS", ips);
      await saveSetting("NETWORK_RESTRICTION_ENABLED", checked ? "true" : "false");
      toast.success("Netwerkbeveiliging opgeslagen");
      router.refresh();
    } catch {
      toast.error("Opslaan mislukt");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Netwerkbeveiliging</CardTitle>
        <CardDescription>
          Beperk toegang tot deze app tot het netwerk van de organisatie (op IP-adres).
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
          <strong>Let op — risico op uitsluiting.</strong> Als je dit inschakelt met een verkeerd of
          verouderd IP-adres, kan niemand (ook jij niet) meer inloggen totdat het IP-adres van je
          netwerk weer overeenkomt. Zorg dat <code>NETWORK_BYPASS_SECRET</code> is ingesteld in
          Vercel voordat je dit aanzet — ga dan naar <code>jouw-app-url/login?bypass=&lt;dat
          geheim&gt;</code> om altijd weer toegang te krijgen. Zie INSTALLATIE.md.
        </div>

        {currentIp && (
          <p className="text-sm text-slate-400">
            Jouw huidige IP-adres:{" "}
            <code className="rounded bg-surface2 px-1.5 py-0.5 text-slate-200">{currentIp}</code>
          </p>
        )}

        <div>
          <Label htmlFor="allowedIps">Toegestane IP-adressen / bereiken</Label>
          <Textarea
            id="allowedIps"
            placeholder={"Bijv.\n82.171.23.4\n82.171.0.0/16"}
            value={ips}
            onChange={(e) => setIps(e.target.value)}
            rows={4}
          />
          <p className="mt-1 text-xs text-slate-500">
            Eén per regel (of met komma&apos;s gescheiden). IPv4-adressen of CIDR-bereiken (bijv.
            82.171.0.0/16). Alleen IPv4 wordt ondersteund.
          </p>
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-200">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            className="h-4 w-4 rounded border-slate-600 bg-surface2"
          />
          Alleen toegang vanaf bovenstaande IP-adressen toestaan
        </label>

        <Button onClick={handleSave} disabled={saving} className="self-start">
          {saving ? "Opslaan..." : "Netwerkbeveiliging opslaan"}
        </Button>
      </CardContent>
    </Card>
  );
}
