import { AlertTriangle, Brain, Heart, HeartPulse, MessageCircle, Pill, ShieldAlert, Users, Wrench, type LucideIcon } from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import type { HandoverCategoryKey, HandoverPriorityKey } from "@/lib/handover-shared";

export const CATEGORY_ICON: Record<HandoverCategoryKey, LucideIcon> = {
  ALGEMEEN: MessageCircle,
  GEDRAG: Brain,
  GEZONDHEID: HeartPulse,
  MEDICATIE: Pill,
  VEILIGHEID: ShieldAlert,
  SOCIAAL: Users,
  PRAKTISCH: Wrench,
};

export const PRIORITY_STYLE: Record<HandoverPriorityKey, { bar: string; badge: "red" | "amber" | "slate"; ring: string; icon: LucideIcon }> = {
  URGENT: { bar: "bg-red-500", badge: "red", ring: "ring-red-500/40", icon: AlertTriangle },
  AANDACHT: { bar: "bg-amber-400", badge: "amber", ring: "ring-amber-400/30", icon: Heart },
  INFO: { bar: "bg-slate-600", badge: "slate", ring: "ring-border", icon: MessageCircle },
};

/** "zojuist", "12 min geleden", "3 uur geleden", otherwise the full date. */
export function timeAgo(iso: string, now: number = Date.now()): string {
  const diff = now - new Date(iso).getTime();
  if (diff < 60_000) return "zojuist";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min geleden`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} uur geleden`;
  return formatDateTime(new Date(iso));
}

/** True when the keyboard event comes from somewhere the user is typing. */
export function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName);
}
