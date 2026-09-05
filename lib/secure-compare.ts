import "server-only";
import { timingSafeEqual } from "crypto";

/**
 * Constant-time string comparison for shared secrets (CRON_SECRET,
 * DEVICE_PASSCODE). A plain `===` short-circuits on the first differing
 * byte, so how long a guess takes to reject leaks how many leading
 * characters it got right — over enough requests that's a practical
 * side-channel against a secret compared this way. timingSafeEqual doesn't
 * have that leak, but throws on mismatched buffer lengths instead of
 * returning false, so that case is handled explicitly first (which does
 * leak the secret's length — an accepted, standard trade-off; the actual
 * character content is what must not leak).
 */
export function secureCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
