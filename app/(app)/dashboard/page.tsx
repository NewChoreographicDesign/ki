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
  DoorOpen,
} from "lucide-react";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { startOfToday, todayDayOfWeek, formatDateTime, formatTime, fullName } from "@/lib/utils";

export const dynamic = "force-dynamic";

// A single scheduled item for the "today per room" overview — either a
// weekplan block or an agenda appointment, normalized to one shape so both
// can be sorted together on a single timeline per room.
type RoomEntry = { sortMinutes: number; time: string; label: string; clientName: string };

function parseHHMM(value: string): number {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}

async function getTodayByRoom() {
  const today = startOfToday();
  const tomorrow = new Date(today.getTime() + 24 * 3_600_000);
  const dayOfWeek = todayDayOfWeek();

  const [weekPlans, appointments] = await Promise.all([
    db.weekPlan.findMany({
      where: { dayOfWeek, client: { active: true } },
      include: { client: true },
    }),
    db.appointment.findMany({
      where: { startAt: { gte: today, lt: tomorrow } },
      include: { client: true },
    }),
  ]);

  const rooms = new Map<string, RoomEntry[]>();
  const addEntry = (room: string, entry: RoomEntry) => {
    const list = rooms.get(room);
    if (list) list.push(entry);
    else rooms.set(room, [entry]);
  };

  for (const wp of weekPlans) {
    addEntry(wp.client.room || "Geen kamer", {
      sortMinutes: parseHHMM(wp.startTime),
      time: `${wp.startTime}-${wp.endTime}`,
      label: wp.activity,
      clientName: fullName(wp.client),
    });
  }
  for (const appt of appointments) {
    const time = formatTime(appt.startAt);
    addEntry(appt.client ? appt.client.room || "Geen kamer" : "Algemeen", {
      sortMinutes: parseHHMM(time),
      time,
      label: `Afspraak: ${appt.title}`,
      clientName: appt.client ? fullName(appt.client) : "",
    });
  }

  // Real rooms first (alphabetically), then clients without a room, then
  // appointments with no client at all.
  const rank = (room: string) => (room === "Algemeen" ? 2 : room === "Geen kamer" ? 1 : 0);
  return Array.from(rooms.entries())
    .map(([room, entries]) => ({ room, entries: entries.sort((a, b) => a.sortMinutes - b.sortMinutes) }))
    .sort((a, b) => rank(a.room) - rank(b.room) || a.room.localeCompare(b.room));
}

async function getStats() {
  const today = startOfToday();
  const weekEnd = new Date(today);
  weekEnd.setDate(weekEnd.getDate() + 7);

  // Presence isn't scoped to "today" (see app/(app)/aanwezigheid/page.tsx) —
  // "present" here means each client's current status, i.e. whatever their
  // most recent presence row says, not just rows written today.
  const [activeClients, openTodos, latestPresences, upcomingAppointments, activeHandovers] =
    await Promise.all([
      db.client.count({ where: { active: true } }),
      db.todo.count({ where: { completed: false } }),
      db.presence.findMany({ orderBy: { date: "desc" }, distinct: ["clientId"], select: { present: true } }),
      db.appointment.count({ where: { startAt: { gte: today, lt: weekEnd } } }),
      db.handover.count({ where: { expiresAt: { gt: new Date() } } }),
    ]);
  const presentNow = latestPresences.filter((p) => p.present).length;

  return { activeClients, openTodos, presentNow, upcomingAppointments, activeHandovers };
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
  const [stats, roomsToday, recentHandovers] = await Promise.all([
    getStats(),
    getTodayByRoom(),
    db.handover.findMany({
      where: { expiresAt: { gt: new Date() } },
      include: { user: true },
      orderBy: { createdAt: "desc" },
      take: 3,
    }),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-50">Welkom, {session?.name}</h1>
        <p className="mt-1 text-slate-400">Hier is het overzicht van vandaag.</p>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold text-slate-100">Vandaag per kamer</h2>
        {roomsToday.length === 0 ? (
          <p className="text-slate-500">Geen weekplanning of afspraken voor vandaag.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {roomsToday.map(({ room, entries }) => (
              <Card key={room}>
                <CardHeader className="flex-row items-center gap-2 space-y-0 pb-2">
                  <DoorOpen className="h-5 w-5 text-slate-500" />
                  <CardTitle className="text-base font-semibold text-slate-100">{room}</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-2">
                  {entries.map((entry, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm">
                      <Badge variant="slate" className="shrink-0">
                        {entry.time}
                      </Badge>
                      <div>
                        <p className="text-slate-200">{entry.label}</p>
                        {entry.clientName && <p className="text-slate-500">{entry.clientName}</p>}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard icon={Users} label="Actieve cliënten" value={stats.activeClients} />
        <StatCard icon={CheckSquare} label="Open to-do's" value={stats.openTodos} />
        <StatCard icon={UserCheck} label="Nu aanwezig" value={stats.presentNow} />
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
