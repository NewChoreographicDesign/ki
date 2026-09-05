"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, Plane, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type MedicationCheckStatus = "TAKEN" | "LEAVE" | "NOT_TAKEN";

const STATUS_OPTIONS: {
  status: MedicationCheckStatus;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  variant: "secondary" | "outline" | "danger";
}[] = [
  { status: "TAKEN", label: "Afvinken", icon: CheckCircle2, variant: "secondary" },
  { status: "LEAVE", label: "Verlof", icon: Plane, variant: "outline" },
  { status: "NOT_TAKEN", label: "Niet ingenomen", icon: XCircle, variant: "danger" },
];

export function MedicationCheckForm({ medicationId }: { medicationId: string }) {
  const router = useRouter();
  const [comment, setComment] = React.useState("");
  const [showComment, setShowComment] = React.useState(false);
  const [loading, setLoading] = React.useState<MedicationCheckStatus | null>(null);

  async function handleCheck(status: MedicationCheckStatus) {
    setLoading(status);
    try {
      const res = await fetch("/api/medication-checks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ medicationId, status, comment }),
      });
      if (!res.ok) throw new Error();
      toast.success(STATUS_OPTIONS.find((o) => o.status === status)?.label + " geregistreerd");
      setComment("");
      setShowComment(false);
      router.refresh();
    } catch {
      toast.error("Registreren mislukt");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {showComment && (
        <Textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Optioneel commentaar..."
          className="min-h-[70px]"
        />
      )}
      <div className="flex flex-wrap gap-2">
        {STATUS_OPTIONS.map(({ status, label, icon: Icon, variant }) => (
          <Button
            key={status}
            size="lg"
            variant={variant}
            loading={loading === status}
            disabled={loading !== null && loading !== status}
            onClick={() => handleCheck(status)}
          >
            {loading !== status && <Icon className="h-5 w-5" />} {label}
          </Button>
        ))}
        {!showComment && (
          <Button size="lg" variant="ghost" onClick={() => setShowComment(true)}>
            Commentaar
          </Button>
        )}
      </div>
      <p className="text-xs text-slate-500">
        Let op: een registratie kan niet ongedaan worden gemaakt.
      </p>
    </div>
  );
}
