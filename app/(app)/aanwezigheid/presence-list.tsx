"use client";

import * as React from "react";
import { toast } from "sonner";
import { Check, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export type PresenceClient = {
  id: string;
  name: string;
  present: boolean | null;
  comment: string;
};

export function PresenceList({ clients }: { clients: PresenceClient[] }) {
  const [state, setState] = React.useState(clients);

  async function updatePresence(clientId: string, present: boolean, comment: string) {
    const previous = state;
    setState((s) =>
      s.map((c) => (c.id === clientId ? { ...c, present, comment } : c))
    );
    try {
      const res = await fetch("/api/presence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, present, comment }),
      });
      if (!res.ok) throw new Error();
      toast.success("Aanwezigheid opgeslagen");
    } catch {
      setState(previous);
      toast.error("Opslaan mislukt, probeer opnieuw");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {state.map((client) => (
        <ClientRow key={client.id} client={client} onUpdate={updatePresence} />
      ))}
    </div>
  );
}

function ClientRow({
  client,
  onUpdate,
}: {
  client: PresenceClient;
  onUpdate: (clientId: string, present: boolean, comment: string) => void;
}) {
  const [comment, setComment] = React.useState(client.comment);
  const [showComment, setShowComment] = React.useState(false);

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-lg font-medium text-slate-100">{client.name}</span>
          <PresenceToggle present={client.present} onChange={(present) => onUpdate(client.id, present, comment)} />
        </div>
        <button
          type="button"
          onClick={() => setShowComment((v) => !v)}
          className="self-start text-sm text-sky-400 hover:underline"
        >
          {showComment ? "Verberg commentaar" : "Commentaar toevoegen"}
        </button>
        {showComment && (
          <div className="flex flex-col gap-2">
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Optioneel commentaar..."
              className="min-h-[80px]"
            />
            <Button
              size="sm"
              variant="outline"
              className="self-start"
              disabled={client.present === null}
              onClick={() => onUpdate(client.id, client.present as boolean, comment)}
            >
              Commentaar opslaan
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * A single sliding switch instead of two separate buttons — the thumb slides
 * to whichever side is active and the whole control tints green (aanwezig)
 * or red (afwezig), so status reads at a glance from color and position
 * alone, not just label text. Unset (present === null, never registered)
 * shows a neutral, centered thumb until a side is picked.
 */
function PresenceToggle({
  present,
  onChange,
}: {
  present: boolean | null;
  onChange: (present: boolean) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Aanwezigheid"
      className={cn(
        "relative flex h-12 w-60 shrink-0 items-center rounded-full border p-1 transition-colors duration-300",
        present === true && "border-emerald-500/50 bg-emerald-500/10",
        present === false && "border-red-500/50 bg-red-500/10",
        present === null && "border-border bg-surface2"
      )}
    >
      <div
        aria-hidden="true"
        className={cn(
          "absolute top-1 h-10 w-[calc(50%-4px)] rounded-full shadow-lift transition-all duration-300 ease-out",
          present === true && "left-1 bg-emerald-500 opacity-100",
          present === false && "left-[calc(50%+3px)] bg-red-500 opacity-100",
          present === null && "left-1 bg-slate-500 opacity-0"
        )}
      />
      <button
        type="button"
        onClick={() => onChange(true)}
        aria-pressed={present === true}
        className={cn(
          "relative z-10 flex h-10 w-1/2 items-center justify-center gap-1.5 rounded-full text-sm font-semibold transition-colors",
          present === true ? "text-white" : "text-slate-400 hover:text-slate-200"
        )}
      >
        <Check className="h-4 w-4" /> Aanwezig
      </button>
      <button
        type="button"
        onClick={() => onChange(false)}
        aria-pressed={present === false}
        className={cn(
          "relative z-10 flex h-10 w-1/2 items-center justify-center gap-1.5 rounded-full text-sm font-semibold transition-colors",
          present === false ? "text-white" : "text-slate-400 hover:text-slate-200"
        )}
      >
        <X className="h-4 w-4" /> Afwezig
      </button>
    </div>
  );
}
