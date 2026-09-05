"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { DAYS_OF_WEEK as DAYS } from "@/lib/utils";

export type WeekPlanRow = {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  activity: string;
  notes: string | null;
};

export function WeekPlanManager({
  clients,
  plansByClient,
}: {
  clients: { id: string; name: string }[];
  plansByClient: Record<string, WeekPlanRow[]>;
}) {
  const router = useRouter();
  const [clientId, setClientId] = React.useState(clients[0]?.id ?? "");
  const [dayOfWeek, setDayOfWeek] = React.useState(0);
  const [startTime, setStartTime] = React.useState("09:00");
  const [endTime, setEndTime] = React.useState("10:00");
  const [activity, setActivity] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/backend/weekplans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, dayOfWeek, startTime, endTime, activity }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Toevoegen mislukt");
        return;
      }
      toast.success("Toegevoegd aan weekplanning");
      setActivity("");
      router.refresh();
    } catch {
      toast.error("Er is iets misgegaan");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/backend/weekplans/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Verwijderd");
      router.refresh();
    } catch {
      toast.error("Verwijderen mislukt");
    }
  }

  const plans = plansByClient[clientId] ?? [];

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Nieuw onderdeel</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
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
                <Label htmlFor="day">Dag</Label>
                <Select id="day" value={dayOfWeek} onChange={(e) => setDayOfWeek(Number(e.target.value))}>
                  {DAYS.map((d, i) => (
                    <option key={d} value={i}>
                      {d}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="start">Start</Label>
                <Input id="start" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
              </div>
              <div>
                <Label htmlFor="end">Einde</Label>
                <Input id="end" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} required />
              </div>
              <div>
                <Label htmlFor="activity">Activiteit</Label>
                <Input id="activity" value={activity} onChange={(e) => setActivity(e.target.value)} required />
              </div>
            </div>
            <Button type="submit" disabled={loading || !clientId || !activity} className="self-start">
              {loading ? "Toevoegen..." : "Toevoegen"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {DAYS.map((day, i) => {
          const dayPlans = plans.filter((p) => p.dayOfWeek === i);
          return (
            <Card key={day}>
              <CardHeader>
                <CardTitle className="text-base">{day}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                {dayPlans.length === 0 ? (
                  <p className="text-sm text-slate-500">Geen items</p>
                ) : (
                  dayPlans.map((p) => (
                    <div key={p.id} className="flex items-center justify-between gap-2 rounded-lg bg-surface2 px-3 py-2">
                      <span className="text-sm text-slate-200">
                        {p.startTime}-{p.endTime} {p.activity}
                      </span>
                      <button onClick={() => handleDelete(p.id)} aria-label="Verwijderen">
                        <Trash2 className="h-4 w-4 text-red-400" />
                      </button>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
