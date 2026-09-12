"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export function AppointmentForm({
  clients,
  appointment,
  onSaved,
  onCancel,
}: {
  clients: { id: string; name: string }[];
  /** Present only when editing an existing appointment; absent means "create new". */
  appointment?: {
    id: string;
    title: string;
    description: string | null;
    clientId: string | null;
    startAtLocal: string;
  };
  onSaved?: () => void;
  onCancel?: () => void;
}) {
  const isEditing = !!appointment;
  const router = useRouter();
  const [title, setTitle] = React.useState(appointment?.title ?? "");
  const [description, setDescription] = React.useState(appointment?.description ?? "");
  const [clientId, setClientId] = React.useState(appointment?.clientId ?? "");
  const [startAt, setStartAt] = React.useState(appointment?.startAtLocal ?? "");
  const [loading, setLoading] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(isEditing ? `/api/appointments/${appointment.id}` : "/api/appointments", {
        method: isEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, clientId, startAt }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Opslaan mislukt");
        return;
      }
      toast.success(isEditing ? "Afspraak bijgewerkt" : "Afspraak toegevoegd");
      if (!isEditing) {
        setTitle("");
        setDescription("");
        setStartAt("");
      }
      router.refresh();
      onSaved?.();
    } catch {
      toast.error("Er is iets misgegaan");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <Label htmlFor="title">Titel</Label>
          <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>
        <div>
          <Label htmlFor="client">Cliënt (optioneel)</Label>
          <Select id="client" value={clientId} onChange={(e) => setClientId(e.target.value)}>
            <option value="">Geen</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="startAt">Datum &amp; tijd</Label>
          <Input
            id="startAt"
            type="datetime-local"
            value={startAt}
            onChange={(e) => setStartAt(e.target.value)}
            required
          />
        </div>
      </div>
      <div>
        <Label htmlFor="description">Omschrijving (optioneel)</Label>
        <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="lg" loading={loading} disabled={!title || !startAt} className="self-start">
          {isEditing ? "Wijzigingen opslaan" : "Afspraak toevoegen"}
        </Button>
        {isEditing && (
          <Button type="button" variant="ghost" size="lg" onClick={onCancel}>
            Annuleren
          </Button>
        )}
      </div>
    </form>
  );
}
