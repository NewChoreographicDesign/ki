"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

export type UserRow = {
  id: string;
  name: string;
  role: "ADMIN" | "COORDINATOR" | "EMPLOYEE";
  active: boolean;
};

const ROLE_LABEL = { ADMIN: "Admin", COORDINATOR: "Coördinator", EMPLOYEE: "Medewerker" } as const;

export function UserManager({ users, currentUserId }: { users: UserRow[]; currentUserId: string }) {
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [birthDate, setBirthDate] = React.useState("");
  const [role, setRole] = React.useState<UserRow["role"]>("EMPLOYEE");
  const [loading, setLoading] = React.useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/backend/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, birthDate, role }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Toevoegen mislukt");
        return;
      }
      toast.success("Medewerker toegevoegd");
      setName("");
      setBirthDate("");
      setRole("EMPLOYEE");
      router.refresh();
    } catch {
      toast.error("Er is iets misgegaan");
    } finally {
      setLoading(false);
    }
  }

  async function updateUser(id: string, patch: Partial<Pick<UserRow, "active" | "role">>) {
    try {
      const res = await fetch(`/api/backend/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error();
      toast.success("Bijgewerkt");
      router.refresh();
    } catch {
      toast.error("Bijwerken mislukt");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Nieuwe medewerker</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <Label htmlFor="name">Naam</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div>
                <Label htmlFor="birthDate">Geboortedatum</Label>
                <Input
                  id="birthDate"
                  placeholder="DD-MM-JJJJ"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="role">Rol</Label>
                <Select id="role" value={role} onChange={(e) => setRole(e.target.value as UserRow["role"])}>
                  <option value="EMPLOYEE">Medewerker</option>
                  <option value="COORDINATOR">Coördinator</option>
                  <option value="ADMIN">Admin</option>
                </Select>
              </div>
            </div>
            <Button type="submit" disabled={loading || !name || !birthDate} className="self-start">
              {loading ? "Toevoegen..." : "Toevoegen"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3">
        {users.map((u) => (
          <Card key={u.id}>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
              <div className="flex items-center gap-3">
                <span className="font-medium text-slate-100">{u.name}</span>
                <Badge variant={u.active ? "emerald" : "slate"}>{u.active ? "Actief" : "Inactief"}</Badge>
              </div>
              <div className="flex items-center gap-2">
                <Select
                  className="h-10 w-auto"
                  value={u.role}
                  disabled={u.id === currentUserId}
                  onChange={(e) => updateUser(u.id, { role: e.target.value as UserRow["role"] })}
                >
                  <option value="EMPLOYEE">Medewerker</option>
                  <option value="COORDINATOR">Coördinator</option>
                  <option value="ADMIN">Admin</option>
                </Select>
                <Button
                  size="sm"
                  variant={u.active ? "outline" : "secondary"}
                  disabled={u.id === currentUserId}
                  onClick={() => updateUser(u.id, { active: !u.active })}
                >
                  {u.active ? "Deactiveren" : "Activeren"}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <p className="text-xs text-slate-500">Label: {ROLE_LABEL.ADMIN} / {ROLE_LABEL.COORDINATOR} / {ROLE_LABEL.EMPLOYEE}</p>
    </div>
  );
}
