import { redirect } from "next/navigation";
import { getSession, canAccessBackend, canAccessWeeklyReport } from "@/lib/auth";
import { AppNav } from "@/components/app-nav";
import { IdleLogout } from "@/components/idle-logout";
import { ReminderWatcher } from "@/components/reminder-watcher";
import { RouteTransition } from "@/components/route-transition";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <IdleLogout />
      <ReminderWatcher />
      <AppNav
        userName={session.name}
        canAccessBackend={canAccessBackend(session.role)}
        canAccessWeeklyReport={canAccessWeeklyReport(session.role)}
      />
      <div className="flex min-h-screen flex-1 flex-col">
        <main className="relative flex-1 p-4 lg:p-8">
          <RouteTransition>{children}</RouteTransition>
        </main>
      </div>
    </div>
  );
}
