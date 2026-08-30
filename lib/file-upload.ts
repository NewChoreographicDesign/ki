import "server-only";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AuthError } from "@/lib/auth";
import { handleApiError } from "@/lib/api";

/** Shared between the documents and protocols upload routes. */
export const ALLOWED_CONTENT_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/png",
  "image/jpeg",
  "text/plain",
];

// Files go through our own server (uploaded to Cloudinary server-side, not
// directly from the browser — see the upload routes for why), so the file
// has to fit in a single Serverless Function request body. Vercel's hard
// platform limit there is 4.5 MB; 4 MB leaves margin for multipart overhead.
export const MAX_SIZE_BYTES = 4 * 1024 * 1024; // 4 MB

/**
 * Shared error handling for the upload routes. Distinguishes:
 * - Cloudinary not configured yet → a clear "not set up" message (503).
 * - Auth/validation errors → handleApiError's normal handling.
 * - Anything else (a real Cloudinary upload failure) → its message is
 *   relayed directly (502), unlike handleApiError's default of hiding
 *   unexpected errors behind a generic message — that message is the only
 *   way to actually diagnose why an upload failed.
 */
export function handleUploadError(error: unknown): NextResponse {
  if (error instanceof Error && error.message === "CLOUDINARY_NOT_CONFIGURED") {
    return NextResponse.json(
      { error: "Bestanden uploaden is nog niet ingesteld.", code: "STORAGE_NOT_CONFIGURED" },
      { status: 503 }
    );
  }
  if (error instanceof AuthError || error instanceof ZodError) {
    return handleApiError(error);
  }
  if (error instanceof Error) {
    console.error("[upload] Cloudinary upload failed", error);
    return NextResponse.json({ error: error.message }, { status: 502 });
  }
  return handleApiError(error);
}
