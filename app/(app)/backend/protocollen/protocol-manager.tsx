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
import { Textarea } from "@/components/ui/textarea";

export type ProtocolRow = {
  id: string;
  title: string;
  content: string;
  clientName: string | null;
};

export function ProtocolManager({
  protocols,
  clients,
}: {
  protocols: ProtocolRow[];
  clients: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [title, setTitle] = React.useState("");
  const [content, setContent] = React.useState("");
  const [clientId, setClientId] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/backend/protocols", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content, clientId }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Toevoegen mislukt");
        return;
      }
      toast.success("Protocol toegevoegd");
      setTitle("");
      setContent("");
      setClientId("");
      router.refresh();
    } catch {
      toast.error("Er is iets misgegaan");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/backend/protocols/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Protocol verwijderd");
      router.refresh();
    } catch {
      toast.error("Verwijderen mislukt");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Nieuw protocol</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="title">Titel</Label>
                <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required />
              </div>
              <div>
                <Label htmlFor="client">Cliënt (optioneel)</Label>
                <Select id="client" value={clientId} onChange={(e) => setClientId(e.target.value)}>
                  <option value="">Algemeen</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="content">Inhoud</Label>
              <Textarea id="content" value={content} onChange={(e) => setContent(e.target.value)} required />
            </div>
            <Button type="submit" disabled={loading || !title || !content} className="self-start">
              {loading ? "Toevoegen..." : "Toevoegen"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3">
        {protocols.map((p) => (
          <Card key={p.id}>
            <CardContent className="flex flex-col gap-2 p-5">
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium text-slate-100">
                  {p.title} {p.clientName && <span className="text-sm text-slate-500">({p.clientName})</span>}
                </span>
                <Button size="icon" variant="ghost" onClick={() => handleDelete(p.id)} aria-label="Verwijderen">
                  <Trash2 className="h-5 w-5 text-red-400" />
                </Button>
              </div>
              <p className="whitespace-pre-wrap text-sm text-slate-400">{p.content}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
