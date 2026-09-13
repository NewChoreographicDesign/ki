// Deliberately NOT "use client" — this is imported directly by the server
// page (page.tsx, for the initial load) as well as client components
// (todo-form.tsx, todo-item.tsx), and a plain function export from a
// "use client" file can't be called from a Server Component at all (Next's
// RSC bundler rejects it at runtime, not just in the type system).
import { parseDaysOfWeek } from "@/lib/utils";

export type TodoData = {
  id: string;
  title: string;
  description: string | null;
  priority: "NONE" | "LOW" | "MEDIUM" | "HIGH";
  daysOfWeek: number[];
  time: string | null;
  recurring: boolean;
  completed: boolean;
  completedByName: string | null;
  completedAt: string | null;
  completionNote: string | null;
  createdByName: string;
  createdAt: string;
  /** Null = shared team task on the Werklijst; set = personal task for that medewerker. */
  assignedToId: string | null;
  assignedToName: string | null;
  /** Null/empty = "Algemeen". Only meaningful for personal tasks. */
  room: string | null;
};

type RawTodo = {
  id: string;
  title: string;
  description: string | null;
  priority: "NONE" | "LOW" | "MEDIUM" | "HIGH";
  daysOfWeek: string;
  time: string | null;
  recurring: boolean;
  completed: boolean;
  completedBy: { name: string } | null;
  completedAt: Date | string | null;
  completionNote: string | null;
  createdBy: { name: string };
  createdAt: Date | string;
  assignedToId?: string | null;
  assignedTo?: { name: string } | null;
  room?: string | null;
};

/** Shared by the server page (initial load) and the client board (optimistic updates from
 * API responses) so both produce the exact same shape. */
export function serializeTodo(todo: RawTodo): TodoData {
  return {
    id: todo.id,
    title: todo.title,
    description: todo.description,
    priority: todo.priority,
    daysOfWeek: parseDaysOfWeek(todo.daysOfWeek),
    time: todo.time,
    recurring: todo.recurring,
    completed: todo.completed,
    completedByName: todo.completedBy?.name ?? null,
    completedAt: todo.completedAt ? new Date(todo.completedAt).toISOString() : null,
    completionNote: todo.completionNote,
    createdByName: todo.createdBy.name,
    createdAt: new Date(todo.createdAt).toISOString(),
    assignedToId: todo.assignedToId ?? null,
    assignedToName: todo.assignedTo?.name ?? null,
    room: todo.room ?? null,
  };
}
