import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { regenerateRecurringTodos } from "@/lib/recurring-todos";
import { loadTodoBoard, loadTodoClients } from "@/lib/todos";
import { loadAllowanceBoard } from "@/lib/allowances";
import { WerklijstShell } from "./werklijst-shell";

export const dynamic = "force-dynamic";

export default async function TodosPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  // Cheap idempotent check on every load rather than a cron — see
  // lib/recurring-todos.ts for why a once-a-week (or even once-a-day) cron
  // can't correctly time a task that recurs on an arbitrary set of days.
  await regenerateRecurringTodos();

  // Personal to-do's (assigned to one specific medewerker) are not part of the
  // shared list: they live on the Dashboard's "Mijn taken" and in Taken toewijzen.
  const [board, clients, allowanceBoard] = await Promise.all([loadTodoBoard(), loadTodoClients(), loadAllowanceBoard()]);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold text-slate-50">Werklijst</h1>
        <p className="mt-1 text-slate-400">De gedeelde takenlijst. Iedereen ziet wijzigingen direct.</p>
      </div>
      <WerklijstShell
        initialOpen={board.open}
        initialCompleted={board.completed}
        serverNow={Date.now()}
        todoClients={clients}
        viewerId={session.sub}
        canSupervise={session.role === Role.ADMIN || session.role === Role.COORDINATOR}
        initialActive={allowanceBoard.active}
        initialCompletedToday={allowanceBoard.completedToday}
        allowanceClients={clients}
      />
    </div>
  );
}
