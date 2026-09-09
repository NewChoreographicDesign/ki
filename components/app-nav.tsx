"use client";

import * as React from "react";
import Link, { useLinkStatus } from "next/link";
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
import { LogoMark } from "@/components/brand/logo";
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
  { href: "/aanwezigheid", label: "Aanwezigheid", icon: UserCheck },
  { href: "/medicatie", label: "Medicatie", icon: Pill },
  { href: "/todos", label: "To-Do's", icon: CheckSquare },
  { href: "/agenda", label: "Agenda", icon: Calendar },
  { href: "/overdracht", label: "Overdracht", icon: ArrowLeftRight },
  { href: "/protocollen", label: "Protocollen", icon: ShieldCheck },
  { href: "/rapportage", label: "Rapportage", icon: FileText },
  { href: "/weekrapport", label: "Weekrapport", icon: Download, weeklyReportOnly: true },
  { href: "/backend", label: "Backend", icon: Settings, backendOnly: true },
];

const MENU_TRANSITION_MS = 250;

// There's no route loading.tsx any more (see app/(app)/loading.tsx removal) —
// the previous page just stays put while the next one streams in, which
// reads as an instant, clean switch for the vast majority of navigations.
// This dot is the one bit of feedback that survives that change: a subtly
// pulsing marker on whichever nav item was just clicked, so a genuinely slow
// load (a cold serverless function, a slow query) never reads as the app
// having silently ignored the tap.
function NavPendingDot() {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return (
    <span
      aria-hidden="true"
      className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 animate-pop-in rounded-full bg-sky-400 shadow-glow-sky"
    />
  );
}

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
  const [mounted, setMounted] = React.useState(false);
  const [open, setOpen] = React.useState(false);

  const items = NAV_ITEMS.filter(
    (item) =>
      (!item.backendOnly || canAccessBackend) && (!item.weeklyReportOnly || canAccessWeeklyReport)
  );

  function openMenu() {
    setMounted(true);
    // Mount closed first, then flip to open on the next frame so the
    // opening state actually transitions instead of snapping in already-open.
    requestAnimationFrame(() => setOpen(true));
  }

  function closeMenu() {
    setOpen(false);
    setTimeout(() => setMounted(false), MENU_TRANSITION_MS);
  }

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

  return (
    <>
      {/* Mobile / iPad top bar */}
      <div className="flex items-center justify-between border-b border-border bg-surface px-4 py-3 md:hidden">
        <button
          aria-label="Menu"
          onClick={openMenu}
          className="flex h-11 w-11 items-center justify-center rounded-xl transition-colors hover:bg-surface2"
        >
          <Menu className="h-6 w-6" />
        </button>
        <LogoMark size="sm" />
        <div className="w-11" />
      </div>

      {/* Overlay for iPad / mobile */}
      {mounted && (
        <div className="fixed inset-0 z-40 flex md:hidden">
          <div
            className="absolute inset-0 bg-black/60 transition-opacity ease-out"
            style={{ opacity: open ? 1 : 0, transitionDuration: `${MENU_TRANSITION_MS}ms` }}
            onClick={closeMenu}
          />
          <div
            className="relative z-50 flex h-full w-80 max-w-[85vw] flex-col bg-surface shadow-lift transition-transform ease-out"
            style={{
              transform: open ? "translateX(0)" : "translateX(-100%)",
              transitionDuration: `${MENU_TRANSITION_MS}ms`,
            }}
          >
            <div className="flex items-center justify-between p-4">
              <LogoMark size="sm" />
              <button
                aria-label="Sluiten"
                onClick={closeMenu}
                className="flex h-11 w-11 items-center justify-center rounded-xl transition-colors hover:bg-surface2"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            <NavLinks items={items} pathname={pathname} onNavigate={closeMenu} />
            <UserFooter userName={userName} onLogout={handleLogout} onNavigate={closeMenu} />
          </div>
        </div>
      )}

      {/* Desktop / iPad landscape sidebar */}
      <aside className="hidden w-72 shrink-0 flex-col border-r border-border bg-surface md:flex">
        <div className="flex items-center gap-3 p-5">
          <LogoMark size="md" />
          <span className="text-lg font-bold tracking-tight text-slate-50">110G</span>
        </div>
        <NavLinks items={items} pathname={pathname} onNavigate={() => {}} />
        <UserFooter userName={userName} onLogout={handleLogout} />
      </aside>
    </>
  );
}

// A single pill slides between items as the active route changes, rather
// than each link just swapping its own background color — a small touch
// that makes the sidebar read as one coherent surface instead of a plain
// list of buttons. Position is measured from the actual rendered links
// (not hardcoded row heights) so it stays correct regardless of font
// rendering differences between browsers/devices.
function NavLinks({
  items,
  pathname,
  onNavigate,
}: {
  items: NavItem[];
  pathname: string;
  onNavigate: () => void;
}) {
  const itemRefs = React.useRef<(HTMLAnchorElement | null)[]>([]);
  const activeIndex = items.findIndex((item) => pathname === item.href || pathname.startsWith(item.href + "/"));
  const [pill, setPill] = React.useState({ top: 0, height: 0, opacity: 0 });

  React.useLayoutEffect(() => {
    const el = activeIndex >= 0 ? itemRefs.current[activeIndex] : null;
    if (!el) {
      setPill((p) => ({ ...p, opacity: 0 }));
      return;
    }
    setPill({ top: el.offsetTop, height: el.offsetHeight, opacity: 1 });
  }, [activeIndex, items]);

  return (
    <nav className="flex flex-1 flex-col overflow-y-auto p-3">
      <div className="relative flex flex-col gap-1">
        <div
          aria-hidden="true"
          className="absolute inset-x-0 rounded-xl bg-brand-gradient-soft ring-1 ring-inset ring-sky-400/30 transition-[top,height,opacity] duration-300 ease-out"
          style={{ top: pill.top, height: pill.height, opacity: pill.opacity }}
        />
        {items.map((item, i) => {
          const active = i === activeIndex;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              ref={(el) => {
                itemRefs.current[i] = el;
              }}
              onClick={onNavigate}
              className={cn(
                "relative z-10 flex items-center gap-3 rounded-xl px-4 py-3.5 text-sm font-medium transition-colors duration-200",
                active ? "text-sky-400" : "text-slate-300 hover:bg-surface2 hover:text-slate-100"
              )}
            >
              <span className="relative shrink-0">
                <Icon className="h-5 w-5" />
                <NavPendingDot />
              </span>
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function UserFooter({
  userName,
  onLogout,
  onNavigate,
}: {
  userName: string;
  onLogout: () => void;
  onNavigate?: () => void;
}) {
  return (
    <div className="border-t border-border p-3">
      <div className="flex items-center justify-between gap-2 rounded-xl px-3 py-2">
        <Link
          href="/account"
          onClick={onNavigate}
          className="truncate text-sm text-slate-300 transition-colors hover:text-slate-100 hover:underline"
          title="Mijn account — geboortedatum wijzigen"
        >
          {userName}
        </Link>
        <Button variant="ghost" size="icon" onClick={onLogout} aria-label="Uitloggen">
          <LogOut className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}
