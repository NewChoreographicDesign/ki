import "server-only";
import { v2 as cloudinary } from "cloudinary";

let configured = false;

function ensureConfigured() {
  if (configured) return;

  // Cloudinary's dashboard offers a single combined connection string
  // (cloudinary://<api_key>:<api_secret>@<cloud_name>) as an alternative to
  // three separate values — the SDK parses it itself when config(true)
  // forces a reload from env, so prefer it when set.
  if (process.env.CLOUDINARY_URL) {
    cloudinary.config(true);
    configured = true;
    return;
  }

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error("CLOUDINARY_NOT_CONFIGURED");
  }
  cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret });
  configured = true;
}

/**
 * Uploads a file to Cloudinary and returns its public URL. Throws
 * Error("CLOUDINARY_NOT_CONFIGURED") when the env vars aren't set — callers
 * should catch that and surface a clear "not set up yet" message instead of
 * a generic failure.
 *
 * resource_type: "auto" makes Cloudinary pick image/video/raw correctly for
 * everything we accept (PDF, Word, Excel, images, text). Note: a Cloudinary
 * account has "Allow delivery of PDF and ZIP files" off by default for
 * unsigned/public URLs — if uploaded PDFs 401 when opened, that setting
 * (Settings → Security) needs to be enabled once.
 */
export async function uploadFileToCloudinary(file: File): Promise<string> {
  ensureConfigured();
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
