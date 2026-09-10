"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, Plane, XCircle, AlertTriangle, X } from "lucide-react";
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

export function MedicationCheckForm({
  medicationId,
  medicationName,
  clientName,
}: {
  medicationId: string;
  medicationName?: string;
  clientName?: string;
}) {
  const router = useRouter();
  const [comment, setComment] = React.useState("");
  const [showComment, setShowComment] = React.useState(false);
  const [loading, setLoading] = React.useState<MedicationCheckStatus | null>(null);
  const [showVmsModal, setShowVmsModal] = React.useState(false);

  async function handleCheck(status: MedicationCheckStatus) {
    setLoading(status);
    try {
      const res = await fetch("/api/medication-checks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ medicationId, status, comment }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Registreren mislukt");
        // A 409 here means another device just registered the last open
        // slot for today — refresh so this form disappears in sync with
        // reality instead of staying open and inviting a retry.
        if (res.status === 409) router.refresh();
        return;
      }
      toast.success(STATUS_OPTIONS.find((o) => o.status === status)?.label + " geregistreerd");
      setComment("");
      setShowComment(false);
      // The refresh (which can hide this whole form once the slot is filled)
      // waits until the VMS reminder is dismissed, so a "niet ingenomen"
      // registration never yanks the popup away before it's been seen.
      if (status === "NOT_TAKEN") {
        setShowVmsModal(true);
      } else {
        router.refresh();
      }
    } catch {
      toast.error("Er is iets misgegaan");
    } finally {
      setLoading(null);
    }
  }

  function closeVmsModal() {
    setShowVmsModal(false);
    router.refresh();
  }

  React.useEffect(() => {
    if (!showVmsModal) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") closeVmsModal();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showVmsModal]);

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
      <div className="grid grid-cols-1 gap-2 min-[480px]:flex min-[480px]:flex-wrap">
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

      {showVmsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            aria-hidden="true"
            className="absolute inset-0 animate-fade-in bg-black/70 backdrop-blur-sm"
            onClick={closeVmsModal}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="vms-modal-title"
            className="relative z-10 w-full max-w-md animate-scale-in rounded-2xl border border-border bg-surface p-6 shadow-lift"
          >
            <button
              type="button"
              onClick={closeVmsModal}
              aria-label="Sluiten"
              className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-surface2 hover:text-slate-100"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-500/15 text-red-400">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <h2 id="vms-modal-title" className="mt-4 text-lg font-semibold text-slate-50">
              Maak een VMS melding
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              {medicationName ? <span className="font-medium text-slate-200">{medicationName}</span> : "Deze medicatie"}
              {clientName ? (
                <>
                  {" "}
                  voor <span className="font-medium text-slate-200">{clientName}</span>
                </>
              ) : null}{" "}
              is geregistreerd als <span className="font-medium text-slate-200">niet ingenomen</span>. Een
              gemiste toediening hoort gemeld te worden via het Veilig Melden Systeem — maak de melding via
              het gebruikelijke VMS-formulier van de organisatie.
            </p>
            <Button onClick={closeVmsModal} className="mt-6 w-full">
              Begrepen
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
