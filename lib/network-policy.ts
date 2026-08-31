import "server-only";
import { db } from "@/lib/db";
import { parseIpList } from "@/lib/ip-match";

type NetworkPolicy = { enabled: boolean; allowedIps: string[] };

let cache: (NetworkPolicy & { expiresAt: number }) | null = null;
const CACHE_TTL_MS = 30_000;

/**
 * Reads the network-restriction toggle from the Setting table, cached for
 * CACHE_TTL_MS. Prisma isn't Edge-compatible, so middleware.ts can't query
 * this directly — it calls GET /api/internal/network-policy instead, which
 * runs on the Node.js runtime and hits this function. The cache keeps that
 * endpoint (and thus every request through middleware) from re-querying the
 * database every single time; a toggle change takes up to CACHE_TTL_MS to
 * take effect everywhere.
 */
export async function getNetworkPolicy(): Promise<NetworkPolicy> {
  if (cache && cache.expiresAt > Date.now()) return cache;

  const settings = await db.setting.findMany({
    where: { key: { in: ["NETWORK_RESTRICTION_ENABLED", "NETWORK_ALLOWED_IPS"] } },
  });
  const map = new Map(settings.map((s) => [s.key, s.value]));
  const policy: NetworkPolicy = {
    enabled: map.get("NETWORK_RESTRICTION_ENABLED") === "true",
    allowedIps: parseIpList(map.get("NETWORK_ALLOWED_IPS") ?? ""),
  };
  cache = { ...policy, expiresAt: Date.now() + CACHE_TTL_MS };
  return policy;
}
