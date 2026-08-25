import Link from "next/link";
import {
  FileText,
  Pill,
  UserCheck,
  ArrowLeftRight,
  CheckSquare,
  Calendar,
  Users,
  Clock,
} from "lucide-react";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { startOfToday, formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

async function getStats() {
  const today = startOfToday();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const weekEnd = new Date(today);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const [activeClients, openTodos, presentToday, upcomingAppointments, activeHandovers] =
    await Promise.all([
      db.client.count({ where: { active: true } }),
      db.todo.count({ where: { completed: false } }),
      db.presence.count({ where: { date: { gte: today, lt: tomorrow }, present: true } }),
      db.appointment.count({ where: { startAt: { gte: today, lt: weekEnd } } }),
      db.handover.count({ where: { expiresAt: { gt: new Date() } } }),
    ]);

  return { activeClients, openTodos, presentToday, upcomingAppointments, activeHandovers };
}

const QUICK_ACTIONS = [
  { href: "/rapportage", label: "Nieuwe rapportage", icon: FileText, variant: "sky" },
  { href: "/medicatie", label: "Medicatie afvinken", icon: Pill, variant: "emerald" },
  { href: "/aanwezigheid", label: "Aanwezigheid", icon: UserCheck, variant: "sky" },
  { href: "/overdracht", label: "Overdracht", icon: ArrowLeftRight, variant: "emerald" },
  { href: "/todos", label: "To-Do toevoegen", icon: CheckSquare, variant: "sky" },
  { href: "/agenda", label: "Afspraak plannen", icon: Calendar, variant: "emerald" },
] as const;

export default async function DashboardPage() {
  const session = await getSession();
  const stats = await getStats();
  const recentHandovers = await db.handover.findMany({
    where: { expiresAt: { gt: new Date() } },
    include: { user: true },
    orderBy: { createdAt: "desc" },
    take: 3,
  });

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-50">Welkom, {session?.name}</h1>
        <p className="mt-1 text-slate-400">Hier is het overzicht van vandaag.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard icon={Users} label="Actieve cliënten" value={stats.activeClients} />
        <StatCard icon={CheckSquare} label="Open to-do's" value={stats.openTodos} />
        <StatCard icon={UserCheck} label="Aanwezig vandaag" value={stats.presentToday} />
        <StatCard icon={Calendar} label="Afspraken (7 dagen)" value={stats.upcomingAppointments} />
        <StatCard icon={ArrowLeftRight} label="Actieve overdrachten" value={stats.activeHandovers} />
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold text-slate-100">Snelle acties</h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          {QUICK_ACTIONS.map((action) => {
            const Icon = action.icon;
            return (
              <Link key={action.href} href={action.href}>
                <Card className="h-full transition-colors hover:border-sky-500/50 hover:bg-surface2">
                  <CardContent className="flex items-center gap-4 p-5">
                    <div
                      className={
                        action.variant === "sky"
                          ? "flex h-12 w-12 items-center justify-center rounded-xl bg-sky-500/15 text-sky-400"
                          : "flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400"
                      }
                    >
                      <Icon className="h-6 w-6" />
                    </div>
                    <span className="font-medium text-slate-100">{action.label}</span>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold text-slate-100">Recente overdracht</h2>
        {recentHandovers.length === 0 ? (
          <p className="text-slate-500">Geen actieve overdrachtnotities.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {recentHandovers.map((h) => (
              <Card key={h.id}>
                <CardContent className="flex flex-col gap-1 p-5">
                  <div className="flex items-center gap-2 text-sm text-slate-400">
                    <Clock className="h-4 w-4" />
                    {formatDateTime(h.createdAt)} &middot; {h.user.name}
                  </div>
                  <p className="text-slate-200">{h.content}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-slate-400">{label}</CardTitle>
        <Icon className="h-5 w-5 text-slate-500" />
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold text-slate-50">{value}</div>
      </CardContent>
    </Card>
  );
}
