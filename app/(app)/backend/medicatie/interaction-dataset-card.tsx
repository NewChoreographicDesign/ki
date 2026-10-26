"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatDate } from "@/lib/utils";

type Dataset = { source: string; version: string; rowCount: number; importedAt: string } | null;

// Loads the licensed interaction/double-therapy extract that
// lib/medication-interactions.ts checks active medication against (see
// MedicationInteractionPanel on a client's medicatie page). Importing
// replaces the previous extract entirely — admin only, same gate as the
// POST/PATCH/DELETE medication routes.
export function InteractionDatasetCard({ dataset }: { dataset: Dataset }) {
  const router = useRouter();
  const [source, setSource] = React.useState("");
  const [version, setVersion] = React.useState("");
  const [csv, setCsv] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  async function handleImport(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/backend/medication-interactions/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source, version, csv }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Importeren mislukt");
        return;
      }
      if (data.errors?.length) {
        toast.warning(`${data.imported} regels geïmporteerd, ${data.skipped} overgeslagen`);
      } else {
        toast.success(`${data.imported} regels geïmporteerd`);
      }
      setCsv("");
      router.refresh();
    } catch {
      toast.error("Er is iets misgegaan");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Interactiedata</CardTitle>
        <CardDescription>
          {dataset
            ? `Huidige dataset: ${dataset.source}, versie ${dataset.version} (${dataset.rowCount} regels, geïmporteerd ${formatDate(new Date(dataset.importedAt))}).`
            : "Nog geen interactiedata geïmporteerd — de interactiecontrole toont tot dan niets."}{" "}
          Beslissingsondersteuning, geen medisch hulpmiddel.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleImport} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="interaction-source">Bron</Label>
              <Input id="interaction-source" value={source} onChange={(e) => setSource(e.target.value)} placeholder="Bijv. naam van de licentiehouder" required />
            </div>
            <div>
              <Label htmlFor="interaction-version">Versie</Label>
              <Input id="interaction-version" value={version} onChange={(e) => setVersion(e.target.value)} placeholder="Bijv. 2026-Q1" required />
            </div>
          </div>
          <div>
            <Label htmlFor="interaction-csv">CSV (puntkomma-gescheiden: atcA;atcB;severity;text[;label])</Label>
            <Textarea
              id="interaction-csv"
              value={csv}
              onChange={(e) => setCsv(e.target.value)}
              placeholder="atcA;atcB;severity;text;label"
              className="min-h-[140px] font-mono text-xs"
              required
            />
          </div>
          <p className="text-xs text-slate-500">Importeren vervangt de volledige huidige dataset.</p>
          <Button type="submit" loading={loading} disabled={!source || !version || !csv} className="self-start">
            Importeren
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
