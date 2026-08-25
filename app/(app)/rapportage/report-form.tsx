"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { formatDDMMYYYY } from "@/lib/utils";

export function ReportForm({
  clients,
  defaultShift,
}: {
  clients: { id: string; name: string }[];
  defaultShift: "MORNING" | "EVENING";
}) {
  const router = useRouter();
  const [clientId, setClientId] = React.useState(clients[0]?.id ?? "");
  const [shift, setShift] = React.useState(defaultShift);
  const [date, setDate] = React.useState(formatDDMMYYYY(new Date()));
  const [content, setContent] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, shift, date, content }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Versturen mislukt");
        return;
      }
      toast.success("Rapportage verstuurd");
      setContent("");
      router.refresh();
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
          <Label htmlFor="shift">Dienst</Label>
          <Select
            id="shift"
            value={shift}
            onChange={(e) => setShift(e.target.value as "MORNING" | "EVENING")}
          >
            <option value="MORNING">Ochtend</option>
            <option value="EVENING">Avond</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="date">Datum</Label>
          <Input
            id="date"
            inputMode="numeric"
            placeholder="DD-MM-JJJJ"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </div>
      </div>
      <div>
        <Label htmlFor="content">Rapportage</Label>
        <Textarea
          id="content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Beschrijf hoe de dienst is verlopen..."
          className="min-h-[160px]"
          required
        />
      </div>
      <Button type="submit" size="lg" disabled={loading || !clientId} className="self-start">
        {loading ? "Versturen..." : "Versturen"}
      </Button>
    </form>
  );
}
