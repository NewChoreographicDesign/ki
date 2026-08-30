import "server-only";

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

// Files now go through our own server (put() server-side, not a direct
// browser-to-Vercel-Blob PUT — see the upload routes for why), so the file
// has to fit in a single Serverless Function request body. Vercel's hard
// platform limit there is 4.5 MB; 4 MB leaves margin for multipart overhead.
export const MAX_SIZE_BYTES = 4 * 1024 * 1024; // 4 MB
