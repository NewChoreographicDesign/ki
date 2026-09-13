import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSession, canAccessPersonalTodoAssignment } from "@/lib/auth";
import { serializeTodo } from "../todos/todo-types";
import { PersonalTodosManager } from "./personal-todos-manager";

export const dynamic = "force-dynamic";

// Admin/coordinator screen for pushing a personal to-do to a specific
// medewerker — separate from /backend (ADMIN-only, see middleware.ts) since
// coordinators need this too but shouldn't gain the rest of Backend along
// with it. See lib/auth.ts's canAccessPersonalTodoAssignment.
export default async function PersoonlijkeTakenPage() {
  const session = await getSession();
  if (!session || !canAccessPersonalTodoAssignment(session.role)) {
    redirect("/dashboard");
  }

  const [users, todos, roomRows] = await Promise.all([
    db.user.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    db.todo.findMany({
      where: { assignedToId: { not: null } },
      include: { createdBy: true, completedBy: true, assignedTo: true },
      orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    }),
    db.client.findMany({
      where: { active: true, room: { not: null } },
      distinct: ["room"],
      select: { room: true },
    }),
  ]);
  const rooms = roomRows.map((c) => c.room!).sort((a, b) => a.localeCompare(b));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-50">Taken toewijzen</h1>
        <p className="mt-1 text-slate-400">
          Persoonlijke taken per medewerker, los van de gedeelde Werklijst. Kies een medewerker om
          hun taken te bekijken of een nieuwe toe te voegen.
        </p>
      </div>
      <PersonalTodosManager users={users} initialTodos={todos.map(serializeTodo)} rooms={rooms} />
    </div>
  );
}
