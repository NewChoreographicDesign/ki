"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MessageSquarePlus, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { formatBirthDateInput } from "@/lib/format-birthdate-input";
import { formatDateTime } from "@/lib/utils";

type CheckStatus = "TAKEN" | "LEAVE" | "NOT_TAKEN";

export type MedicationCheckRow = {
  id: string;
  status: CheckStatus;
  comment: string | null;
  checkedAt: string;
  userName: string;
};

const STATUS_LABELS: Record<CheckStatus, { label: string; variant: "emerald" | "amber" | "red" }> = {
  TAKEN: { label: "Afgevinkt", variant: "emerald" },
  LEAVE: { label: "Verlof", variant: "amber" },
  NOT_TAKEN: { label: "Niet ingenomen", variant: "red" },
};

const STATUS_SELECT_OPTIONS: { value: CheckStatus; label: string }[] = [
  { value: "TAKEN", label: "Afgevinkt" },
  { value: "LEAVE", label: "Verlof" },
  { value: "NOT_TAKEN", label: "Niet ingenomen" },
];

// Regular staff can flag a mistaken tap with a comment (see the row's own
// "+ Commentaar" control) but can never touch the status or remove a check
// themselves — only an admin can correct it, and only via the modal below,
// which re-asks for their own birthdate before anything changes.
export function MedicationCheckList({ checks, canManage }: { checks: MedicationCheckRow[]; canManage: boolean }) {
  const [rows, setRows] = React.useState(checks);

  React.useEffect(() => setRows(checks), [checks]);

  function updateRow(id: string, patch: Partial<MedicationCheckRow>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }
  function removeRow(id: string) {
    setRows((prev) => prev.filter((r) => r.id !== id));
  }

  if (rows.length === 0) {
    return <p className="text-sm text-slate-500">Nog niets geregistreerd deze week.</p>;
  }

  return (
    <ul className="flex flex-col gap-2">
      {rows.map((check) => (
        <MedicationCheckRowItem
          key={check.id}
          check={check}
          canManage={canManage}
          onCommentSaved={(comment) => updateRow(check.id, { comment })}
          onStatusChanged={(status) => updateRow(check.id, { status })}
          onReset={() => removeRow(check.id)}
        />
      ))}
    </ul>
  );
}

function MedicationCheckRowItem({
  check,
  canManage,
  onCommentSaved,
  onStatusChanged,
  onReset,
}: {
  check: MedicationCheckRow;
  canManage: boolean;
  onCommentSaved: (comment: string | null) => void;
  onStatusChanged: (status: CheckStatus) => void;
  onReset: () => void;
}) {
  const [editingComment, setEditingComment] = React.useState(false);
  const [comment, setComment] = React.useState(check.comment ?? "");
  const [savingComment, setSavingComment] = React.useState(false);
  const [showAdminModal, setShowAdminModal] = React.useState(false);
  const status = STATUS_LABELS[check.status];

  async function saveComment() {
    setSavingComment(true);
    try {
      const res = await fetch(`/api/medication-checks/${check.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comment }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Opslaan mislukt");
        return;
      }
      toast.success("Commentaar opgeslagen");
      onCommentSaved(comment || null);
      setEditingComment(false);
    } catch {
      toast.error("Er is iets misgegaan");
    } finally {
      setSavingComment(false);
    }
  }

  return (
    <li className="flex flex-col gap-1.5 rounded-xl border border-border bg-surface2/50 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-400">
          <Badge variant={status.variant}>{status.label}</Badge>
          <span>{formatDateTime(new Date(check.checkedAt))}</span>
          <span>&middot; {check.userName}</span>
        </div>
        <div className="flex items-center gap-1">
          {!editingComment && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setEditingComment(true)}
              className="gap-1.5 text-slate-400"
            >
              <MessageSquarePlus className="h-4 w-4" /> {check.comment ? "Bewerk commentaar" : "+ Commentaar"}
            </Button>
          )}
          {canManage && (
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setShowAdminModal(true)}
              aria-label="Registratie aanpassen"
            >
              <Pencil className="h-4 w-4 text-slate-400" />
            </Button>
          )}
        </div>
      </div>
      {check.comment && !editingComment && <p className="text-sm text-slate-300">{check.comment}</p>}
      {editingComment && (
        <div className="flex flex-col gap-2">
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Bijv. per ongeluk verkeerde knop geraakt..."
            className="min-h-[70px]"
            autoFocus
          />
          <div className="flex gap-2">
            <Button size="sm" loading={savingComment} onClick={saveComment} className="self-start">
              Opslaan
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setComment(check.comment ?? "");
                setEditingComment(false);
              }}
            >
              Annuleren
            </Button>
          </div>
        </div>
      )}
      {showAdminModal && (
        <AdminCorrectionModal
          check={check}
          onClose={() => setShowAdminModal(false)}
          onStatusChanged={onStatusChanged}
          onReset={onReset}
        />
      )}
    </li>
  );
}

function AdminCorrectionModal({
  check,
  onClose,
  onStatusChanged,
  onReset,
}: {
  check: MedicationCheckRow;
  onClose: () => void;
  onStatusChanged: (status: CheckStatus) => void;
  onReset: () => void;
}) {
  const router = useRouter();
  const [status, setStatus] = React.useState<CheckStatus>(check.status);
  const [birthDate, setBirthDate] = React.useState("");
  const [savingStatus, setSavingStatus] = React.useState(false);
  const [resetting, setResetting] = React.useState(false);
  const [confirmingReset, setConfirmingReset] = React.useState(false);

  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  async function handleStatusChange(e: React.FormEvent) {
    e.preventDefault();
    setSavingStatus(true);
    try {
      const res = await fetch(`/api/medication-checks/${check.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, birthDate }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Wijzigen mislukt");
        return;
      }
      toast.success("Status gewijzigd");
      onStatusChanged(status);
      router.refresh();
      onClose();
    } catch {
      toast.error("Er is iets misgegaan");
    } finally {
      setSavingStatus(false);
    }
  }

  async function handleReset() {
    setResetting(true);
    try {
      const res = await fetch(`/api/medication-checks/${check.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ birthDate }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Resetten mislukt");
        return;
      }
      toast.success("Registratie verwijderd — de tijd staat weer open");
      onReset();
      router.refresh();
      onClose();
    } catch {
      toast.error("Er is iets misgegaan");
    } finally {
      setResetting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        aria-hidden="true"
        className="absolute inset-0 animate-fade-in bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-check-modal-title"
        className="relative z-10 w-full max-w-md animate-scale-in rounded-2xl border border-border bg-surface p-6 shadow-lift"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Sluiten"
          className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-surface2 hover:text-slate-100"
        >
          <X className="h-5 w-5" />
        </button>
        <h2 id="admin-check-modal-title" className="text-lg font-semibold text-slate-50">
          Registratie aanpassen
        </h2>
        <p className="mt-1 text-sm text-slate-400">
          Alleen voor het herstellen van een foutieve registratie. Vul je eigen geboortedatum in ter
          bevestiging.
        </p>
        <form onSubmit={handleStatusChange} className="mt-4 flex flex-col gap-4">
          <div>
            <Label htmlFor="admin-check-status">Nieuwe status</Label>
            <Select id="admin-check-status" value={status} onChange={(e) => setStatus(e.target.value as CheckStatus)}>
              {STATUS_SELECT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="admin-check-birthdate">Jouw geboortedatum</Label>
            <Input
              id="admin-check-birthdate"
              type="password"
              inputMode="numeric"
              autoComplete="current-password"
              placeholder="DD-MM-JJJJ"
              value={birthDate}
              onChange={(e) => setBirthDate(formatBirthDateInput(e.target.value))}
              maxLength={10}
              required
            />
          </div>
          <Button type="submit" loading={savingStatus} disabled={birthDate.length !== 10}>
            Status wijzigen
          </Button>
        </form>
        <div className="mt-4 border-t border-border pt-4">
          {!confirmingReset ? (
            <Button variant="ghost" className="text-red-400 hover:text-red-300" onClick={() => setConfirmingReset(true)}>
              Registratie verwijderen (reset)
            </Button>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-slate-400">
                Verwijdert deze registratie volledig — de tijd staat daarna weer open om opnieuw te
                registreren.
              </p>
              <div className="flex gap-2">
                <Button variant="danger" loading={resetting} disabled={birthDate.length !== 10} onClick={handleReset}>
                  Ja, verwijderen
                </Button>
                <Button variant="ghost" onClick={() => setConfirmingReset(false)}>
                  Annuleren
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
