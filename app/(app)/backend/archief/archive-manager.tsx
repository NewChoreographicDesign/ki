"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const ROLE_LABEL = { ADMIN: "Admin", COORDINATOR: "Coördinator", EMPLOYEE: "Medewerker" } as const;

type ArchivedUser = { id: string; name: string; role: keyof typeof ROLE_LABEL };
type ArchivedMedication = { id: string; name: string; dosage: string; times: string; clientName: string };

export function ArchiveManager({
  users,
  medications,
}: {
  users: ArchivedUser[];
  medications: ArchivedMedication[];
}) {
  const router = useRouter();
  const [loadingId, setLoadingId] = React.useState<string | null>(null);

  async function reactivateUser(id: string, name: string) {
    setLoadingId(id);
    try {
      const res = await fetch(`/api/backend/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: true }),
      });
      if (!res.ok) throw new Error();
      toast.success(`${name} geactiveerd`);
      router.refresh();
    } catch {
      toast.error("Activeren mislukt");
    } finally {
      setLoadingId(null);
    }
  }

  async function reactivateMedication(id: string, name: string) {
    setLoadingId(id);
    try {
      const res = await fetch(`/api/backend/medications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: true }),
      });
      if (!res.ok) throw new Error();
      toast.success(`${name} geactiveerd`);
      router.refresh();
    } catch {
      toast.error("Activeren mislukt");
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Medewerkers ({users.length})</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {users.length === 0 ? (
            <p className="text-sm text-slate-500">Geen gedeactiveerde medewerkers.</p>
          ) : (
            users.map((u) => (
              <div
                key={u.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface2/50 p-4"
              >
                <div className="flex items-center gap-3">
                  <span className="font-medium text-slate-100">{u.name}</span>
                  <Badge variant="slate">{ROLE_LABEL[u.role]}</Badge>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  loading={loadingId === u.id}
                  onClick={() => reactivateUser(u.id, u.name)}
                >
                  Activeren
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Medicatie ({medications.length})</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {medications.length === 0 ? (
            <p className="text-sm text-slate-500">Geen gedeactiveerde medicatie.</p>
          ) : (
            medications.map((m) => (
              <div
                key={m.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface2/50 p-4"
              >
                <div>
                  <p className="font-medium text-slate-100">
                    {m.name} &middot; {m.dosage}{" "}
                    <span className="text-sm text-slate-500">({m.clientName})</span>
                  </p>
                  <p className="text-sm text-slate-500">Tijden: {m.times}</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  loading={loadingId === m.id}
                  onClick={() => reactivateMedication(m.id, m.name)}
                >
                  Activeren
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
