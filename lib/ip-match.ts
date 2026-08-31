// No "server-only" here: this module has zero DB/Node dependencies (pure
// string/bit math) so it can run in Edge Middleware, where "server-only"
// imports like Prisma are not available.

/**
 * Vercel sets x-forwarded-for to "client, proxy1, proxy2, ..." — the first
 * entry is the real client IP. x-real-ip is a fallback for other hosts.
 * IPv4 only: an IPv6 visitor simply won't match any configured range (see
 * README for the caveat this implies for network restriction).
 */
export function getRequestIp(headers: { get(name: string): string | null }): string | null {
  const forwardedFor = headers.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }
  return headers.get("x-real-ip");
}

export function parseIpList(raw: string): string[] {
  return raw
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function ipMatchesAny(ip: string | null, patterns: string[]): boolean {
  if (!ip) return false;
  return patterns.some((pattern) => ipMatches(ip, pattern));
}

function ipMatches(ip: string, pattern: string): boolean {
  if (pattern.includes("/")) return cidrMatch(ip, pattern);
  return ip === pattern;
}

function cidrMatch(ip: string, cidr: string): boolean {
  const [range, bitsRaw] = cidr.split("/");
  const bits = Number(bitsRaw);
  if (!Number.isInteger(bits) || bits < 0 || bits > 32) return false;
  const ipNum = ipToInt(ip);
  const rangeNum = ipToInt(range);
  if (ipNum === null || rangeNum === null) return false;
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (ipNum & mask) === (rangeNum & mask);
}

function ipToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let result = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const n = Number(part);
    if (n < 0 || n > 255) return null;
    result = (result << 8) | n;
  }
  return result >>> 0;
}
