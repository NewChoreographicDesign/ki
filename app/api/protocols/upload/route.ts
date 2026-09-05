import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { ALLOWED_CONTENT_TYPES, MAX_SIZE_BYTES, handleUploadError } from "@/lib/file-upload";
import { uploadFileToCloudinary } from "@/lib/cloudinary";

// Uploads through our own server to Cloudinary (rather than a direct
// browser-to-storage request) so the file type/size checks below and the
// auth check can't be bypassed by talking to Cloudinary directly.
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

    const url = await uploadFileToCloudinary(file);
    return NextResponse.json({ url });
  } catch (error) {
    return handleUploadError(error);
  }
}
