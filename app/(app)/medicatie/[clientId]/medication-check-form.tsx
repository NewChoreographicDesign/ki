"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function MedicationCheckForm({ medicationId }: { medicationId: string }) {
  const router = useRouter();
  const [comment, setComment] = React.useState("");
  const [showComment, setShowComment] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  async function handleCheck() {
    setLoading(true);
    try {
      const res = await fetch("/api/medication-checks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ medicationId, comment }),
      });
      if (!res.ok) throw new Error();
      toast.success("Medicatie afgevinkt");
      setComment("");
      setShowComment(false);
      router.refresh();
    } catch {
      toast.error("Afvinken mislukt");
    } finally {
      setLoading(false);
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
      <div className="flex gap-2">
        <Button size="lg" variant="secondary" disabled={loading} onClick={handleCheck}>
          <CheckCircle2 className="h-5 w-5" /> {loading ? "Bezig..." : "Afvinken"}
        </Button>
        {!showComment && (
          <Button size="lg" variant="ghost" onClick={() => setShowComment(true)}>
            Commentaar
          </Button>
        )}
      </div>
      <p className="text-xs text-slate-500">
        Let op: afvinken kan niet ongedaan worden gemaakt.
      </p>
    </div>
  );
}
