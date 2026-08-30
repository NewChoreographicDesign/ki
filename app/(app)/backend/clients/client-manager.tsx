"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

export type ClientRow = {
  id: string;
  firstName: string;
  lastName: string;
  room: string | null;
  active: boolean;
};

export function ClientManager({ clients }: { clients: ClientRow[] }) {
  const router = useRouter();
  const [firstName, setFirstName] = React.useState("");
  const [lastName, setLastName] = React.useState("");
  const [dateOfBirth, setDateOfBirth] = React.useState("");
  const [room, setRoom] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/backend/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName, lastName, dateOfBirth, room, notes }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Toevoegen mislukt");
        return;
      }
      toast.success("Cliënt toegevoegd");
      setFirstName("");
      setLastName("");
      setDateOfBirth("");
      setRoom("");
      setNotes("");
      router.refresh();
    } catch {
      toast.error("Er is iets misgegaan");
    } finally {
      setLoading(false);
    }
  }

  async function updateClient(id: string, data: { active?: boolean; room?: string }) {
    try {
      const res = await fetch(`/api/backend/clients/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      toast.error("Bijwerken mislukt");
    }
  }

  async function toggleActive(id: string, active: boolean) {
    await updateClient(id, { active });
    toast.success(active ? "Cliënt geactiveerd" : "Cliënt gedeactiveerd");
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Nieuwe cliënt</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <Label htmlFor="firstName">Voornaam</Label>
                <Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
              </div>
              <div>
                <Label htmlFor="lastName">Achternaam</Label>
                <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
              </div>
              <div>
                <Label htmlFor="dob">Geboortedatum (optioneel)</Label>
                <Input
                  id="dob"
                  placeholder="DD-MM-JJJJ"
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="room">Kamer (optioneel)</Label>
                <Input id="room" value={room} onChange={(e) => setRoom(e.target.value)} />
              </div>
            </div>
            <div>
              <Label htmlFor="notes">Notities (optioneel)</Label>
              <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            <Button type="submit" disabled={loading || !firstName || !lastName} className="self-start">
              {loading ? "Toevoegen..." : "Toevoegen"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3">
        {clients.map((c) => (
          <Card key={c.id}>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-medium text-slate-100">
                  {c.firstName} {c.lastName}
                </span>
                <Badge variant={c.active ? "emerald" : "slate"}>{c.active ? "Actief" : "Inactief"}</Badge>
              </div>
              <div className="flex items-center gap-3">
                <RoomEditor room={c.room} onSave={(room) => updateClient(c.id, { room })} />
                <Button
                  size="sm"
                  variant={c.active ? "outline" : "secondary"}
                  onClick={() => toggleActive(c.id, !c.active)}
                >
                  {c.active ? "Deactiveren" : "Activeren"}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// Uncontrolled so the input isn't reset on every keystroke by the parent's
// own re-renders; syncs from the prop only when the client's saved room
// actually changes (e.g. after router.refresh()), not on every parent render.
function RoomEditor({ room, onSave }: { room: string | null; onSave: (room: string) => void }) {
  const [value, setValue] = React.useState(room ?? "");

  React.useEffect(() => {
    setValue(room ?? "");
  }, [room]);

  function save() {
    if (value !== (room ?? "")) onSave(value);
  }

  return (
    <Input
      aria-label="Kamer"
      placeholder="Kamer"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
      className="h-9 w-28"
    />
  );
}
