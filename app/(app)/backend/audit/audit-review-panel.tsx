"use client";

import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2 } from "lucide-react";
import { formatDateTime } from "@/lib/utils";

export type ReviewRunRow = {
  id: string;
  windowStart: string;
  windowEnd: string;
  findingsCount: number;
  createdAt: string;
};

export type ReviewFindingRow = {
  id: string;
  category: string;
  severity: "LOW" | "MEDIUM" | "HIGH";
  summary: string;
  resolved: boolean;
  resolvedByName: string | null;
  resolvedAt: string | null;
  createdAt: string;
};

const SEVERITY_VARIANT: Record<ReviewFindingRow["severity"], "rose" | "amber" | "slate"> = {
  HIGH: "rose",
  MEDIUM: "amber",
  LOW: "slate",
};

const SEVERITY_LABEL: Record<ReviewFindingRow["severity"], string> = {
  HIGH: "Hoog",
  MEDIUM: "Middel",
  LOW: "Laag",
};

// The "controle" (review) half of the periodic audit process: an admin
// actually reading and acknowledging a finding, not just the system
// noticing it — see app/api/backend/audit/findings/[id]/resolve/route.ts.
// Runs are shown regardless of findings, since the run history itself is
// what demonstrates this process happens on a schedule.
export function AuditReviewPanel({ runs, findings: initialFindings }: { runs: ReviewRunRow[]; findings: ReviewFindingRow[] }) {
  const [findings, setFindings] = React.useState(initialFindings);
  const [resolvingId, setResolvingId] = React.useState<string | null>(null);

  async function resolve(id: string) {
    setResolvingId(id);
    try {
      const res = await fetch(`/api/backend/audit/findings/${id}/resolve`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Afhandelen mislukt");
        return;
      }
      setFindings((prev) => prev.filter((f) => f.id !== id));
      toast.success("Bevinding afgehandeld");
    } catch {
      toast.error("Er is iets misgegaan");
    } finally {
      setResolvingId(null);
    }
  }

  const openFindings = findings.filter((f) => !f.resolved);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-sm font-medium text-slate-200">Openstaande aandachtspunten</h3>
        {openFindings.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">
            Geen openstaande aandachtspunten uit de periodieke logcontrole.
          </p>
        ) : (
          <div className="mt-2 flex flex-col gap-2">
            {openFindings.map((f) => (
              <div
                key={f.id}
                className="flex flex-col gap-2 rounded-md border border-border bg-surface2 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <Badge variant={SEVERITY_VARIANT[f.severity]}>{SEVERITY_LABEL[f.severity]}</Badge>
                    <span className="text-xs text-slate-500">{formatDateTime(new Date(f.createdAt))}</span>
                  </div>
                  <p className="text-sm text-slate-200">{f.summary}</p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="gap-1.5 self-start sm:self-auto"
                  loading={resolvingId === f.id}
                  onClick={() => resolve(f.id)}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Afgehandeld
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h3 className="text-sm font-medium text-slate-200">Uitvoeringsgeschiedenis</h3>
        <p className="mt-1 text-xs text-slate-500">
          Elke rij bewijst dat de logcontrole daadwerkelijk is uitgevoerd, ook op dagen zonder
          bevindingen.
        </p>
        {runs.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">Nog geen controle uitgevoerd.</p>
        ) : (
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-slate-400">
                  <th className="px-3 py-2 font-medium">Uitgevoerd op</th>
                  <th className="px-3 py-2 font-medium">Periode</th>
                  <th className="px-3 py-2 font-medium">Bevindingen</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <tr key={run.id} className="border-b border-border/50 last:border-0">
                    <td className="whitespace-nowrap px-3 py-2 text-slate-300">{formatDateTime(new Date(run.createdAt))}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-slate-500">
                      {formatDateTime(new Date(run.windowStart))} – {formatDateTime(new Date(run.windowEnd))}
                    </td>
                    <td className="px-3 py-2 text-slate-400">{run.findingsCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
