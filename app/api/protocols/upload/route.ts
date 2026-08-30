import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { BlobError } from "@vercel/blob";
import { requireAuth } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { ALLOWED_CONTENT_TYPES, MAX_SIZE_BYTES } from "@/lib/blob-upload";

export async function POST(request: Request) {
  try {
    // Protocols are open to every logged-in role (same as creating one via
    // POST /api/protocols) — only deleting stays admin/coordinator-only.
    await requireAuth();
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
        // The frontend saves the Protocol row itself (via POST /api/protocols)
        // once upload() resolves, so nothing to do here.
      },
    });

    return NextResponse.json(jsonResponse);
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
