"use client";

import * as React from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Segmented } from "@/components/ui/segmented";
import { cn } from "@/lib/utils";
import {
  ALLOWANCE_DURATION_PRESETS_MIN,
  ALLOWANCE_MAX_MINUTES,
  ALLOWANCE_MIN_MINUTES,
  ALLOWANCE_NOTE_MAX,
  ALLOWANCE_TYPES,
  ALLOWANCE_TYPE_META,
  type AllowanceData,
  type AllowanceModeKey,
  type AllowanceTypeKey,
} from "@/lib/allowances-shared";
import { allowanceApi, allowanceApiMessage, ALLOWANCE_TYPE_ICON } from "./allowance-ui";

export type AllowanceClientOption = { id: string; name: string; room: string | null };

function timeStringToTodayIso(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date();
  d.setHours(h || 0, m || 0, 0, 0);
  return d.toISOString();
}

export function AllowanceForm({ clients, onCreated, onCancel }: { clients: AllowanceClientOption[]; onCreated: (a: AllowanceData) => void; onCancel: () => void }) {
  const [clientId, setClientId] = React.useState(clients[0]?.id ?? "");
  const [type, setType] = React.useState<AllowanceTypeKey>("PHONE");
  const [mode, setMode] = React.useState<AllowanceModeKey>("DURATION");
  const [durationMin, setDurationMin] = React.useState(30);
  const [endTime, setEndTime] = React.useState("16:00");
  const [startLater, setStartLater] = React.useState(false);
  const [startTime, setStartTime] = React.useState("14:00");
  const [note, setNote] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!clientId) {
      toast.error("Kies een cliënt");
      return;
    }
    setSaving(true);
    const res = await allowanceApi("/api/allowances", "POST", {
      clientId,
      type,
      mode,
      allottedMinutes: mode === "DURATION" ? durationMin : undefined,
      endsAt: mode === "UNTIL" ? timeStringToTodayIso(endTime) : undefined,
      startAt: mode === "UNTIL" && startLater ? timeStringToTodayIso(startTime) : undefined,
      note: note || undefined,
    });
    setSaving(false);
    if (!res.ok || !res.data.allowance) {
      toast.error(allowanceApiMessage(res, "Toestemming geven mislukt"));
      return;
    }
    toast.success(`Toestemming gegeven aan ${res.data.allowance.clientName}`);
    onCreated(res.data.allowance);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div>
        <Label htmlFor="allowance-client">Cliënt</Label>
        <Select id="allowance-client" value={clientId} onChange={(e) => setClientId(e.target.value)} required>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
              {c.room ? ` — ${c.room}` : ""}
            </option>
          ))}
        </Select>
      </div>

      <div>
        <Label>Soort</Label>
        <div className="grid grid-cols-3 gap-2">
          {ALLOWANCE_TYPES.map((t) => {
            const Icon = ALLOWANCE_TYPE_ICON[t];
            const selected = t === type;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={cn(
                  "flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 text-center text-xs font-medium transition-colors",
                  selected ? "border-rose-400 bg-rose-500/15 text-rose-300" : "border-border bg-surface2 text-slate-300 hover:bg-surface2/70"
                )}
              >
                <Icon className="h-5 w-5" />
                {ALLOWANCE_TYPE_META[t].label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <Label>Manier</Label>
        <Segmented
          ariaLabel="Manier"
          value={mode}
          onChange={setMode}
          options={[
            { value: "DURATION", label: "Timer, aflopend" },
            { value: "UNTIL", label: "Tot tijdstip" },
          ]}
        />
      </div>

      {mode === "DURATION" ? (
        <div>
          <Label>Duur</Label>
          <div className="flex flex-wrap items-center gap-2">
            {ALLOWANCE_DURATION_PRESETS_MIN.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setDurationMin(m)}
                className={cn(
                  "rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                  durationMin === m ? "border-rose-400 bg-rose-500/15 text-rose-300" : "border-border bg-surface2 text-slate-300 hover:bg-surface2/70"
                )}
              >
                {m < 60 ? `${m} min` : `${m / 60} uur`}
              </button>
            ))}
            <Input
              type="number"
              min={ALLOWANCE_MIN_MINUTES}
              max={ALLOWANCE_MAX_MINUTES}
              step={5}
              value={durationMin}
              onChange={(e) => setDurationMin(Number(e.target.value) || 0)}
              className="h-10 w-24"
              aria-label="Eigen duur in minuten"
            />
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="allowance-endtime">Toegestaan tot</Label>
              <Input id="allowance-endtime" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} required />
            </div>
            <div>
              <Label htmlFor="allowance-startmode">Begint</Label>
              <Select id="allowance-startmode" value={startLater ? "later" : "now"} onChange={(e) => setStartLater(e.target.value === "later")}>
                <option value="now">Nu</option>
                <option value="later">Later vandaag</option>
              </Select>
            </div>
          </div>
          {startLater && (
            <div>
              <Label htmlFor="allowance-starttime">Starttijd</Label>
              <Input id="allowance-starttime" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
            </div>
          )}
        </div>
      )}

      <div>
        <Label htmlFor="allowance-note">Notitie (optioneel)</Label>
        <Input id="allowance-note" type="text" maxLength={ALLOWANCE_NOTE_MAX} placeholder="Bijv. mag bellen met moeder" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>

      <div className="flex justify-end gap-2 border-t border-border pt-4">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Annuleren
        </Button>
        <Button type="submit" loading={saving}>
          <Plus className="h-4 w-4" /> Toestemming geven
        </Button>
      </div>
    </form>
  );
}
