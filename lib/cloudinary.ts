import "server-only";
import type { v2 as CloudinaryV2 } from "cloudinary";

let configured = false;

/**
 * A malformed CLOUDINARY_URL (e.g. someone pasted the whole
 * "CLOUDINARY_URL=cloudinary://..." line, prefix included, into the value
 * field) isn't just an upload-time problem: the `cloudinary` package reads
 * and validates process.env.CLOUDINARY_URL the moment it's first imported
 * (deep inside its own utils module), throwing immediately if it doesn't
 * start with "cloudinary://". Since Next.js imports every route module
 * during the build's page-data-collection step, that throw crashed the
 * entire build — not just this feature. Clearing an invalid value before
 * ever importing the package turns that into a graceful "not configured"
 * instead.
 *
 * Also trims whitespace: copy-pasting a credential (especially on mobile)
 * very easily introduces a leading/trailing space or newline that looks
 * identical to the real value but breaks signature verification outright —
 * this project has hit that exact failure mode repeatedly with other env
 * vars, so guard against it here too rather than requiring a byte-perfect
 * paste.
 */
function sanitizeCloudinaryUrl() {
  const raw = process.env.CLOUDINARY_URL;
  if (raw === undefined) return;
  const trimmed = raw.trim();
  if (trimmed.toLowerCase().startsWith("cloudinary://")) {
    process.env.CLOUDINARY_URL = trimmed;
  } else {
    delete process.env.CLOUDINARY_URL;
  }
}

async function ensureConfigured(): Promise<typeof CloudinaryV2> {
  sanitizeCloudinaryUrl();
  // Imported lazily (not at module top-level) so a malformed CLOUDINARY_URL
  // can be sanitized above before the package ever reads it.
  const { v2: cloudinary } = await import("cloudinary");
  if (configured) return cloudinary;

  // Cloudinary's dashboard offers a single combined connection string
  // (cloudinary://<api_key>:<api_secret>@<cloud_name>) as an alternative to
  // three separate values — the SDK parses it itself when config(true)
  // forces a reload from env, so prefer it when set.
  if (process.env.CLOUDINARY_URL) {
    cloudinary.config(true);
    configured = true;
    return cloudinary;
  }

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
  const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
  const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();
  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error("CLOUDINARY_NOT_CONFIGURED");
  }
  cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret });
  configured = true;
  return cloudinary;
}

/**
 * Uploads a file to Cloudinary and returns its public URL. Throws
 * Error("CLOUDINARY_NOT_CONFIGURED") when the env vars aren't set (or the
 * only one set was malformed) — callers should catch that and surface a
 * clear "not set up yet" message instead of a generic failure.
 *
 * resource_type: "auto" makes Cloudinary pick image/video/raw correctly for
 * everything we accept (PDF, Word, Excel, images, text). Note: a Cloudinary
 * account has "Allow delivery of PDF and ZIP files" off by default for
 * unsigned/public URLs — if uploaded PDFs 401 when opened, that setting
 * (Settings → Security) needs to be enabled once.
 */
export async function uploadFileToCloudinary(file: File): Promise<string> {
  const cloudinary = await ensureConfigured();
  const buffer = Buffer.from(await file.arrayBuffer());
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { resource_type: "auto", folder: "woongroep-admin" },
      (error, result) => {
        if (error || !result) {
          // Cloudinary's callback error is a plain object ({message,
          // http_code, ...}), not an Error instance — carry its real
          // message through instead of discarding it behind a generic one.
          const message =
            error && typeof error === "object" && "message" in error
              ? String((error as { message: unknown }).message)
              : "Cloudinary-upload mislukt";
          reject(new Error(message));
          return;
        }
        resolve(result.secure_url);
      }
    );
    uploadStream.end(buffer);
  });
}
