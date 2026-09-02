"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  Pill,
  UserCheck,
  ArrowLeftRight,
  CheckSquare,
  Calendar,
  ShieldCheck,
  Settings,
  Download,
  Menu,
  X,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  backendOnly?: boolean;
  weeklyReportOnly?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Overzicht", icon: LayoutDashboard },
  { href: "/rapportage", label: "Rapportage", icon: FileText },
  { href: "/medicatie", label: "Medicatie", icon: Pill },
  { href: "/aanwezigheid", label: "Aanwezigheid", icon: UserCheck },
  { href: "/overdracht", label: "Overdracht", icon: ArrowLeftRight },
  { href: "/todos", label: "To-Do's", icon: CheckSquare },
  { href: "/agenda", label: "Agenda", icon: Calendar },
  { href: "/protocollen", label: "Protocollen", icon: ShieldCheck },
  { href: "/weekrapport", label: "Weekrapport", icon: Download, weeklyReportOnly: true },
  { href: "/backend", label: "Backend", icon: Settings, backendOnly: true },
];

export function AppNav({
  userName,
  canAccessBackend,
  canAccessWeeklyReport,
}: {
  userName: string;
  canAccessBackend: boolean;
  canAccessWeeklyReport: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = React.useState(false);

  const items = NAV_ITEMS.filter(
    (item) =>
      (!item.backendOnly || canAccessBackend) && (!item.weeklyReportOnly || canAccessWeeklyReport)
  );

  async function handleLogout() {
    const res = await fetch("/api/auth/logout", { method: "POST" });
    if (res.ok) {
      toast.success("Uitgelogd");
      router.push("/login");
      router.refresh();
    } else {
      toast.error("Uitloggen mislukt");
    }
  }

  const NavList = (
    <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(item.href + "/");
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setOpen(false)}
            className={cn(
              "flex items-center gap-3 rounded-xl px-4 py-3.5 text-sm font-medium transition-colors",
              active
                ? "bg-sky-500/15 text-sky-400"
                : "text-slate-300 hover:bg-surface2 hover:text-slate-100"
            )}
          >
            <Icon className="h-5 w-5 shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <>
      {/* Mobile / iPad top bar */}
      <div className="flex items-center justify-between border-b border-border bg-surface px-4 py-3 lg:hidden">
        <button
          aria-label="Menu"
          onClick={() => setOpen(true)}
          className="flex h-11 w-11 items-center justify-center rounded-xl hover:bg-surface2"
        >
          <Menu className="h-6 w-6" />
        </button>
        <span className="text-base font-semibold">Woongroep Admin</span>
        <div className="w-11" />
      </div>

      {/* Overlay for iPad / mobile */}
      {open && (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <div className="relative z-50 flex h-full w-80 max-w-[85vw] flex-col bg-surface">
            <div className="flex items-center justify-between p-4">
              <span className="text-lg font-semibold">Woongroep Admin</span>
              <button
                aria-label="Sluiten"
                onClick={() => setOpen(false)}
                className="flex h-11 w-11 items-center justify-center rounded-xl hover:bg-surface2"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            {NavList}
            <UserFooter userName={userName} onLogout={handleLogout} />
          </div>
        </div>
      )}

      {/* Desktop / iPad landscape sidebar */}
      <aside className="hidden w-72 shrink-0 flex-col border-r border-border bg-surface lg:flex">
        <div className="p-5">
          <span className="text-lg font-semibold">Woongroep Admin</span>
        </div>
        {NavList}
        <UserFooter userName={userName} onLogout={handleLogout} />
      </aside>
    </>
  );
}

function UserFooter({ userName, onLogout }: { userName: string; onLogout: () => void }) {
  return (
    <div className="border-t border-border p-3">
      <div className="flex items-center justify-between gap-2 rounded-xl px-3 py-2">
        <span className="truncate text-sm text-slate-300">{userName}</span>
        <Button variant="ghost" size="icon" onClick={onLogout} aria-label="Uitloggen">
          <LogOut className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}
