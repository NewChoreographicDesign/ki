"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

export type DocumentRow = {
  id: string;
  title: string;
  url: string;
  clientName: string | null;
};

export function DocumentManager({
  documents,
  clients,
}: {
  documents: DocumentRow[];
  clients: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [title, setTitle] = React.useState("");
  const [url, setUrl] = React.useState("");
  const [clientId, setClientId] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/backend/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, url, clientId }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Toevoegen mislukt");
        return;
      }
      toast.success("Document toegevoegd");
      setTitle("");
      setUrl("");
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
      const res = await fetch(`/api/backend/documents/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Document verwijderd");
      router.refresh();
    } catch {
      toast.error("Verwijderen mislukt");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Nieuw document</CardTitle>
          <p className="text-sm text-slate-500">
            Plak een link (bijv. Vercel Blob URL) naar het document.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <Label htmlFor="title">Titel</Label>
                <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required />
              </div>
              <div>
                <Label htmlFor="url">URL</Label>
                <Input
                  id="url"
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://..."
                  required
                />
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
            <Button type="submit" disabled={loading || !title || !url} className="self-start">
              {loading ? "Toevoegen..." : "Toevoegen"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3">
        {documents.map((d) => (
          <Card key={d.id}>
            <CardContent className="flex items-center justify-between gap-3 p-5">
              <a
                href={d.url}
                target="_blank"
                rel="noreferrer noopener"
                className="flex items-center gap-3 text-slate-100 hover:text-sky-400"
              >
                <FileText className="h-5 w-5" />
                <span>{d.title}</span>
                {d.clientName && <span className="text-sm text-slate-500">({d.clientName})</span>}
              </a>
              <Button size="icon" variant="ghost" onClick={() => handleDelete(d.id)} aria-label="Verwijderen">
                <Trash2 className="h-5 w-5 text-red-400" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
