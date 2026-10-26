"use client";

import * as React from "react";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Info, ShieldAlert, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/utils";

// Interaction and double-therapy check for one client, from the imported
// licensed extract (lib/medication-interactions.ts). Shown on the client's
// medication page once they have two or more active medications. It never
// blocks anything; the highest severity asks for "beoordeeld door" (who,
// when, why). Decision support only.

type AckState = { state: "ACKNOWLEDGED"; reason: string; userName: string; at: string } | { state: "CHANGED"; previousAt: string } | { state: "OPEN" };

type Item = {
  kind: "INTERACTION" | "DUPLICATE";
  medicationA: { id: string; name: string };
  medicationB: { id: string; name: string };
  severity: number | null;
  label: string | null;
  texts: string[];
  sameSubstance?: boolean;
  needsAck: boolean;
  ack: AckState;
};

type Check = {
  notice: string;
  dataset: { source: string; version: string; importedAt: string; ackFromRank: number; maxSeverity: number } | null;
  items: Item[];
  openAcks: number;
};

function severityBadge(item: Item, maxSeverity: number) {
  if (item.severity === null) return <Badge variant="amber">Mogelijk dubbele therapie</Badge>;
  const variant = item.needsAck ? "red" : item.severity * 2 >= maxSeverity ? "amber" : "slate";
  return (
    <Badge variant={variant}>
      {item.label ? `${item.label} · ` : ""}ernst {item.severity} van {maxSeverity}
    </Badge>
  );
}

function AckLine({ item }: { item: Item }) {
  if (item.ack.state === "ACKNOWLEDGED") {
    return (
      <p className="flex items-start gap-1.5 text-sm text-forest-400">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          Beoordeeld door {item.ack.userName} op {formatDate(new Date(item.ack.at))}: {item.ack.reason}
        </span>
      </p>
    );
  }
  if (item.ack.state === "CHANGED") {
    return (
      <p className="flex items-start gap-1.5 text-sm text-amber-400">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <span>Eén van de middelen is gewijzigd sinds de beoordeling van {formatDate(new Date(item.ack.previousAt))}. Opnieuw beoordelen.</span>
      </p>
    );
  }
  return item.needsAck ? (
    <p className="flex items-start gap-1.5 text-sm text-red-400">
      <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
      <span>Nog niet beoordeeld door een voorschrijver of apotheker.</span>
    </p>
  ) : null;
}

export function MedicationInteractionPanel({ clientId, canAck, onClose, title = "Interactiecontrole" }: { clientId: string; canAck: boolean; onClose?: () => void; title?: string }) {
  const [check, setCheck] = React.useState<Check | null>(null);
  const [failed, setFailed] = React.useState(false);
  const [ackFor, setAckFor] = React.useState<string | null>(null);
  const [reason, setReason] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const load = React.useCallback(async () => {
    try {
      const res = await fetch(`/api/medication-interactions?clientId=${encodeURIComponent(clientId)}`, { cache: "no-store" });
      if (!res.ok) throw new Error();
      setCheck(await res.json());
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [clientId]);
  React.useEffect(() => {
    void load();
  }, [load]);

  async function acknowledge(item: Item) {
    setSaving(true);
    try {
      const res = await fetch("/api/medication-interactions/ack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, kind: item.kind, medicationA: item.medicationA.id, medicationB: item.medicationB.id, reason }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Opslaan mislukt");
      toast.success("Beoordeling vastgelegd");
      setAckFor(null);
      setReason("");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Opslaan mislukt");
    } finally {
      setSaving(false);
    }
  }

  if (failed) return <p className="text-sm text-slate-500">De interactiecontrole kon niet worden geladen.</p>;
  if (!check) return null;

  // No licensed extract imported: say exactly that and nothing else.
  if (!check.dataset) {
    return (
      <p className="flex items-center gap-2 text-sm text-slate-500">
        <Info className="h-4 w-4" />
        Geen interactiedata geïmporteerd
      </p>
    );
  }

  const key = (i: Item) => `${i.kind}:${i.medicationA.id}:${i.medicationB.id}`;
  return (
    <Card className={check.openAcks > 0 ? "border-red-500/40" : undefined}>
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="text-base">{title}</CardTitle>
          <CardDescription>
            Bron: {check.dataset.source}, versie {check.dataset.version} (geïmporteerd {formatDate(new Date(check.dataset.importedAt))}). {check.notice}
          </CardDescription>
        </div>
        {onClose && (
          <button type="button" onClick={onClose} aria-label="Sluiten" className="rounded-full p-1.5 text-slate-400 hover:bg-surface2 hover:text-slate-100">
            <X className="h-4 w-4" />
          </button>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {check.items.length === 0 ? (
          <p className="text-sm text-slate-400">Geen interacties of mogelijk dubbele therapie gevonden in de geïmporteerde data voor de actieve medicatie van deze cliënt.</p>
        ) : (
          check.items.map((item) => (
            <div key={key(item)} className="flex flex-col gap-2 rounded-xl border border-border bg-surface2/50 p-3">
              <div className="flex flex-wrap items-center gap-2">
                {severityBadge(item, check.dataset!.maxSeverity)}
                <span className="font-medium text-slate-100">
                  {item.medicationA.name} + {item.medicationB.name}
                </span>
                {item.needsAck && item.ack.state !== "ACKNOWLEDGED" && <Badge variant="red">Beoordeling vereist</Badge>}
              </div>
              {item.kind === "DUPLICATE" ? (
                <p className="text-sm text-slate-400">{item.sameSubstance ? "Dezelfde werkzame stof (zelfde ATC-code)." : "Dezelfde ATC-subgroep (eerste vijf tekens van de ATC-code)."} Controleer of beide bedoeld zijn.</p>
              ) : (
                <ul className="list-disc pl-5 text-sm text-slate-300">
                  {item.texts.map((text, i) => (
                    <li key={i}>{text}</li>
                  ))}
                </ul>
              )}
              <AckLine item={item} />
              {canAck &&
                (ackFor === key(item) ? (
                  <div className="flex flex-wrap items-end gap-2">
                    <div className="min-w-[14rem] flex-1">
                      <label htmlFor={`ack-${key(item)}`} className="mb-1 block text-xs text-slate-400">
                        Reden / afspraak met voorschrijver of apotheker
                      </label>
                      <Input id={`ack-${key(item)}`} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Bijv. besproken met huisarts, combinatie bewust" />
                    </div>
                    <Button size="sm" loading={saving} disabled={reason.trim().length < 3} onClick={() => acknowledge(item)}>
                      Beoordeeld
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setAckFor(null)}>
                      Annuleren
                    </Button>
                  </div>
                ) : (
                  item.ack.state !== "ACKNOWLEDGED" && (
                    <Button size="sm" variant="outline" className="self-start" onClick={() => { setAckFor(key(item)); setReason(""); }}>
                      Vastleggen als beoordeeld
                    </Button>
                  )
                ))}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
