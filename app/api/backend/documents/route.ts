import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { documentSchema } from "@/lib/validations";

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth([Role.ADMIN, Role.COORDINATOR]);
    const body = await request.json();
    const data = documentSchema.parse(body);

    const document = await db.document.create({
      data: {
        title: data.title,
        url: data.url,
        clientId: data.clientId || null,
        uploadedById: session.sub,
      },
    });

    return NextResponse.json({ ok: true, document });
  } catch (error) {
    return handleApiError(error);
  }
}
