import "server-only";
import { createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import QRCode from "qrcode";
import { hashSecretCode, verifySecretCode } from "@/lib/passcode";

/**
 * TOTP (RFC 6238, built on HOTP/RFC 4226) tweestapsverificatie. A
 * from-scratch, dependency-free implementation of the standard algorithm
 * (the same one Google Authenticator/Microsoft Authenticator/Authy/
 * 1Password all speak) rather than a library — only `qrcode` is a real
 * dependency, and that's pure rendering (an otpauth:// URI into a
 * scannable image), it never sees or generates a secret.
 */

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const DIGITS = 6;
const STEP_SECONDS = 30;
// Accept one step early/late either side (±30s) to tolerate ordinary clock
// drift between the server and the person's phone — RFC 6238 itself
// recommends allowing a small window rather than an exact match.
const DRIFT_WINDOW = 1;

export function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

export function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of clean) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) continue;
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

/** A fresh random 160-bit TOTP secret (the RFC's recommended SHA1 key size), base32-encoded for display/storage. */
export function generateMfaSecret(): string {
  return base32Encode(randomBytes(20));
}

/** HOTP (RFC 4226) for a given counter — the primitive TOTP is built on. */
function hotp(secret: Buffer, counter: number, digits = DIGITS): string {
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac("sha1", secret).update(counterBuffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  const otp = binary % 10 ** digits;
  return otp.toString().padStart(digits, "0");
}

/** The TOTP code for a base32 secret at a given instant (defaults to now). */
export function totpCode(secretBase32: string, atMs: number = Date.now(), step = STEP_SECONDS, digits = DIGITS): string {
  const counter = Math.floor(atMs / 1000 / step);
  return hotp(base32Decode(secretBase32), counter, digits);
}

function timingSafeEqualStr(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/** Verifies a user-entered code against the current time ± DRIFT_WINDOW steps. */
export function verifyTotpCode(secretBase32: string, code: string, atMs: number = Date.now()): boolean {
  const trimmed = code.trim();
  if (!/^\d{6}$/.test(trimmed)) return false;
  for (let drift = -DRIFT_WINDOW; drift <= DRIFT_WINDOW; drift++) {
    const candidate = totpCode(secretBase32, atMs + drift * STEP_SECONDS * 1000);
    if (timingSafeEqualStr(candidate, trimmed)) return true;
  }
  return false;
}

/** otpauth:// URI for authenticator apps to scan/import — RFC (Google Authenticator Key URI Format). */
export function buildOtpauthUri(params: { secretBase32: string; accountLabel: string; issuer: string }): string {
  const label = encodeURIComponent(`${params.issuer}:${params.accountLabel}`);
  const issuer = encodeURIComponent(params.issuer);
  return `otpauth://totp/${label}?secret=${params.secretBase32}&issuer=${issuer}&algorithm=SHA1&digits=${DIGITS}&period=${STEP_SECONDS}`;
}

/** Renders the otpauth:// URI as a scannable QR code, as a data: URL — nothing leaves the server to generate it. */
export async function renderOtpauthQrDataUrl(otpauthUri: string): Promise<string> {
  return QRCode.toDataURL(otpauthUri, { errorCorrectionLevel: "M", margin: 1, width: 240 });
}

const BACKUP_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // excludes 0/O, 1/I/l — same as lib/passcode.ts
const BACKUP_CODE_COUNT = 10;

function generateOneBackupCode(): string {
  let out = "";
  for (let i = 0; i < 8; i++) {
    if (i === 4) out += "-";
    out += BACKUP_CODE_ALPHABET[randomInt(BACKUP_CODE_ALPHABET.length)];
  }
  return out;
}

/** 10 single-use recovery codes, shown once at enrollment — the plaintext is never stored (see MfaBackupCode's schema.prisma comment). */
export function generateBackupCodes(count = BACKUP_CODE_COUNT): string[] {
  return Array.from({ length: count }, () => generateOneBackupCode());
}

export async function hashBackupCode(code: string): Promise<{ hash: string; salt: string }> {
  return hashSecretCode(normalizeBackupCode(code));
}

export async function verifyBackupCode(code: string, hash: string, salt: string): Promise<boolean> {
  return verifySecretCode(normalizeBackupCode(code), hash, salt);
}

function normalizeBackupCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, "");
}

export function looksLikeBackupCode(code: string): boolean {
  return /^[A-Z2-9]{4}-?[A-Z2-9]{4}$/.test(normalizeBackupCode(code));
}
