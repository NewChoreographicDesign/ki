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
          <div className="flex gap-2">
            <Button
              size="lg"
              variant={client.present === true ? "secondary" : "outline"}
              onClick={() => onUpdate(client.id, true, comment)}
              className={cn(client.present === true && "ring-2 ring-emerald-400")}
            >
              <Check className="h-5 w-5" /> Aanwezig
            </Button>
            <Button
              size="lg"
              variant={client.present === false ? "danger" : "outline"}
              onClick={() => onUpdate(client.id, false, comment)}
              className={cn(client.present === false && "ring-2 ring-red-400")}
            >
              <X className="h-5 w-5" /> Afwezig
            </Button>
          </div>
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
