import type * as React from "react";
import { Clock, DoorClosed, Phone, ShoppingBag, TreePine, Tv, Users, Utensils, Wifi } from "lucide-react";
import type { AllowanceData, AllowanceTypeKey } from "@/lib/allowances-shared";

type Icon = React.ComponentType<{ className?: string }>;

export const ALLOWANCE_TYPE_ICON: Record<AllowanceTypeKey, Icon> = {
  PHONE: Phone,
  SCREEN: Tv,
  VISIT: Users,
  OUTSIDE: TreePine,
  WIFI: Wifi,
  KITCHEN: Utensils,
  ERRAND: ShoppingBag,
  ROOM: DoorClosed,
  OTHER: Clock,
};

export type AllowanceApiResult = {
  ok: boolean;
  status: number;
  data: {
    error?: string;
    allowance?: AllowanceData;
    active?: AllowanceData[];
    completedToday?: AllowanceData[];
    details?: { fieldErrors?: Record<string, string[] | undefined> };
  };
};

/** JSON request that never throws: network failures come back as { ok: false, status: 0 }. Same shape as todo-ui.ts#api, kept separate since the two domains' response payloads don't overlap. */
export async function allowanceApi(url: string, method: string, body?: unknown): Promise<AllowanceApiResult> {
  try {
    const res = await fetch(url, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: { error: "Geen verbinding. Probeer het opnieuw." } };
  }
}

export function allowanceApiMessage(result: AllowanceApiResult, fallback: string): string {
  const field = Object.values(result.data.details?.fieldErrors ?? {})
    .flat()
    .find(Boolean);
  return field || result.data.error || fallback;
}
