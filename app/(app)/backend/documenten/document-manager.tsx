"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { upload } from "@vercel/blob/client";
import { toast } from "sonner";
import { Trash2, FileText, UploadCloud } from "lucide-react";
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

function titleFromFileName(fileName: string): string {
  const withoutExtension = fileName.replace(/\.[^./]+$/, "");
  return withoutExtension || fileName;
}

export function DocumentManager({
  documents,
  clients,
}: {
  documents: DocumentRow[];
  clients: { id: string; name: string }[];
}) {
  const router = useRouter();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [file, setFile] = React.useState<File | null>(null);
  const [title, setTitle] = React.useState("");
  const [clientId, setClientId] = React.useState("");
  const [uploading, setUploading] = React.useState(false);
  const [showLinkOption, setShowLinkOption] = React.useState(false);
  const [url, setUrl] = React.useState("");
  const [linkLoading, setLinkLoading] = React.useState(false);

  function handleFileChange(selected: File | null) {
    setFile(selected);
    if (selected && !title) {
      setTitle(titleFromFileName(selected.name));
    }
  }

  async function persistDocument(finalUrl: string) {
    const res = await fetch("/api/backend/documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, url: finalUrl, clientId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Opslaan mislukt");
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setUploading(true);
    let blobUrl: string;
    try {
      const blob = await upload(file.name, file, {
        access: "public",
        handleUploadUrl: "/api/backend/documents/upload",
      });
      blobUrl = blob.url;
    } catch (error) {
      // @vercel/blob's upload() throws a typed BlobError (or a plain Error
      // relaying our own route's message) with a real, specific .message —
      // show it directly instead of guessing at a single root cause.
      toast.error(
        error instanceof Error
          ? `Uploaden lukt niet: ${error.message}`
          : "Uploaden lukt niet. Probeer het opnieuw."
      );
      setUploading(false);
      return;
    }

    try {
      await persistDocument(blobUrl);
      toast.success("Document geüpload");
      setFile(null);
      setTitle("");
      setClientId("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      router.refresh();
    } catch (error) {
      // This request is our own API, so its error message is real and safe to show.
      toast.error(error instanceof Error ? error.message : "Opslaan mislukt");
    } finally {
      setUploading(false);
    }
  }

  async function handleLinkSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLinkLoading(true);
    try {
      await persistDocument(url);
      toast.success("Document toegevoegd");
      setTitle("");
      setUrl("");
      setClientId("");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Toevoegen mislukt");
    } finally {
      setLinkLoading(false);
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
          <CardTitle>Document uploaden</CardTitle>
          <p className="text-sm text-slate-500">
            Kies een bestand van je computer (PDF, Word, Excel, foto). Het wordt automatisch
            veilig opgeslagen — je hoeft nergens een link voor op te zoeken.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpload} className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="sm:col-span-1">
                <Label htmlFor="file">Bestand</Label>
                <input
                  ref={fileInputRef}
                  id="file"
                  type="file"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.txt"
                  onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
                  className="block w-full rounded-xl border border-border bg-surface2 px-3 py-2.5 text-sm text-slate-100 file:mr-3 file:rounded-lg file:border-0 file:bg-sky-500 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white"
                />
              </div>
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
            <Button type="submit" disabled={uploading || !file || !title} className="self-start">
              <UploadCloud className="h-5 w-5" /> {uploading ? "Bezig met uploaden..." : "Uploaden"}
            </Button>
          </form>

          <button
            type="button"
            onClick={() => setShowLinkOption((v) => !v)}
            className="mt-4 text-sm text-sky-400 hover:underline"
          >
            {showLinkOption ? "Verberg geavanceerde optie" : "Ik heb al een link naar een document"}
          </button>

          {showLinkOption && (
            <form onSubmit={handleLinkSubmit} className="mt-4 flex flex-col gap-4 border-t border-border pt-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <Label htmlFor="link-title">Titel</Label>
                  <Input id="link-title" value={title} onChange={(e) => setTitle(e.target.value)} required />
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
                  <Label htmlFor="link-client">Cliënt (optioneel)</Label>
                  <Select id="link-client" value={clientId} onChange={(e) => setClientId(e.target.value)}>
                    <option value="">Algemeen</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
              <Button
                type="submit"
                variant="outline"
                disabled={linkLoading || !title || !url}
                className="self-start"
              >
                {linkLoading ? "Toevoegen..." : "Link toevoegen"}
              </Button>
            </form>
          )}
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
