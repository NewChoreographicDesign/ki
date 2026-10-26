"use client";

import * as React from "react";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";
import { PRESENCE_STATUS_META, type PresenceHistory } from "@/lib/presence-shared";
import { STATUS_ICON, STATUS_STYLE, formatWhen } from "./presence-ui";

/**
 * The last 30 days for one client: a day strip (what the status was each day,
 * carried forward over days nobody touched it) and the change log (who set
 * what, when). Loaded on open and never cached on the client.
 */
export function HistorySheet({ clientId, title, onClose }: { clientId: string | null; title: string; onClose: () => void }) {
  const [history, setHistory] = React.useState<PresenceHistory | null>(null);
  const [error, setError] = React.useState(false);

  React.useEffect(() => {
    if (!clientId) return;
    let cancelled = false;
    setHistory(null);
    setError(false);
    fetch(`/api/presence/${clientId}/history`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: PresenceHistory) => !cancelled && setHistory(data))
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  const counts = React.useMemo(() => {
    const total = history?.days.filter((d) => d.status).length ?? 0;
    const present = history?.days.filter((d) => d.status === "AANWEZIG").length ?? 0;
    return { total, present };
  }, [history]);

  return (
    <Modal open={clientId !== null} onClose={onClose} title={`Geschiedenis — ${title}`}>
      {error && <p className="text-sm text-red-400">De geschiedenis kon niet worden geladen.</p>}
      {!error && !history && <p className="text-sm text-slate-400">Laden…</p>}
      {history && (
        <div className="flex flex-col gap-5">
          <section aria-label="Laatste 30 dagen">
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-200">Laatste 30 dagen</h3>
              <span className="text-xs text-slate-500">{counts.total > 0 ? `${counts.present} van ${counts.total} dagen in huis` : "Nog geen registraties"}</span>
            </div>
            <ol className="flex gap-[3px]" role="list">
              {history.days.map((d) => (
                <li
                  key={d.date}
                  title={`${d.date}: ${d.status ? PRESENCE_STATUS_META[d.status].label : "niet geregistreerd"}${d.derived && d.status ? " (doorgetrokken)" : ""}`}
                  className={cn("h-8 flex-1 rounded-[3px]", d.status ? STATUS_STYLE[d.status].bar : "bg-surface2", d.derived && d.status && "opacity-45")}
                >
                  <span className="sr-only">
                    {d.date}: {d.status ? PRESENCE_STATUS_META[d.status].label : "niet geregistreerd"}
                  </span>
                </li>
              ))}
            </ol>
            <p className="mt-2 text-xs text-slate-500">Lichtere blokken: die dag is niemand iets gaan registreren, de status van de dag ervoor geldt.</p>
          </section>

          <section aria-label="Wijzigingen">
            <h3 className="mb-2 text-sm font-semibold text-slate-200">Wijzigingen</h3>
            {history.events.length === 0 ? (
              <p className="text-sm text-slate-500">Geen wijzigingen in de afgelopen 30 dagen.</p>
            ) : (
              <ol className="flex flex-col gap-2">
                {history.events.map((e) => {
                  const Icon = STATUS_ICON[e.status];
                  return (
                    <li key={e.id} className="flex gap-3 rounded-xl border border-border bg-surface2/50 p-3">
                      <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", STATUS_STYLE[e.status].chip)}>
                        <Icon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1 text-sm">
                        <div className="font-medium text-slate-100">
                          {PRESENCE_STATUS_META[e.status].label}
                          {e.expectedReturnAt && <span className="font-normal text-slate-400"> · terug {formatWhen(e.expectedReturnAt, new Date(e.at).getTime())}</span>}
                        </div>
                        {e.comment && <p className="mt-0.5 break-words text-slate-300">{e.comment}</p>}
                        <div className="mt-1 text-xs text-slate-500">
                          {e.byName} · {formatWhen(e.at)}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
        </div>
      )}
    </Modal>
  );
}
