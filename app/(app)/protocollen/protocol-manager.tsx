"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { upload } from "@vercel/blob/client";
import { toast } from "sonner";
import { Trash2, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export type ProtocolRow = {
  id: string;
  title: string;
  content: string | null;
  url: string | null;
  clientName: string | null;
};

export function ProtocolManager({
  protocols,
  clients,
  canDelete,
}: {
  protocols: ProtocolRow[];
  clients: { id: string; name: string }[];
  canDelete: boolean;
}) {
  const router = useRouter();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [title, setTitle] = React.useState("");
  const [content, setContent] = React.useState("");
  const [file, setFile] = React.useState<File | null>(null);
  const [clientId, setClientId] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [progress, setProgress] = React.useState(0);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setProgress(0);

    let fileUrl = "";
    if (file) {
      const timeoutController = new AbortController();
      const timeoutId = setTimeout(() => timeoutController.abort(), 60_000);
      try {
        const blob = await upload(file.name, file, {
          access: "public",
          handleUploadUrl: "/api/protocols/upload",
          abortSignal: timeoutController.signal,
          onUploadProgress: ({ percentage }) => setProgress(percentage),
        });
        fileUrl = blob.url;
      } catch (error) {
        toast.error(
          timeoutController.signal.aborted
            ? "Uploaden duurde te lang en is afgebroken. Controleer je internetverbinding of probeer een kleiner bestand."
            : error instanceof Error
              ? `Uploaden lukt niet: ${error.message}`
              : "Uploaden lukt niet. Probeer het opnieuw."
        );
        setLoading(false);
        return;
      } finally {
        clearTimeout(timeoutId);
      }
    }

    try {
      const res = await fetch("/api/protocols", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content, url: fileUrl, clientId }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Toevoegen mislukt");
        return;
      }
      toast.success("Protocol toegevoegd");
      setTitle("");
      setContent("");
      setFile(null);
      setClientId("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      router.refresh();
    } catch {
      toast.error("Er is iets misgegaan");
    } finally {
      setLoading(false);
      setProgress(0);
    }
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/protocols/${id}`, { method: "DELETE" });
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
          <p className="text-sm text-slate-500">
            Typ de inhoud als tekst, upload een bestand (PDF, Word, Excel, foto), of beide.
          </p>
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
              <Label htmlFor="content">Inhoud (optioneel als je een bestand uploadt)</Label>
              <Textarea id="content" value={content} onChange={(e) => setContent(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="protocol-file">Bestand (optioneel)</Label>
              <input
                ref={fileInputRef}
                id="protocol-file"
                type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.txt"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                disabled={loading}
                className="block w-full rounded-xl border border-border bg-surface2 px-3 py-2.5 text-sm text-slate-100 file:mr-3 file:rounded-lg file:border-0 file:bg-sky-500 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white disabled:opacity-60"
              />
            </div>
            {loading && file && (
              <div className="flex flex-col gap-1">
                <div className="h-2 w-full overflow-hidden rounded-full bg-surface2">
                  <div
                    className="h-full rounded-full bg-sky-500 transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <span className="text-xs text-slate-500">{Math.round(progress)}%</span>
              </div>
            )}
            <Button
              type="submit"
              disabled={loading || !title || (!content && !file)}
              className="self-start"
            >
              {loading ? "Bezig..." : "Toevoegen"}
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
                {canDelete && (
                  <Button size="icon" variant="ghost" onClick={() => handleDelete(p.id)} aria-label="Verwijderen">
                    <Trash2 className="h-5 w-5 text-red-400" />
                  </Button>
                )}
              </div>
              {p.content && <p className="whitespace-pre-wrap text-sm text-slate-400">{p.content}</p>}
              {p.url && (
                <a
                  href={p.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="flex w-fit items-center gap-2 text-sm text-sky-400 hover:underline"
                >
                  <FileText className="h-4 w-4" /> Bestand openen
                </a>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
