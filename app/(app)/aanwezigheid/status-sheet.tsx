"use client";

import * as React from "react";
import { AlertTriangle } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { ABSENT_REASONS, PRESENCE_MAX_COMMENT, PRESENCE_STATUS_META, type PresenceStatusKey } from "@/lib/presence-shared";
import { STATUS_ICON, STATUS_STYLE, formatWhen, returnPresets, toLocalInput } from "./presence-ui";

export type SheetValue = { status: PresenceStatusKey; expectedReturnAt: string | null; comment: string };
/** `status: null` = nothing preselected, the user must pick a reason (marking someone absent). */
export type SheetInitial = Omit<SheetValue, "status"> & { status: PresenceStatusKey | null };

const OPTIONS: PresenceStatusKey[] = ["AANWEZIG", ...ABSENT_REASONS];

/**
 * One sheet for every change that needs more than a tap: pick the reason,
 * optionally when the client is expected back, optionally a short remark.
 * Bottom sheet on phones (see Modal). Used for a single client and, with
 * `allowMissing` off, for a whole selection.
 */
export function StatusSheet({
  open,
  onClose,
  title,
  initial,
  allowMissing,
  saving,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  initial: SheetInitial;
  allowMissing: boolean;
  saving: boolean;
  onSubmit: (value: SheetValue) => void;
}) {
  const [status, setStatus] = React.useState<PresenceStatusKey | null>(initial.status);
  const [returnLocal, setReturnLocal] = React.useState("");
  const [comment, setComment] = React.useState("");
  const [confirmMissing, setConfirmMissing] = React.useState(false);

  // Re-initialise only when the sheet opens: the board refreshes itself every
  // few seconds and must never wipe what somebody is in the middle of typing.
  const initialRef = React.useRef(initial);
  initialRef.current = initial;
  React.useEffect(() => {
    if (!open) return;
    const start = initialRef.current;
    setStatus(start.status);
    setReturnLocal(start.expectedReturnAt ? toLocalInput(new Date(start.expectedReturnAt)) : "");
    setComment(start.comment);
    setConfirmMissing(false);
  }, [open]);

  const presets = React.useMemo(() => returnPresets(), [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const planned = status !== null && status !== "AANWEZIG" && status !== "VERMIST";
  const returnDate = returnLocal ? new Date(returnLocal) : null;
  const returnInvalid = planned && returnDate !== null && (Number.isNaN(returnDate.getTime()) || returnDate.getTime() < Date.now() - 10 * 60_000);
  const canSave = status !== null && !returnInvalid && (status !== "VERMIST" || confirmMissing) && comment.length <= PRESENCE_MAX_COMMENT;

  function submit() {
    if (!canSave || saving || !status) return;
    onSubmit({
      status,
      expectedReturnAt: planned && returnDate ? returnDate.toISOString() : null,
      comment: comment.trim(),
    });
  }

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div
        className="flex flex-col gap-5"
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit();
        }}
      >
        <div role="radiogroup" aria-label="Status" className="grid grid-cols-2 gap-2">
          {OPTIONS.map((key) => {
            const Icon = STATUS_ICON[key];
            const active = status === key;
            return (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setStatus(key)}
                className={cn(
                  "flex min-h-[3.25rem] items-center gap-2.5 rounded-xl border px-3 py-2 text-left text-sm transition-colors",
                  active ? "border-rose-400/70 bg-rose-500/10 text-slate-50" : "border-border bg-surface2 text-slate-300 hover:border-slate-500/60"
                )}
              >
                <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", STATUS_STYLE[key].chip)}>
                  <Icon className="h-4 w-4" />
                </span>
                <span className="font-medium leading-tight">{PRESENCE_STATUS_META[key].label}</span>
              </button>
            );
          })}
          {allowMissing && (
            <button
              type="button"
              role="radio"
              aria-checked={status === "VERMIST"}
              onClick={() => setStatus("VERMIST")}
              className={cn(
                "col-span-2 flex min-h-[3.25rem] items-center gap-2.5 rounded-xl border px-3 py-2 text-left text-sm transition-colors",
                status === "VERMIST" ? "border-red-500 bg-red-500/15 text-slate-50" : "border-red-500/30 bg-surface2 text-red-400 hover:border-red-500/60"
              )}
            >
              <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", STATUS_STYLE.VERMIST.chip)}>
                <AlertTriangle className="h-4 w-4" />
              </span>
              <span className="font-medium leading-tight">Vermist melden</span>
            </button>
          )}
        </div>

        {status === "VERMIST" && (
          <div className="flex flex-col gap-3 rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-slate-200">
            <p>
              Alle collega&apos;s krijgen direct een melding en de cliënt staat bovenaan het bord tot hij of zij weer is teruggevonden. Volg daarnaast het
              vermissingsprotocol van jullie organisatie.
            </p>
            <Checkbox checked={confirmMissing} onChange={setConfirmMissing} className="text-sm text-slate-100">
              Ja, deze cliënt is onverwacht weg of niet teruggekeerd.
            </Checkbox>
          </div>
        )}

        {planned && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="pr-return">Wanneer terug? (optioneel)</Label>
            <div className="flex flex-wrap gap-2">
              {presets.map((p) => {
                const active = returnLocal === toLocalInput(p.at);
                return (
                  <button
                    key={p.key}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setReturnLocal(active ? "" : toLocalInput(p.at))}
                    className={cn(
                      "min-h-[2.5rem] rounded-full border px-3.5 text-sm transition-colors",
                      active ? "border-rose-400/70 bg-rose-500/10 text-slate-50" : "border-border bg-surface2 text-slate-300 hover:border-slate-500/60"
                    )}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
            <input
              id="pr-return"
              type="datetime-local"
              value={returnLocal}
              min={toLocalInput(new Date())}
              onChange={(e) => setReturnLocal(e.target.value)}
              className="h-12 w-full rounded-xl border border-border bg-surface2 px-4 text-base text-slate-100 focus-visible:border-rose-400/60 focus-visible:outline-none"
            />
            {returnDate && !returnInvalid && <p className="text-xs text-slate-400">Terug verwacht: {formatWhen(returnDate.toISOString())}. Zonder terugkomst binnen een kwartier daarna krijgt de kaart een waarschuwing.</p>}
            {returnInvalid && <p className="text-xs text-red-400">Kies een tijdstip dat niet in het verleden ligt.</p>}
          </div>
        )}

        <div className="flex flex-col gap-2">
          <Label htmlFor="pr-comment">Toelichting (optioneel)</Label>
          <Textarea
            id="pr-comment"
            value={comment}
            maxLength={PRESENCE_MAX_COMMENT}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Bijv. wordt opgehaald door moeder"
            className="min-h-[88px]"
          />
          <div className="flex items-start justify-end gap-3 text-xs">
            <span className="shrink-0 text-slate-500">
              {comment.length}/{PRESENCE_MAX_COMMENT}
            </span>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" onClick={onClose}>
            Annuleren
          </Button>
          <Button type="button" variant={status === "VERMIST" ? "danger" : "primary"} loading={saving} disabled={!canSave} onClick={submit}>
            {status === "VERMIST" ? "Vermist melden" : status === "AANWEZIG" ? "Als aanwezig opslaan" : "Opslaan"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
