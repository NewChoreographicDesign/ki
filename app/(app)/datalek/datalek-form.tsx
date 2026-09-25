"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { formatBirthDateInput } from "@/lib/format-birthdate-input";
import { parseDDMMYYYY, amsterdamDate, getZonedParts, AMSTERDAM_TZ } from "@/lib/utils";

type Severity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

const SEVERITY_LABEL: Record<Severity, string> = {
  LOW: "Laag",
  MEDIUM: "Middel",
  HIGH: "Hoog",
  CRITICAL: "Kritiek",
};

function initialDetected() {
  const p = getZonedParts(new Date(), AMSTERDAM_TZ);
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    date: `${pad(p.day)}-${pad(p.month)}-${p.year}`,
    time: `${pad(p.hour)}:${pad(p.minute)}`,
  };
}

// Deliberately fast and low-friction: reporting a possible datalek should
// take seconds, not force the reporter to already know how serious it is
// or what the follow-up should be — that's assessed afterwards by an
// admin (see datalek-case-list.tsx).
export function DatalekForm() {
  const router = useRouter();
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [affectedData, setAffectedData] = React.useState("");
  const [affectedPersonsEstimate, setAffectedPersonsEstimate] = React.useState("");
  const [severity, setSeverity] = React.useState<Severity>("MEDIUM");
  const [detectedDate, setDetectedDate] = React.useState(() => initialDetected().date);
  const [detectedTime, setDetectedTime] = React.useState(() => initialDetected().time);
  const [loading, setLoading] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const day = parseDDMMYYYY(detectedDate);
    const [hourStr, minuteStr] = detectedTime.split(":");
    const hour = Number(hourStr);
    const minute = Number(minuteStr);
    if (!day || Number.isNaN(hour) || Number.isNaN(minute)) {
      toast.error("Ongeldige datum of tijd");
      return;
    }
    const detectedAt = amsterdamDate(
      day.getUTCFullYear(),
      day.getUTCMonth() + 1,
      day.getUTCDate(),
      hour,
      minute
    ).toISOString();

    setLoading(true);
    try {
      const res = await fetch("/api/datalek", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          affectedData,
          affectedPersonsEstimate: affectedPersonsEstimate ? Number(affectedPersonsEstimate) : undefined,
          severity,
          detectedAt,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Melden mislukt");
        return;
      }
      toast.success("Datalek gemeld — de beheerders zijn direct gewaarschuwd");
      setTitle("");
      setDescription("");
      setAffectedData("");
      setAffectedPersonsEstimate("");
      setSeverity("MEDIUM");
      const reset = initialDetected();
      setDetectedDate(reset.date);
      setDetectedTime(reset.time);
      router.refresh();
    } catch {
      toast.error("Er is iets misgegaan");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-2">
          <Label htmlFor="datalek-title">Korte titel</Label>
          <Input
            id="datalek-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Bijv. laptop met cliëntgegevens kwijt"
            required
          />
        </div>
        <div>
          <Label htmlFor="datalek-severity">Ernst (eerste inschatting)</Label>
          <Select id="datalek-severity" value={severity} onChange={(e) => setSeverity(e.target.value as Severity)}>
            {Object.entries(SEVERITY_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="datalek-persons">Geschat aantal betrokkenen</Label>
          <Input
            id="datalek-persons"
            type="number"
            min={0}
            value={affectedPersonsEstimate}
            onChange={(e) => setAffectedPersonsEstimate(e.target.value)}
            placeholder="Onbekend"
          />
        </div>
        <div>
          <Label htmlFor="datalek-detectedDate">Ontdekt op</Label>
          <Input
            id="datalek-detectedDate"
            inputMode="numeric"
            placeholder="DD-MM-JJJJ"
            value={detectedDate}
            onChange={(e) => setDetectedDate(formatBirthDateInput(e.target.value))}
            required
          />
        </div>
        <div>
          <Label htmlFor="datalek-detectedTime">Tijd</Label>
          <Input
            id="datalek-detectedTime"
            type="time"
            value={detectedTime}
            onChange={(e) => setDetectedTime(e.target.value)}
            required
          />
        </div>
      </div>
      <div>
        <Label htmlFor="datalek-description">Wat is er gebeurd?</Label>
        <Textarea
          id="datalek-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Kort en feitelijk — wat is er gebeurd, hoe is het ontdekt"
          required
        />
      </div>
      <div>
        <Label htmlFor="datalek-affectedData">Welke gegevens zijn (mogelijk) geraakt?</Label>
        <Textarea
          id="datalek-affectedData"
          value={affectedData}
          onChange={(e) => setAffectedData(e.target.value)}
          placeholder="Bijv. namen en kamernummers van 6 cliënten in een overdrachtsformulier"
          required
        />
      </div>
      <Button
        type="submit"
        loading={loading}
        disabled={!title.trim() || !description.trim() || !affectedData.trim()}
        className="self-start"
      >
        Melden
      </Button>
    </form>
  );
}
