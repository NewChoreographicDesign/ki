import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { ALLOWED_CONTENT_TYPES, MAX_SIZE_BYTES } from "@/lib/file-upload";
import { uploadFileToCloudinary } from "@/lib/cloudinary";

// Uploaded here (same-origin, multipart/form-data) and pushed to Cloudinary
// server-side — a normal server-to-server call, no browser-to-storage
// cross-origin request involved. This project switched away from Vercel
// Blob (both the direct-client-token flow and a server-mediated put())
// after every actual file transfer to Vercel's Blob API consistently
// returned an unreadable 400, even against freshly created stores.
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

    const url = await uploadFileToCloudinary(file);
    return NextResponse.json({ url });
  } catch (error) {
    // Surface a distinct, actionable code when Cloudinary itself isn't set
    // up yet (missing CLOUDINARY_* env vars) — this is expected on an
    // installation that hasn't finished setup, not an application bug, so
    // the UI can show real guidance instead of "something went wrong".
    if (error instanceof Error && error.message === "CLOUDINARY_NOT_CONFIGURED") {
      return NextResponse.json(
        {
          error: "Bestanden uploaden is nog niet ingesteld.",
          code: "STORAGE_NOT_CONFIGURED",
        },
        { status: 503 }
      );
    }
    return handleApiError(error);
  }
}
