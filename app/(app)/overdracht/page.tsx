import { Clock } from "lucide-react";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { HandoverForm } from "./handover-form";

export const dynamic = "force-dynamic";

export default async function OverdrachtPage() {
  const handovers = await db.handover.findMany({
    where: { expiresAt: { gt: new Date() } },
    include: { user: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-50">Overdracht</h1>
        <p className="mt-1 text-slate-400">
          Notities worden automatisch gewist 1 uur na het einde van de dienst.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Nieuwe overdracht</CardTitle>
        </CardHeader>
        <CardContent>
          <HandoverForm />
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3">
        {handovers.length === 0 ? (
          <p className="text-slate-500">Geen actieve overdrachtnotities.</p>
        ) : (
          handovers.map((h) => (
            <Card key={h.id}>
              <CardContent className="flex flex-col gap-2 p-5">
                <div className="flex flex-wrap items-center gap-2 text-sm text-slate-400">
                  <Badge variant={h.shift === "MORNING" ? "sky" : "emerald"}>
                    {h.shift === "MORNING" ? "Ochtend" : "Avond"}
                  </Badge>
                  <span>{h.user.name}</span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {formatDateTime(h.createdAt)}
                  </span>
                  <span className="text-slate-600">
                    verloopt {formatDateTime(h.expiresAt)}
                  </span>
                </div>
                <p className="whitespace-pre-wrap text-slate-200">{h.content}</p>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
