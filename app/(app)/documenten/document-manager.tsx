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
import { cn } from "@/lib/utils";

export type DocumentRow = {
  id: string;
  title: string;
  url: string;
  clientId: string | null;
  clientName: string | null;
  category: "GENERAL" | "ONBOARDING";
};

const ONBOARDING_VALUE = "__onboarding__";
const GENERAL_VALUE = "";

function titleFromFileName(fileName: string): string {
  const withoutExtension = fileName.replace(/\.[^./]+$/, "");
  return withoutExtension || fileName;
}

type Thread = { key: string; label: string };

export function DocumentManager({
  documents,
  clients,
  canDelete,
}: {
  documents: DocumentRow[];
  clients: { id: string; name: string }[];
  canDelete: boolean;
}) {
  const router = useRouter();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [file, setFile] = React.useState<File | null>(null);
  const [title, setTitle] = React.useState("");
  const [destination, setDestination] = React.useState(GENERAL_VALUE);
  const [uploading, setUploading] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [showLinkOption, setShowLinkOption] = React.useState(false);
  const [url, setUrl] = React.useState("");
  const [linkLoading, setLinkLoading] = React.useState(false);

  const threads: Thread[] = React.useMemo(
    () => [
      { key: GENERAL_VALUE, label: "Algemeen" },
      { key: ONBOARDING_VALUE, label: "Nieuwe medewerker" },
      ...clients.map((c) => ({ key: c.id, label: c.name })),
    ],
    [clients]
  );
  const [activeThread, setActiveThread] = React.useState(GENERAL_VALUE);

  const visibleDocuments = documents.filter((d) => {
    if (activeThread === ONBOARDING_VALUE) return !d.clientId && d.category === "ONBOARDING";
    if (activeThread === GENERAL_VALUE) return !d.clientId && d.category === "GENERAL";
    return d.clientId === activeThread;
  });

  function destinationToFields(value: string): { clientId: string; category: "GENERAL" | "ONBOARDING" } {
    if (value === ONBOARDING_VALUE) return { clientId: "", category: "ONBOARDING" };
    return { clientId: value, category: "GENERAL" };
  }

  function handleFileChange(selected: File | null) {
    setFile(selected);
    if (selected && !title) {
      setTitle(titleFromFileName(selected.name));
    }
  }

  async function persistDocument(finalUrl: string) {
    const { clientId, category } = destinationToFields(destination);
    const res = await fetch("/api/documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, url: finalUrl, clientId, category }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Opslaan mislukt");
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setUploading(true);
    setProgress(0);
    let blobUrl: string;
    const timeoutController = new AbortController();
    const timeoutId = setTimeout(() => timeoutController.abort(), 60_000);
    try {
      const blob = await upload(file.name, file, {
        access: "public",
        handleUploadUrl: "/api/documents/upload",
        abortSignal: timeoutController.signal,
        onUploadProgress: ({ percentage }) => setProgress(percentage),
      });
      blobUrl = blob.url;
    } catch (error) {
      // @vercel/blob's upload() throws a typed BlobError (or a plain Error
      // relaying our own route's message) with a real, specific .message —
      // show it directly instead of guessing at a single root cause. An
      // abort from our own 60s timeout surfaces as a generic error here too,
      // so it gets its own explicit message instead of a confusing one.
      toast.error(
        timeoutController.signal.aborted
          ? "Uploaden duurde te lang en is afgebroken. Controleer je internetverbinding of probeer een kleiner bestand."
          : error instanceof Error
            ? `Uploaden lukt niet: ${error.message}`
            : "Uploaden lukt niet. Probeer het opnieuw."
      );
      setUploading(false);
      return;
    } finally {
      clearTimeout(timeoutId);
    }

    try {
      await persistDocument(blobUrl);
      toast.success("Document geüpload");
      setFile(null);
      setTitle("");
      setDestination(GENERAL_VALUE);
      if (fileInputRef.current) fileInputRef.current.value = "";
      router.refresh();
    } catch (error) {
      // This request is our own API, so its error message is real and safe to show.
      toast.error(error instanceof Error ? error.message : "Opslaan mislukt");
    } finally {
      setUploading(false);
      setProgress(0);
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
      setDestination(GENERAL_VALUE);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Toevoegen mislukt");
    } finally {
      setLinkLoading(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/documents/${id}`, { method: "DELETE" });
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
                  disabled={uploading}
                  className="block w-full rounded-xl border border-border bg-surface2 px-3 py-2.5 text-sm text-slate-100 file:mr-3 file:rounded-lg file:border-0 file:bg-sky-500 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white disabled:opacity-60"
                />
              </div>
              <div>
                <Label htmlFor="title">Titel</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={uploading}
                  required
                />
              </div>
              <div>
                <Label htmlFor="destination">Hoort bij</Label>
                <Select
                  id="destination"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  disabled={uploading}
                >
                  <option value={GENERAL_VALUE}>Algemeen</option>
                  <option value={ONBOARDING_VALUE}>Nieuwe medewerker</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            {uploading && (
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
                  <Label htmlFor="link-destination">Hoort bij</Label>
                  <Select
                    id="link-destination"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                  >
                    <option value={GENERAL_VALUE}>Algemeen</option>
                    <option value={ONBOARDING_VALUE}>Nieuwe medewerker</option>
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

      <div className="flex flex-wrap gap-2 border-b border-border pb-3">
        {threads.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setActiveThread(t.key)}
            className={cn(
              "rounded-full px-4 py-2 text-sm font-medium transition-colors",
              activeThread === t.key
                ? "bg-sky-500/15 text-sky-400"
                : "text-slate-400 hover:bg-surface2 hover:text-slate-100"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        {visibleDocuments.length === 0 && (
          <p className="text-sm text-slate-500">Nog geen documenten in dit onderdeel.</p>
        )}
        {visibleDocuments.map((d) => (
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
              </a>
              {canDelete && (
                <Button size="icon" variant="ghost" onClick={() => handleDelete(d.id)} aria-label="Verwijderen">
                  <Trash2 className="h-5 w-5 text-red-400" />
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
