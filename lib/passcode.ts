import "server-only";
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  randomInt,
  scrypt as scryptCallback,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const KEY_LENGTH = 64;

/** Salted scrypt hash of a shared secret (invaller registration code, MFA backup code). */
export async function hashSecretCode(code: string): Promise<{ hash: string; salt: string }> {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scrypt(code, salt, KEY_LENGTH)) as Buffer;
  return { hash: derived.toString("hex"), salt };
}

export async function verifySecretCode(code: string, hash: string, salt: string): Promise<boolean> {
  const derived = (await scrypt(code, salt, KEY_LENGTH)) as Buffer;
  const expected = Buffer.from(hash, "hex");
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}

// Excludes visually ambiguous characters (0/O, 1/I/l) since this is meant to
// be read off a screen once and typed/shared with staff.
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** A random, human-typeable code shown once at registration/setup time. */
export function generateReadableCode(length = 12): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  }
  return out;
}

// Derived once per process from JWT_SECRET (this app's one trusted
// server-side secret — see lib/auth.ts) rather than adding a second env
// var just for this. A fixed, unsalted "info" string keeps the derived
// key stable across deploys while staying cryptographically separate from
// the JWT-signing use of the same secret.
function displayEncryptionKey(): Buffer {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET ontbreekt");
  return scryptSync(secret, "passcode-display-v1", 32);
}

/**
 * Reversible, authenticated encryption for a plaintext code that also
 * needs to be re-shown to an admin later (e.g. the invaller registration
 * code) — used alongside a real one-way hash (hashSecretCode) that's what
 * actually verifies an attempt. Never use this for anything that needs
 * real one-way hashing.
 */
export function encryptForDisplay(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", displayEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

/** Inverse of encryptForDisplay. Returns null on any tamper/format error rather than throwing. */
export function decryptForDisplay(payload: string): string | null {
  try {
    const buf = Buffer.from(payload, "base64");
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const encrypted = buf.subarray(28);
    const decipher = createDecipheriv("aes-256-gcm", displayEncryptionKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
