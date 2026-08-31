import { NextResponse } from "next/server";
import { getNetworkPolicy } from "@/lib/network-policy";

// Called by middleware.ts (Edge runtime, no Prisma access) to read the
// network-restriction toggle from the database (Node.js runtime). This
// route itself is exempt from that same restriction in middleware.ts — it
// carries no sensitive data (just on/off + the configured ranges) and must
// stay reachable from inside the deployment regardless of the caller's IP.
export async function GET() {
  const policy = await getNetworkPolicy();
  return NextResponse.json(policy);
}
