import { NextRequest, NextResponse } from "next/server";
import { put, BlobError } from "@vercel/blob";
import { Role } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { ALLOWED_CONTENT_TYPES, MAX_SIZE_BYTES } from "@/lib/blob-upload";

// The file is uploaded here (same-origin, multipart/form-data) rather than
// going straight from the browser to Vercel Blob with a client token. The
// direct-to-Vercel approach consistently returned a 400 from Vercel's own
// Blob API in production for this project, even against a freshly created
// store, with no way to see the real error body (CORS hides it). Uploading
// through our own server first and calling put() here — a normal
// server-to-server call, no CORS involved — sidesteps that entirely.
export async function POST(request: NextRequest) {
  try {
    // Uploading a document is admin-only (managed via Backend → Documenten).
    await requireAuth([Role.ADMIN]);

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
    // Surface a distinct, actionable code when Vercel Blob itself isn't set
    // up yet (missing/invalid BLOB_READ_WRITE_TOKEN) — this is expected on
    // an installation that hasn't finished setup, not an application bug,
    // so the UI can show real guidance instead of "something went wrong".
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
