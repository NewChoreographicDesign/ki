import "server-only";
import { db } from "@/lib/db";

// DEVICE_PASSCODE is meant to be a long, hard-to-guess value (see
// .env.example) rather than a short PIN, but real deployments won't always
// follow that advice — this is the defense-in-depth backstop for when they
// don't. Mirrors the per-user lockout in app/api/auth/login/route.ts, but as
// a single global counter (DeviceUnlockLockout, schema.prisma) since
// DEVICE_PASSCODE is one shared secret, not a per-account credential.
const MAX_ATTEMPTS = 10;
const LOCK_MS = 15 * 60 * 1000;
const LOCKOUT_ROW_ID = "singleton";

export async function isDeviceUnlockLocked(): Promise<boolean> {
  const row = await db.deviceUnlockLockout.findUnique({ where: { id: LOCKOUT_ROW_ID } });
  return !!row?.lockedUntil && row.lockedUntil.getTime() > Date.now();
}

export async function recordDeviceUnlockFailure(): Promise<void> {
  const row = await db.deviceUnlockLockout.upsert({
    where: { id: LOCKOUT_ROW_ID },
    create: { id: LOCKOUT_ROW_ID, attempts: 1 },
    update: { attempts: { increment: 1 } },
  });
  if (row.attempts >= MAX_ATTEMPTS) {
    await db.deviceUnlockLockout.update({
      where: { id: LOCKOUT_ROW_ID },
      data: { attempts: 0, lockedUntil: new Date(Date.now() + LOCK_MS) },
    });
  }
}

export async function resetDeviceUnlockFailures(): Promise<void> {
  await db.deviceUnlockLockout.upsert({
    where: { id: LOCKOUT_ROW_ID },
    create: { id: LOCKOUT_ROW_ID, attempts: 0 },
    update: { attempts: 0, lockedUntil: null },
  });
}
