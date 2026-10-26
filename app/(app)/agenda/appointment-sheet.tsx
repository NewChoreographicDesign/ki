"use client";

import * as React from "react";
import { toast } from "sonner";
import { Ban, Check, Copy, MapPin, Pencil, RotateCcw, Send, Trash2, UserCheck, UserMinus } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  agendaState,
  AGENDA_CATEGORY_META,
  AGENDA_EVENT_LABEL,
  AGENDA_NOTE_MAX,
  AGENDA_REMINDER_OPTIONS,
  AGENDA_STATUS_LABEL,
  needsEscort,
  type AgendaEventView,
  type AgendaItem,
} from "@/lib/agenda-shared";
import { amsterdamNow } from "@/lib/date-shared";
import { api, apiMessage, CATEGORY_ICON, type ApiResult, colorOf, fullWhen, initials, whenPhrase, type ColorMode } from "./agenda-ui";
import { useAgendaEnv } from "./agenda-env";

type Mode = "view" | "done" | "cancel" | "delete";
type Scope = "this" | "following" | "all";

const STATE_BADGE = {
  cancelled: "bg-slate-500/20 text-slate-300",
  done: "bg-forest-500/15 text-forest-300",
  ongoing: "bg-rose-500/20 text-rose-300",
  upcoming: "bg-surface2 text-slate-300",
  "to-finish": "bg-amber-500/15 text-amber-400",
  past: "bg-slate-500/20 text-slate-300",
} as const;
const STATE_LABEL = { cancelled: "Geannuleerd", done: "Afgerond", ongoing: "Nu bezig", upcoming: "Gepland", "to-finish": "Nog af te ronden", past: "Geweest" } as const;

function formatStamp(iso: string): string {
  return new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Amsterdam" }).format(new Date(iso));
}

export function AppointmentSheet({
  item,
  colorMode,
  onClose,
  onPatched,
  onReload,
  onRemoved,
  onEdit,
  onDuplicate,
}: {
  item: AgendaItem | null;
  colorMode: ColorMode;
  onClose: () => void;
  onPatched: (item: AgendaItem) => void;
  /** After a change that touches other afspraken of the same reeks. */
  onReload: () => void;
  onRemoved: () => void;
  onEdit: (item: AgendaItem) => void;
  onDuplicate: (item: AgendaItem) => void;
}) {
  const { viewerId, canSupervise, staff, nowMs } = useAgendaEnv();
  const [mode, setMode] = React.useState<Mode>("view");
  const [note, setNote] = React.useState("");
  const [scope, setScope] = React.useState<Scope>("this");
  const [busy, setBusy] = React.useState(false);
  const [events, setEvents] = React.useState<AgendaEventView[] | null>(null);
  const [comment, setComment] = React.useState("");
  const [pickStaff, setPickStaff] = React.useState("");
  const id = item?.id;

  // A different afspraak (or closing) always starts from the plain view.
  React.useEffect(() => {
    setMode("view");
    setNote("");
    setScope("this");
    setComment("");
    setPickStaff("");
    setEvents(null);
  }, [id]);

  const loadEvents = React.useCallback(async () => {
    if (!id) return;
    const res = await api(`/api/appointments/${id}/events`);
    if (res.ok) setEvents(res.data.events);
  }, [id]);

  React.useEffect(() => {
    void loadEvents();
  }, [loadEvents, item?.version, item?.status, item?.assigneeId]);

  if (!item) return <Modal open={false} onClose={onClose} title="Afspraak">{null}</Modal>;

  const state = agendaState(item, nowMs);
  const todayYmd = amsterdamNow(nowMs).dateISO;
  const color = colorOf(item, colorMode);
  const CategoryIcon = item.category ? CATEGORY_ICON[item.category] : null;
  const mine = item.assigneeId === viewerId;
  const canDelete = canSupervise || item.createdById === viewerId;
  const canChooseOthers = canSupervise || item.createdById === viewerId;
  const phrase = whenPhrase(item, nowMs);
  const reminderLabel = AGENDA_REMINDER_OPTIONS.find((o) => o.value === item.remindMinutes)?.label ?? `${item.remindMinutes} minuten ervoor`;

  async function run(label: string, fn: () => Promise<ApiResult>) {
    setBusy(true);
    const res = await fn();
    setBusy(false);
    if (!res.ok) {
      toast.error(apiMessage(res, `${label} mislukt`));
      return null;
    }
    return res;
  }

  async function changeStatus(status: "PLANNED" | "DONE" | "CANCELLED") {
    const previous = item!;
    const res = await run("Opslaan", () => api(`/api/appointments/${previous.id}/status`, "POST", { status, note, scope: status === "CANCELLED" ? scope : "this" }));
    if (!res) return;
    if (res.data.appointment) onPatched(res.data.appointment);
    if (res.data.updated > 1) onReload();
    setMode("view");
    setNote("");
    if (status === "DONE") {
      toast.success("Afspraak afgerond", { action: { label: "Ongedaan maken", onClick: () => void api(`/api/appointments/${previous.id}/status`, "POST", { status: "PLANNED" }).then((r) => r.ok && r.data.appointment && onPatched(r.data.appointment)) } });
    } else toast.success(status === "CANCELLED" ? (res.data.updated > 1 ? `${res.data.updated} afspraken geannuleerd` : "Afspraak geannuleerd") : "Afspraak heropend");
  }

  async function assign(userId: string | null, takeover = false) {
    const res = await api(`/api/appointments/${item!.id}/assign`, "POST", { userId, takeover });
    if (res.status === 409 && res.data?.takeover) {
      if (window.confirm(`${res.data.assigneeName} gaat al mee. Wil je het overnemen?`)) return assign(userId, true);
      return;
    }
    if (!res.ok) {
      toast.error(apiMessage(res, "Opslaan mislukt"));
      return;
    }
    onPatched(res.data.appointment);
    setPickStaff("");
    toast.success(userId === null ? "Begeleider vrijgegeven" : userId === viewerId ? "Je gaat mee" : "Begeleider gekozen");
  }

  async function remove(scopeToDelete: Scope) {
    const res = await run("Verwijderen", () => api(`/api/appointments/${item!.id}?scope=${scopeToDelete}`, "DELETE"));
    if (!res) return;
    toast.success(scopeToDelete === "this" ? "Afspraak verwijderd" : "Afspraken verwijderd");
    onRemoved();
  }

  async function requestDelete() {
    if (item!.seriesId) {
      setMode("delete");
      return;
    }
    if (window.confirm("Afspraak verwijderen? Hierdoor verdwijnt ook de geschiedenis van deze afspraak. Annuleren bewaart die wel.")) await remove("this");
  }

  async function sendComment() {
    if (!comment.trim()) return;
    const res = await run("Plaatsen", () => api(`/api/appointments/${item!.id}/events`, "POST", { comment }));
    if (!res) return;
    setComment("");
    setEvents(res.data.events as AgendaEventView[]);
  }

  const showEscortWarning = needsEscort(item, nowMs);

  return (
    <Modal
      open
      onClose={() => {
        if (mode !== "view") setMode("view");
        else onClose();
      }}
      title={mode === "done" ? "Afspraak afronden" : mode === "cancel" ? "Afspraak annuleren" : mode === "delete" ? "Afspraak verwijderen" : "Afspraak"}
      className="sm:max-w-lg"
    >
      {mode === "view" && (
        <div className="flex flex-col gap-5">
          <div className="flex items-start gap-3">
            <span className="mt-2 h-3 w-3 shrink-0 rounded-full" style={{ background: color.dot }} aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <h3 className={cn("text-lg font-semibold text-slate-50", item.status === "CANCELLED" && "line-through decoration-slate-500")}>{item.title}</h3>
              <p className="text-sm text-slate-400">{fullWhen(item, todayYmd)}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", STATE_BADGE[state])}>
                  {STATE_LABEL[state]}
                  {phrase && state === "upcoming" ? ` · ${phrase}` : ""}
                </span>
                {item.seriesId && <span className="rounded-full bg-surface2 px-2 py-0.5 text-xs text-slate-400">Onderdeel van een reeks</span>}
                {CategoryIcon && item.category && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-surface2 px-2 py-0.5 text-xs text-slate-300">
                    <CategoryIcon className="h-3 w-3" /> {AGENDA_CATEGORY_META[item.category].label}
                  </span>
                )}
              </div>
            </div>
          </div>

          <dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-2 text-sm">
            {item.clientName && (
              <>
                <dt className="text-slate-500">Cliënt</dt>
                <dd className="text-slate-200">{item.clientName}</dd>
              </>
            )}
            {item.location && (
              <>
                <dt className="text-slate-500">Locatie</dt>
                <dd className="flex items-start gap-1.5 text-slate-200">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" /> {item.location}
                </dd>
              </>
            )}
            <dt className="text-slate-500">Wie gaat mee</dt>
            <dd className="flex flex-wrap items-center gap-2 text-slate-200">
              {item.assigneeName ? (
                <span className="inline-flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-rose-500/20 text-xs font-semibold text-rose-300">{initials(item.assigneeName)}</span>
                  {mine ? "Jij" : item.assigneeName}
                </span>
              ) : (
                <span className={cn(showEscortWarning ? "font-medium text-amber-400" : "text-slate-400")}>{showEscortWarning ? "Nog niemand gaat mee" : "Nog niemand"}</span>
              )}
              {item.status === "PLANNED" && !mine && (
                <Button size="sm" variant={item.assigneeId ? "outline" : "primary"} disabled={busy} onClick={() => void assign(viewerId)} className="gap-1.5">
                  <UserCheck className="h-4 w-4" /> {item.assigneeId ? "Overnemen" : "Ik ga mee"}
                </Button>
              )}
              {item.assigneeId && (mine || canSupervise) && item.status === "PLANNED" && (
                <Button size="sm" variant="ghost" disabled={busy} onClick={() => void assign(null)} className="gap-1.5">
                  <UserMinus className="h-4 w-4" /> Vrijgeven
                </Button>
              )}
            </dd>
            {canChooseOthers && item.status === "PLANNED" && (
              <>
                <dt className="text-slate-500">Kies collega</dt>
                <dd className="flex gap-2">
                  <Select aria-label="Begeleider kiezen" value={pickStaff} onChange={(e) => setPickStaff(e.target.value)} className="h-9 text-sm">
                    <option value="">Kies…</option>
                    {staff.filter((s) => s.id !== item.assigneeId).map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </Select>
                  <Button size="sm" variant="outline" disabled={!pickStaff || busy} onClick={() => void assign(pickStaff)}>
                    Kies
                  </Button>
                </dd>
              </>
            )}
            {item.remindMinutes !== null && !item.allDay && (
              <>
                <dt className="text-slate-500">Herinnering</dt>
                <dd className="text-slate-300">{reminderLabel}</dd>
              </>
            )}
            <dt className="text-slate-500">Gemaakt door</dt>
            <dd className="text-slate-300">{item.createdByName}</dd>
          </dl>

          {item.description && <p className="whitespace-pre-wrap rounded-xl bg-surface2/50 p-3 text-sm text-slate-300">{item.description}</p>}
          {item.outcome && (
            <div className="rounded-xl border border-border p-3 text-sm">
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">{item.status === "CANCELLED" ? "Reden van annuleren" : "Uitslag / afspraken"}</p>
              <p className="whitespace-pre-wrap text-slate-200">{item.outcome}</p>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {item.status === "PLANNED" ? (
              <>
                <Button onClick={() => setMode("done")} className="gap-1.5">
                  <Check className="h-4 w-4" /> Afronden
                </Button>
                <Button variant="outline" onClick={() => onEdit(item)} className="gap-1.5">
                  <Pencil className="h-4 w-4" /> Bewerken
                </Button>
                <Button variant="outline" onClick={() => setMode("cancel")} className="gap-1.5">
                  <Ban className="h-4 w-4" /> Annuleren
                </Button>
              </>
            ) : (
              <Button variant="outline" disabled={busy} onClick={() => void changeStatus("PLANNED")} className="gap-1.5">
                <RotateCcw className="h-4 w-4" /> Opnieuw openen
              </Button>
            )}
            <Button variant="ghost" onClick={() => onDuplicate(item)} className="gap-1.5">
              <Copy className="h-4 w-4" /> Dupliceren
            </Button>
            {canDelete && (
              <Button variant="ghost" onClick={() => void requestDelete()} className="gap-1.5 text-red-400 hover:text-red-300">
                <Trash2 className="h-4 w-4" /> Verwijderen
              </Button>
            )}
          </div>

          <section aria-label="Activiteit" className="border-t border-border pt-4">
            <h4 className="mb-2 text-sm font-semibold text-slate-200">Activiteit</h4>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void sendComment();
              }}
              className="mb-3 flex items-start gap-2"
            >
              <Textarea
                aria-label="Opmerking toevoegen"
                value={comment}
                maxLength={AGENDA_NOTE_MAX}
                onChange={(e) => setComment(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    void sendComment();
                  }
                }}
                placeholder="Opmerking voor collega's…"
                rows={2}
                className="min-h-0 flex-1"
              />
              <Button type="submit" size="icon" variant="outline" aria-label="Opmerking plaatsen" disabled={!comment.trim() || busy}>
                <Send className="h-4 w-4" />
              </Button>
            </form>
            {events === null ? (
              <p className="text-sm text-slate-500">Laden…</p>
            ) : events.length === 0 ? (
              <p className="text-sm text-slate-500">Nog geen activiteit.</p>
            ) : (
              <ol className="flex flex-col gap-2">
                {events.map((e) => (
                  <li key={e.id} className="text-sm">
                    <p className="text-slate-300">
                      <span className="font-medium text-slate-100">{e.userName}</span> · {AGENDA_EVENT_LABEL[e.type]}
                      <span className="ml-1.5 text-xs text-slate-500">{formatStamp(e.createdAt)}</span>
                    </p>
                    {e.comment && <p className="whitespace-pre-wrap text-slate-400">{e.comment}</p>}
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      )}

      {(mode === "done" || mode === "cancel") && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void changeStatus(mode === "done" ? "DONE" : "CANCELLED");
          }}
          className="flex flex-col gap-4"
        >
          <p className="text-sm text-slate-400">
            <strong className="text-slate-200">{item.title}</strong> · {fullWhen(item, todayYmd)}
          </p>
          <div>
            <label htmlFor="agenda-note" className="mb-1.5 block text-sm font-medium text-slate-300">
              {mode === "done" ? "Wat is er afgesproken of besproken? (optioneel)" : "Reden (optioneel)"}
            </label>
            <Textarea id="agenda-note" value={note} maxLength={AGENDA_NOTE_MAX} onChange={(e) => setNote(e.target.value)} autoFocus rows={3} />
          </div>
          {mode === "cancel" && item.seriesId && (
            <fieldset className="flex flex-col gap-1">
              <legend className="mb-1 text-sm font-medium text-slate-300">Dit is onderdeel van een reeks</legend>
              {(
                [
                  ["this", "Alleen deze afspraak"],
                  ["following", "Deze en alle volgende"],
                  ["all", "Hele reeks"],
                ] as const
              ).map(([value, label]) => (
                <label key={value} className="flex min-h-10 items-center gap-2.5 text-sm text-slate-300">
                  <input type="radio" name="cancel-scope" checked={scope === value} onChange={() => setScope(value)} className="h-4 w-4 accent-rose-400" />
                  {label}
                </label>
              ))}
            </fieldset>
          )}
          <div className="flex gap-2">
            <Button type="submit" loading={busy} variant={mode === "cancel" ? "danger" : "primary"}>
              {mode === "done" ? "Afronden" : "Afspraak annuleren"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setMode("view")}>
              Terug
            </Button>
          </div>
        </form>
      )}

      {mode === "delete" && (
        <div className="flex flex-col gap-2">
          <p className="mb-2 text-sm text-slate-400">
            &ldquo;{item.title}&rdquo; is onderdeel van een reeks. Wat wil je verwijderen? Hierdoor verdwijnt ook de geschiedenis. Annuleren bewaart die wel.
          </p>
          <Button variant="outline" disabled={busy} onClick={() => void remove("this")}>
            Alleen deze afspraak
          </Button>
          <Button variant="outline" disabled={busy} onClick={() => void remove("following")}>
            Deze en alle volgende
          </Button>
          <Button variant="danger" disabled={busy} onClick={() => void remove("all")}>
            Hele reeks
          </Button>
          <Button variant="ghost" onClick={() => setMode("view")}>
            Terug
          </Button>
        </div>
      )}
    </Modal>
  );
}
