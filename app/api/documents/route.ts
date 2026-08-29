import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { documentSchema } from "@/lib/validations";

export async function POST(request: NextRequest) {
  try {
    // Documents live in the main menu now, open to every logged-in role —
    // only deleting (see [id]/route.ts) stays restricted.
    const session = await requireAuth();
    const body = await request.json();
    const data = documentSchema.parse(body);
    const clientId = data.clientId || null;

    const document = await db.document.create({
      data: {
        title: data.title,
        url: data.url,
        clientId,
        // Category only distinguishes "Algemeen" vs. "Nieuwe medewerker"
        // threads for non-client documents; a client document belongs to
        // that client's thread regardless of category.
        category: clientId ? "GENERAL" : data.category || "GENERAL",
        uploadedById: session.sub,
      },
    });

    return NextResponse.json({ ok: true, document });
  } catch (error) {
    return handleApiError(error);
  }
}
