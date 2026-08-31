import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { logAudit } from "@/lib/audit";

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth([Role.ADMIN]);
    const { id } = await params;
    await db.document.delete({ where: { id } });
    await logAudit({ userId: session.sub, action: "document.delete", targetType: "Document", targetId: id });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
