import "server-only";
import { NextRequest } from "next/server";

// The literal value from .env.example — reject it so a deployment that
// copied the example file without generating a real secret can't have its
// cron endpoints (which trigger mass emails of client data) triggered by
// anyone who read this repository's README.
const PLACEHOLDER_CRON_SECRET = "change-me-cron-secret";

/** Verifies the shared-secret Authorization header Vercel Cron (or any scheduler) must send. */
export function isAuthorizedCronRequest(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret === PLACEHOLDER_CRON_SECRET) return false;
  const header = request.headers.get("authorization");
  return header === `Bearer ${secret}`;
}
