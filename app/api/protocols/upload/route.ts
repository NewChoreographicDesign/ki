import { NextRequest, NextResponse } from "next/server";
import { put, BlobError } from "@vercel/blob";
import { requireAuth } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { ALLOWED_CONTENT_TYPES, MAX_SIZE_BYTES } from "@/lib/blob-upload";

// See app/api/documents/upload/route.ts for why this uploads through our
// own server (put()) instead of a direct browser-to-Vercel-Blob PUT.
export async function POST(request: NextRequest) {
  try {
    // Protocols are open to every logged-in role (same as creating one via
    // POST /api/protocols) — only deleting stays admin/coordinator-only.
    await requireAuth();

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Geen bestand ontvangen" }, { status: 400 });
    }
    if (!ALLOWED_CONTENT_TYPES.includes(file.type)) {
      return NextResponse.json({ error: "Dit bestandstype is niet toegestaan" }, { status: 400 });
    }
    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json(
        { error: `Bestand is te groot (max ${Math.floor(MAX_SIZE_BYTES / (1024 * 1024))} MB)` },
        { status: 400 }
      );
    }

    const blob = await put(file.name, file, {
      access: "public",
      addRandomSuffix: true,
      contentType: file.type,
    });

    return NextResponse.json({ url: blob.url });
  } catch (error) {
    if (error instanceof BlobError) {
      return NextResponse.json(
        {
          error: "Bestanden uploaden is nog niet ingesteld.",
          code: "BLOB_NOT_CONFIGURED",
        },
        { status: 503 }
      );
    }
    return handleApiError(error);
  }
}
