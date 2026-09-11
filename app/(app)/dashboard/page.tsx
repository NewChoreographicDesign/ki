import Link from "next/link";
import {
  FileText,
  Pill,
  UserCheck,
  ArrowLeftRight,
  CheckSquare,
  Calendar,
  DoorOpen,
  ExternalLink,
} from "lucide-react";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { startOfToday, todayDayOfWeek, formatTime, fullName, cn } from "@/lib/utils";
import { RecentHandovers } from "./recent-handovers";

export const dynamic = "force-dynamic";

// A single scheduled item for the "today per room" overview — either a
// weekplan block or an agenda appointment, normalized to one shape so both
// can be sorted together on a single timeline per room.
type RoomEntry = { sortMinutes: number; time: string; label: string; clientName: string; comment?: string };

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
      comment: appt.description || undefined,
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
  const [latestPresences, upcomingAppointments] = await Promise.all([
    db.presence.findMany({ orderBy: { date: "desc" }, distinct: ["clientId"], select: { present: true } }),
    db.appointment.count({ where: { startAt: { gte: today, lt: weekEnd } } }),
  ]);
  const presentNow = latestPresences.filter((p) => p.present).length;

  return { presentNow, upcomingAppointments };
}

const QUICK_ACTIONS = [
  { href: "/rapportage", label: "Nieuwe rapportage", icon: FileText, variant: "sky" },
  { href: "/medicatie", label: "Medicatie afvinken", icon: Pill, variant: "emerald" },
  { href: "/aanwezigheid", label: "Aanwezigheid", icon: UserCheck, variant: "sky" },
  { href: "/overdracht", label: "Overdracht", icon: ArrowLeftRight, variant: "emerald" },
  { href: "/todos", label: "Werklijst", icon: CheckSquare, variant: "sky" },
  { href: "/agenda", label: "Afspraak plannen", icon: Calendar, variant: "emerald" },
  {
    href: "https://mijnidb.sharepoint.com",
    label: "Mijn IDB",
    icon: ExternalLink,
    variant: "sky",
    external: true,
  },
] as const;

export default async function DashboardPage() {
  const session = await getSession();
  const [stats, roomsToday, rawHandovers] = await Promise.all([
    getStats(),
    getTodayByRoom(),
    db.handover.findMany({
      include: { user: true, client: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  // One entry per room — the most recent note in it — rather than every
  // handover, so a room that's had several updates doesn't crowd out rooms
  // that haven't been touched in a while. rawHandovers is already newest
  // first, so the first hit per room is its most recent.
  const seenRooms = new Set<string>();
  const recentHandovers: ((typeof rawHandovers)[number] & { room: string })[] = [];
  for (const h of rawHandovers) {
    const room = h.client ? h.client.room || "Geen kamer" : "Algemeen";
    if (seenRooms.has(room)) continue;
    seenRooms.add(room);
    recentHandovers.push({ ...h, room });
  }

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
            {roomsToday.map(({ room, entries }, i) => (
              <Card key={room} className="animate-fade-in-up overflow-hidden" style={{ animationDelay: `${i * 50}ms` }}>
                <div className="flex items-center gap-3 bg-brand-gradient-soft p-4 ring-1 ring-inset ring-sky-400/20">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-500/15 text-sky-400">
                    <DoorOpen className="h-5 w-5" />
                  </span>
                  <span className="flex flex-col">
                    <span className="font-semibold text-slate-100">{room}</span>
                    <span className="text-xs text-slate-500">
                      {entries.length} item{entries.length === 1 ? "" : "s"}
                    </span>
                  </span>
                </div>
                <CardContent className="flex flex-col gap-2 pt-3">
                  {entries.map((entry, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-3 rounded-xl border border-border bg-surface2/50 p-3"
                    >
                      <Badge variant="slate" className="shrink-0">
                        {entry.time}
                      </Badge>
                      <div>
                        <p className="text-sm text-slate-200">{entry.label}</p>
                        {entry.clientName && <p className="text-xs text-slate-500">{entry.clientName}</p>}
                        {entry.comment && <p className="text-xs text-slate-500 italic">{entry.comment}</p>}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard icon={UserCheck} label="Nu aanwezig" value={stats.presentNow} delay={0} />
        <StatCard icon={Calendar} label="Afspraken (7 dagen)" value={stats.upcomingAppointments} delay={40} />
      </div>

      <RecentHandovers
        handovers={recentHandovers.map((h) => ({
          id: h.id,
          room: h.room,
          content: h.content,
          createdAt: h.createdAt.toISOString(),
          userName: h.user.name,
        }))}
      />

      <div>
        <h2 className="mb-3 text-lg font-semibold text-slate-100">Snelle acties</h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          {QUICK_ACTIONS.map((action, i) => {
            const Icon = action.icon;
            const content = (
              <CardContent className="flex items-center gap-4 p-5">
                <div
                  className={cn(
                    "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-105",
                    action.variant === "sky"
                      ? "bg-sky-500/15 text-sky-400"
                      : "bg-emerald-500/15 text-emerald-400"
                  )}
                >
                  <Icon className="h-6 w-6" />
                </div>
                <span className="font-medium text-slate-100">{action.label}</span>
              </CardContent>
            );
            return (
              <Link
                key={action.href}
                href={action.href}
                className="group"
                {...("external" in action && action.external
                  ? { target: "_blank", rel: "noreferrer noopener" }
                  : {})}
              >
                <Card interactive className="h-full animate-fade-in-up" style={{ animationDelay: `${i * 40}ms` }}>
                  {content}
                </Card>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  delay = 0,
  className,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  delay?: number;
  className?: string;
}) {
  return (
    <Card className={cn("animate-fade-in-up", className)} style={{ animationDelay: `${delay}ms` }}>
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
