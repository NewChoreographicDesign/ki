import "server-only";
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

/**
 * General-purpose AES-256-GCM encryption for a sensitive column that must
 * be recoverable by the app itself (the MFA TOTP secret) — as opposed to a
 * password/passcode, which is hashed one-way (see lib/passcode.ts).
 * Deliberately a separate derived key from lib/passcode.ts's own
 * encryptForDisplay (a different scrypt "info" string below): those exist
 * for a short-lived, admin-facing reveal of a one-time code; this backs a
 * long-lived credential secret with its own access-control story. Both
 * still derive from JWT_SECRET — this app's one trusted server-side
 * secret — rather than adding another env var.
 */
function fieldEncryptionKey(): Buffer {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET ontbreekt");
  return scryptSync(secret, "sensitive-field-encryption-v1", 32);
}

export function encryptSensitiveField(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", fieldEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

/** Inverse of encryptSensitiveField. Returns null on any tamper/format error rather than throwing. */
export function decryptSensitiveField(payload: string): string | null {
  try {
    const buf = Buffer.from(payload, "base64");
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const encrypted = buf.subarray(28);
    const decipher = createDecipheriv("aes-256-gcm", fieldEncryptionKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
