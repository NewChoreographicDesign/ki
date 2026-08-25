import "server-only";
import { NextRequest } from "next/server";

/** Verifies the shared-secret Authorization header Vercel Cron (or any scheduler) must send. */
export function isAuthorizedCronRequest(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization");
  return header === `Bearer ${secret}`;
}
