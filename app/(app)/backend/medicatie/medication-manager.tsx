"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

export type MedicationRow = {
  id: string;
  name: string;
  dosage: string;
  times: string;
  active: boolean;
  clientName: string;
};

export function MedicationManager({
  medications,
  clients,
}: {
  medications: MedicationRow[];
  clients: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [clientId, setClientId] = React.useState(clients[0]?.id ?? "");
  const [name, setName] = React.useState("");
  const [dosage, setDosage] = React.useState("");
  const [instructions, setInstructions] = React.useState("");
  const [times, setTimes] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/backend/medications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, name, dosage, instructions, times }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Toevoegen mislukt");
        return;
      }
      toast.success("Medicatie toegevoegd");
      setName("");
      setDosage("");
      setInstructions("");
      setTimes("");
      router.refresh();
    } catch {
      toast.error("Er is iets misgegaan");
    } finally {
      setLoading(false);
    }
  }

  async function toggleActive(id: string, active: boolean) {
    try {
      const res = await fetch(`/api/backend/medications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active }),
      });
      if (!res.ok) throw new Error();
      toast.success(active ? "Medicatie geactiveerd" : "Medicatie gedeactiveerd");
      router.refresh();
    } catch {
      toast.error("Bijwerken mislukt");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Nieuwe medicatie</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <Label htmlFor="client">Cliënt</Label>
                <Select id="client" value={clientId} onChange={(e) => setClientId(e.target.value)} required>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="name">Naam</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div>
                <Label htmlFor="dosage">Dosering</Label>
                <Input id="dosage" value={dosage} onChange={(e) => setDosage(e.target.value)} required />
              </div>
              <div>
                <Label htmlFor="times">Tijden</Label>
                <Input
                  id="times"
                  value={times}
                  onChange={(e) => setTimes(e.target.value)}
                  placeholder="08:00,20:00"
                  required
                />
              </div>
            </div>
            <div>
              <Label htmlFor="instructions">Instructies (optioneel)</Label>
              <Input id="instructions" value={instructions} onChange={(e) => setInstructions(e.target.value)} />
            </div>
            <Button type="submit" loading={loading} disabled={!clientId || !name || !dosage || !times} className="self-start">
              Toevoegen
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3">
        {medications.map((m) => (
          <Card key={m.id}>
            <CardContent className="flex items-center justify-between gap-3 p-5">
              <div>
                <p className="font-medium text-slate-100">
                  {m.name} &middot; {m.dosage}{" "}
                  <span className="text-sm text-slate-500">({m.clientName})</span>
                </p>
                <p className="text-sm text-slate-500">Tijden: {m.times}</p>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant={m.active ? "emerald" : "slate"}>{m.active ? "Actief" : "Inactief"}</Badge>
                <Button size="sm" variant="outline" onClick={() => toggleActive(m.id, !m.active)}>
                  {m.active ? "Deactiveren" : "Activeren"}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
