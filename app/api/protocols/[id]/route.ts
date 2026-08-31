import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { logAudit } from "@/lib/audit";

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth([Role.ADMIN, Role.COORDINATOR]);
    const { id } = await params;
    await db.protocol.delete({ where: { id } });
    await logAudit({ userId: session.sub, action: "protocol.delete", targetType: "Protocol", targetId: id });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
