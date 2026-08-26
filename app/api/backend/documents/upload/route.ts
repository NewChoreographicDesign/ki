import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { BlobError } from "@vercel/blob";
import { Role } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import { handleApiError } from "@/lib/api";

const ALLOWED_CONTENT_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/png",
  "image/jpeg",
  "text/plain",
];
const MAX_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB

export async function POST(request: Request) {
  try {
    await requireAuth([Role.ADMIN, Role.COORDINATOR]);
    const body = (await request.json()) as HandleUploadBody;

    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: ALLOWED_CONTENT_TYPES,
        maximumSizeInBytes: MAX_SIZE_BYTES,
        addRandomSuffix: true,
      }),
      onUploadCompleted: async () => {
        // The frontend saves the Document row itself (via POST /api/backend/documents)
        // once upload() resolves, so nothing to do here.
      },
    });

    return NextResponse.json(jsonResponse);
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
