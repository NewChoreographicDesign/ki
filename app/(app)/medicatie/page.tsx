import Link from "next/link";
import { Pill, ChevronRight } from "lucide-react";
import { db } from "@/lib/db";
import { fullName } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function MedicatiePage() {
  const clients = await db.client.findMany({
    where: { active: true },
    orderBy: { firstName: "asc" },
    include: { medications: { where: { active: true } } },
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-50">Medicatie</h1>
        <p className="mt-1 text-slate-400">Kies een cliënt om medicatie af te vinken.</p>
      </div>

      <div className="flex flex-col gap-3">
        {clients.map((client) => (
          <Link key={client.id} href={`/medicatie/${client.id}`}>
            <Card className="transition-colors hover:border-sky-500/50 hover:bg-surface2">
              <CardContent className="flex items-center justify-between gap-4 p-5">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400">
                    <Pill className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="font-medium text-slate-100">{fullName(client)}</p>
                    <Badge variant="slate">{client.medications.length} actieve medicatie(s)</Badge>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-slate-500" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
