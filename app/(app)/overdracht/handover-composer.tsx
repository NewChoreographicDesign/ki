"use client";

import * as React from "react";
import { toast } from "sonner";
import { ShieldCheck, ListChecks } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import {
  HANDOVER_CATEGORIES,
  HANDOVER_CATEGORY_META,
  HANDOVER_MAX_CONTENT,
  HANDOVER_PRIORITIES,
  HANDOVER_PRIORITY_META,
  type HandoverCategoryKey,
  type HandoverNote,
  type HandoverPriorityKey,
} from "@/lib/handover-shared";
import { CATEGORY_ICON, PRIORITY_STYLE } from "./handover-ui";

export type ComposerClient = { id: string; name: string; room: string | null };

const DRAFT_KEY = "overdracht-draft";
const TEMPLATE = "Situatie: \nWat is er gedaan: \nWat is nodig: ";

// Drafts live in sessionStorage only: they survive an accidental close or a
// refresh, but disappear with the tab — care text must not linger on a shared
// device (the same reason nothing here is written to localStorage).
function readDraft(): string {
  try {
    return window.sessionStorage.getItem(DRAFT_KEY) ?? "";
  } catch {
    return "";
  }
}
function writeDraft(value: string) {
  try {
    if (value) window.sessionStorage.setItem(DRAFT_KEY, value);
    else window.sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    /* storage unavailable (private mode): the draft just isn't kept */
  }
}

export function HandoverComposer({
  open,
  onClose,
  onSaved,
  clients,
  editing,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  clients: ComposerClient[];
  /** When set, the composer edits this note instead of creating one. */
  editing: HandoverNote | null;
}) {
  const [content, setContent] = React.useState("");
  const [clientId, setClientId] = React.useState("");
  const [category, setCategory] = React.useState<HandoverCategoryKey>("ALGEMEEN");
  const [priority, setPriority] = React.useState<HandoverPriorityKey>("INFO");
  const [needsAction, setNeedsAction] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const textRef = React.useRef<HTMLTextAreaElement>(null);

  // (Re)initialise whenever the dialog opens.
  React.useEffect(() => {
    if (!open) return;
    if (editing) {
      setContent(editing.content);
      setClientId(editing.clientId ?? "");
      setCategory(editing.category);
      setPriority(editing.priority);
      setNeedsAction(editing.needsAction);
    } else {
      setContent(readDraft());
      setClientId("");
      setCategory("ALGEMEEN");
      setPriority("INFO");
      setNeedsAction(false);
    }
    const t = window.setTimeout(() => textRef.current?.focus(), 60);
    return () => window.clearTimeout(t);
  }, [open, editing]);

  function updateContent(value: string) {
    setContent(value);
    if (!editing) writeDraft(value);
  }

  const trimmed = content.trim();
  const canSave = trimmed.length >= 3 && trimmed.length <= HANDOVER_MAX_CONTENT;

  async function save() {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      const res = await fetch(editing ? `/api/handovers/${editing.id}` : "/api/handovers", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing ? { content: trimmed, category, priority, needsAction } : { content: trimmed, clientId, category, priority, needsAction }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "Opslaan mislukt");
        return;
      }
      toast.success(editing ? "Notitie bijgewerkt" : "Overdracht opgeslagen");
      if (!editing) writeDraft("");
      onSaved();
      onClose();
    } catch {
      toast.error("Er is iets misgegaan — je tekst is bewaard, probeer het opnieuw");
    } finally {
      setSaving(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      void save();
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={editing ? "Notitie bewerken" : "Nieuwe overdracht"} className="sm:max-w-2xl">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
        onKeyDown={onKeyDown}
        className="flex flex-col gap-5"
      >
        {!editing && (
          <div>
            <Label htmlFor="ho-client">Voor wie?</Label>
            <Select id="ho-client" value={clientId} onChange={(e) => setClientId(e.target.value)}>
              <option value="">Algemeen (hele groep)</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.room && c.room !== c.name ? `${c.room} · ${c.name}` : c.name}
                </option>
              ))}
            </Select>
          </div>
        )}

        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-slate-300">Hoe belangrijk is het?</legend>
          <div className="grid grid-cols-3 gap-2" role="radiogroup">
            {HANDOVER_PRIORITIES.map((p) => {
              const style = PRIORITY_STYLE[p];
              const Icon = style.icon;
              const active = priority === p;
              return (
                <button
                  key={p}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setPriority(p)}
                  className={cn(
                    "flex min-h-[3.25rem] flex-col items-center justify-center gap-0.5 rounded-xl border px-2 py-2 text-sm font-medium transition-[background-color,border-color,color,transform] duration-150 ease-out active:scale-[0.97]",
                    active
                      ? p === "URGENT"
                        ? "border-red-500/60 bg-red-500/15 text-red-400"
                        : p === "AANDACHT"
                          ? "border-amber-400/60 bg-amber-500/15 text-amber-400"
                          : "border-slate-400/50 bg-slate-500/15 text-slate-100"
                      : "border-border bg-surface2/60 text-slate-400 hover:border-slate-500/60"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {HANDOVER_PRIORITY_META[p].label}
                </button>
              );
            })}
          </div>
          <p className="mt-1.5 text-xs text-slate-500">{HANDOVER_PRIORITY_META[priority].hint}</p>
        </fieldset>

        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-slate-300">Waar gaat het over?</legend>
          <div className="flex flex-wrap gap-2" role="radiogroup">
            {HANDOVER_CATEGORIES.map((c) => {
              const Icon = CATEGORY_ICON[c];
              const active = category === c;
              return (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  title={HANDOVER_CATEGORY_META[c].hint}
                  onClick={() => setCategory(c)}
                  className={cn(
                    "inline-flex h-10 items-center gap-1.5 rounded-full border px-3.5 text-sm transition-colors active:scale-[0.98]",
                    active ? "border-rose-400/60 bg-rose-500/15 text-rose-300" : "border-border bg-surface2/60 text-slate-400 hover:border-slate-500/60 hover:text-slate-200"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {HANDOVER_CATEGORY_META[c].label}
                </button>
              );
            })}
          </div>
        </fieldset>

        <div>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <Label htmlFor="ho-content" className="mb-0">
              Wat moet de volgende dienst weten?
            </Label>
            {trimmed.length === 0 && (
              <Button type="button" size="sm" variant="ghost" onClick={() => updateContent(TEMPLATE)}>
                <ListChecks className="h-4 w-4" /> Structuur
              </Button>
            )}
          </div>
          <Textarea
            id="ho-content"
            ref={textRef}
            value={content}
            onChange={(e) => updateContent(e.target.value)}
            placeholder="Schrijf kort en concreet: wat is er, wat is gedaan, wat is nog nodig?"
            className="min-h-[150px]"
            maxLength={HANDOVER_MAX_CONTENT + 200}
            aria-describedby="ho-privacy"
          />
          <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
            <span id="ho-privacy" className="flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-forest-400" />
              Vervalt automatisch
            </span>
            <span className={cn(trimmed.length > HANDOVER_MAX_CONTENT && "text-red-400")}>
              {trimmed.length}/{HANDOVER_MAX_CONTENT}
            </span>
          </div>
        </div>

        <Checkbox checked={needsAction} onChange={setNeedsAction} className="text-sm text-slate-200">
          Er is een actie nodig van de volgende dienst
        </Checkbox>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" onClick={onClose}>
            Annuleren
          </Button>
          <Button type="submit" loading={saving} disabled={!canSave}>
            {editing ? "Wijziging opslaan" : "Overdracht opslaan"}
          </Button>
        </div>
        <p className="-mt-2 hidden text-center text-xs text-slate-600 sm:block">Tip: ⌘/Ctrl + Enter om op te slaan</p>
      </form>
    </Modal>
  );
}
