import "server-only";
import webpush from "web-push";
import { db } from "@/lib/db";

/**
 * Web Push (VAPID) — real browser/OS push notifications, not a native
 * App/Play Store push. Works on the installed PWA on both Android and,
 * since iOS 16.4, iOS home-screen installs — so this covers "push
 * notifications on mobile" without a native build.
 *
 * A no-op (never throws) without VAPID keys configured — a deployment
 * that hasn't set these up yet just gets no push, not a broken app.
 */

let configured = false;
function ensureConfigured(): boolean {
  if (configured) return true;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) return false;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
  return true;
}

export type PushPayload = { title: string; body: string; url?: string };

/**
 * Sends one push to one subscription. Returns "expired" when the browser
 * says this registration is gone (410 Gone / 404 Not Found — the user
 * uninstalled, cleared site data, or the endpoint rotated), so the caller
 * can clean up the now-dead PushSubscription row; returns "sent" on
 * success and "failed" for anything else (network hiccup, misconfigured
 * keys) — a transient failure worth leaving the subscription in place for.
 */
export async function sendWebPush(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: PushPayload
): Promise<"sent" | "expired" | "failed"> {
  if (!ensureConfigured()) return "failed";
  try {
    await webpush.sendNotification(
      { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
      JSON.stringify(payload)
    );
    return "sent";
  } catch (error) {
    const statusCode = (error as { statusCode?: number }).statusCode;
    if (statusCode === 404 || statusCode === 410) return "expired";
    console.error("[push] failed to send", error);
    return "failed";
  }
}

/** Sends one push to every subscription belonging to a set of users, pruning any the browser reports gone. */
export async function notifyUsers(userIds: string[], payload: PushPayload): Promise<void> {
  if (userIds.length === 0) return;
  const subscriptions = await db.pushSubscription.findMany({ where: { userId: { in: userIds } } });
  const results = await Promise.all(
    subscriptions.map(async (sub) => ({ id: sub.id, result: await sendWebPush(sub, payload) }))
  );
  const expiredIds = results.filter((r) => r.result === "expired").map((r) => r.id);
  if (expiredIds.length > 0) {
    await db.pushSubscription.deleteMany({ where: { id: { in: expiredIds } } }).catch(() => {});
  }
}
