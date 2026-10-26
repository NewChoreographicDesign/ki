import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { listAgenda, loadAgendaEnv } from "@/lib/agenda";
import { amsterdamDate } from "@/lib/utils";
import { amsterdamNow, isValidISODate } from "@/lib/date-shared";
import { agendaRange, type AgendaViewKey as AgendaView } from "@/lib/agenda-shared";
import { AgendaApp } from "./agenda-app";

export const dynamic = "force-dynamic";

const VIEWS: AgendaView[] = ["lijst", "dag", "week", "maand"];

export default async function AgendaPage({ searchParams }: { searchParams: Promise<{ weergave?: string; datum?: string }> }) {
  const { weergave, datum } = await searchParams;
  const session = await getSession();
  if (!session) redirect("/login");

  const today = amsterdamNow().dateISO;
  // "kalender" was the old name of the calendar tab.
  const viewExplicit = VIEWS.includes(weergave as AgendaView) || weergave === "kalender";
  // The first thing you see is the whole agenda: the week.
  const view: AgendaView = VIEWS.includes(weergave as AgendaView) ? (weergave as AgendaView) : "week";
  const initialDate = datum && isValidISODate(datum) ? datum : null;

  const { from, to } = agendaRange(view, initialDate ?? today, today);
  const at = (ymd: string) => {
    const [y, m, d] = ymd.split("-").map(Number);
    return amsterdamDate(y, m, d);
  };
  const [items, env] = await Promise.all([listAgenda(at(from), at(to)), loadAgendaEnv()]);

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-semibold text-slate-50">Agenda</h1>
      <AgendaApp
        initialItems={items}
        initialRange={{ from, to }}
        serverNow={Date.now()}
        initialView={view}
        viewExplicit={viewExplicit}
        initialDate={initialDate}
        clients={env.clients}
        staff={env.staff}
        viewerId={session.sub}
        canSupervise={session.role === Role.ADMIN || session.role === Role.COORDINATOR}
      />
    </div>
  );
}
