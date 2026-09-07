"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";
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
  instructions: string | null;
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
  const [editingId, setEditingId] = React.useState<string | null>(null);

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

  async function handleDelete(id: string, name: string) {
    if (!window.confirm(`${name} definitief verwijderen? Dit kan niet ongedaan worden gemaakt.`)) {
      return;
    }
    try {
      const res = await fetch(`/api/backend/medications/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Verwijderen mislukt");
        return;
      }
      toast.success("Medicatie verwijderd");
      router.refresh();
    } catch {
      toast.error("Verwijderen mislukt");
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
        {medications.map((m) =>
          editingId === m.id ? (
            <MedicationEditRow
              key={m.id}
              medication={m}
              onCancel={() => setEditingId(null)}
              onSaved={() => {
                setEditingId(null);
                router.refresh();
              }}
            />
          ) : (
            <Card key={m.id}>
              <CardContent className="flex items-center justify-between gap-3 p-5">
                <div>
                  <p className="font-medium text-slate-100">
                    {m.name} &middot; {m.dosage}{" "}
                    <span className="text-sm text-slate-500">({m.clientName})</span>
                  </p>
                  <p className="text-sm text-slate-500">
                    Tijden: {m.times}
                    {m.instructions ? ` · ${m.instructions}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={m.active ? "emerald" : "slate"}>{m.active ? "Actief" : "Inactief"}</Badge>
                  <Button size="sm" variant="ghost" onClick={() => setEditingId(m.id)} aria-label="Bewerken">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => toggleActive(m.id, !m.active)}>
                    {m.active ? "Deactiveren" : "Activeren"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDelete(m.id, m.name)}
                    aria-label="Verwijderen"
                    className="text-red-400 hover:text-red-300"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        )}
      </div>
      <p className="text-xs text-slate-500">
        Verwijderen kan alleen zolang er nog geen registraties op deze medicatie staan — daarna
        blijft alleen Deactiveren beschikbaar, zodat medicatiehistorie nooit verloren gaat.
      </p>
    </div>
  );
}

function MedicationEditRow({
  medication,
  onCancel,
  onSaved,
}: {
  medication: MedicationRow;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = React.useState(medication.name);
  const [dosage, setDosage] = React.useState(medication.dosage);
  const [instructions, setInstructions] = React.useState(medication.instructions ?? "");
  const [times, setTimes] = React.useState(medication.times);
  const [loading, setLoading] = React.useState(false);

  async function handleSave() {
    setLoading(true);
    try {
      const res = await fetch(`/api/backend/medications/${medication.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, dosage, instructions, times }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Opslaan mislukt");
        return;
      }
      toast.success("Medicatie bijgewerkt");
      onSaved();
    } catch {
      toast.error("Er is iets misgegaan");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-5">
        <p className="text-sm text-slate-500">Bewerken voor {medication.clientName}</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <Label htmlFor={`name-${medication.id}`}>Naam</Label>
            <Input id={`name-${medication.id}`} value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <Label htmlFor={`dosage-${medication.id}`}>Dosering</Label>
            <Input id={`dosage-${medication.id}`} value={dosage} onChange={(e) => setDosage(e.target.value)} required />
          </div>
          <div>
            <Label htmlFor={`times-${medication.id}`}>Tijden</Label>
            <Input id={`times-${medication.id}`} value={times} onChange={(e) => setTimes(e.target.value)} required />
          </div>
        </div>
        <div>
          <Label htmlFor={`instructions-${medication.id}`}>Instructies (optioneel)</Label>
          <Input
            id={`instructions-${medication.id}`}
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <Button loading={loading} disabled={!name || !dosage || !times} onClick={handleSave}>
            Opslaan
          </Button>
          <Button variant="ghost" onClick={onCancel}>
            Annuleren
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
