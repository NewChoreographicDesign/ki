"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { TodoForm } from "../todos/todo-form";
import { TodoItem } from "../todos/todo-item";
import { sortByTime } from "../todos/todo-board";
import type { TodoData } from "../todos/todo-types";

export function PersonalTodosManager({
  users,
  initialTodos,
}: {
  users: { id: string; name: string }[];
  initialTodos: TodoData[];
}) {
  const [todos, setTodos] = React.useState(initialTodos);
  const [selectedUserId, setSelectedUserId] = React.useState(users[0]?.id ?? "");
  const [formOpen, setFormOpen] = React.useState(false);

  // Shared by create, edit and complete — all three just replace-or-append
  // the one changed task in the flat list, keyed by the API response's id.
  function handleSaved(todo: TodoData) {
    setTodos((prev) => (prev.some((t) => t.id === todo.id) ? prev.map((t) => (t.id === todo.id ? todo : t)) : [...prev, todo]));
    setFormOpen(false);
  }

  function handleDelete(id: string) {
    setTodos((prev) => prev.filter((t) => t.id !== id));
  }

  if (users.length === 0) {
    return <p className="text-slate-500">Geen actieve medewerkers gevonden.</p>;
  }

  const forUser = todos.filter((t) => t.assignedToId === selectedUserId).sort(sortByTime);
  const open = forUser.filter((t) => !t.completed);
  const completed = forUser.filter((t) => t.completed).slice(0, 10);

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardContent className="flex flex-col gap-2 p-5 sm:max-w-xs">
          <Label htmlFor="employee">Medewerker</Label>
          <Select
            id="employee"
            value={selectedUserId}
            onChange={(e) => {
              setSelectedUserId(e.target.value);
              setFormOpen(false);
            }}
          >
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </Select>
        </CardContent>
      </Card>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-100">Openstaand ({open.length})</h2>
          {!formOpen && (
            <Button size="sm" variant="outline" onClick={() => setFormOpen(true)}>
              <Plus className="h-4 w-4" /> Nieuwe taak
            </Button>
          )}
        </div>

        {formOpen && (
          <Card className="mb-4">
            <CardHeader>
              <CardTitle>Nieuwe taak</CardTitle>
            </CardHeader>
            <CardContent>
              <TodoForm
                key={selectedUserId}
                showRoom
                fixedAssignedToId={selectedUserId}
                onSaved={handleSaved}
                onCancel={() => setFormOpen(false)}
              />
            </CardContent>
          </Card>
        )}

        {open.length === 0 ? (
          <p className="text-slate-500">Geen openstaande taken voor deze medewerker.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {open.map((t) => (
              <TodoItem
                key={t.id}
                todo={t}
                canManage
                onComplete={handleSaved}
                onUpdate={handleSaved}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>

      {completed.length > 0 && (
        <div>
          <h2 className="mb-3 text-lg font-semibold text-slate-100">Recent afgerond</h2>
          <div className="flex flex-col gap-3">
            {completed.map((t) => (
              <TodoItem key={t.id} todo={t} canManage onDelete={handleDelete} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
