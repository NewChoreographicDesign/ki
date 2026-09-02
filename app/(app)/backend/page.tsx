import Link from "next/link";
import { Users, UserCog, Settings, Pill, CalendarRange, History } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const SECTIONS = [
  { href: "/backend/clients", label: "Cliënten", description: "Beheer cliëntgegevens", icon: Users },
  { href: "/backend/medewerkers", label: "Medewerkers", description: "Beheer accounts en rollen", icon: UserCog },
  { href: "/backend/medicatie", label: "Medicatie beheer", description: "Medicatie toevoegen per cliënt", icon: Pill },
  { href: "/backend/weekplanning", label: "Weekplanning", description: "Weekschema per cliënt", icon: CalendarRange },
  { href: "/backend/instellingen", label: "Instellingen", description: "Organisatie-instellingen", icon: Settings },
  { href: "/backend/audit", label: "Auditlog", description: "Wie deed wat, en wanneer", icon: History },
] as const;

export default function BackendPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-50">Backend</h1>
        <p className="mt-1 text-slate-400">
          Eén wijziging hier werkt overal in de app door.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SECTIONS.map((s) => {
          const Icon = s.icon;
          return (
            <Link key={s.href} href={s.href}>
              <Card className="h-full transition-colors hover:border-sky-500/50 hover:bg-surface2">
                <CardContent className="flex items-start gap-4 p-5">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-sky-500/15 text-sky-400">
                    <Icon className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="font-medium text-slate-100">{s.label}</p>
                    <p className="text-sm text-slate-400">{s.description}</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
