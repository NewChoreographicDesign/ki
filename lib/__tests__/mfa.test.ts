import { describe, it, expect } from "vitest";
import {
  base32Encode,
  base32Decode,
  totpCode,
  verifyTotpCode,
  generateMfaSecret,
  buildOtpauthUri,
  generateBackupCodes,
  hashBackupCode,
  verifyBackupCode,
  looksLikeBackupCode,
} from "@/lib/mfa";

// RFC 6238 Appendix B's own published SHA1 test vectors use the ASCII
// secret "12345678901234567890" and specify 8-digit codes at fixed times.
// This app's totpCode() truncates to 6 digits — mathematically that's just
// (binary % 10^8) % 10^6, i.e. the RFC's 8-digit answer mod 10^6, since
// 10^6 divides 10^8 — so the last 6 digits of each published 8-digit
// vector are exactly what a real, correct 6-digit implementation must
// produce. This proves the implementation against the standard's own
// numbers, not just internal self-consistency.
const RFC6238_SECRET_ASCII = "12345678901234567890";
const RFC6238_SECRET_BASE32 = base32Encode(Buffer.from(RFC6238_SECRET_ASCII, "ascii"));

const RFC6238_VECTORS: { timeSeconds: number; eightDigit: string }[] = [
  { timeSeconds: 59, eightDigit: "94287082" },
  { timeSeconds: 1111111109, eightDigit: "07081804" },
  { timeSeconds: 1111111111, eightDigit: "14050471" },
  { timeSeconds: 1234567890, eightDigit: "89005924" },
  { timeSeconds: 2000000000, eightDigit: "69279037" },
];

describe("base32Encode/base32Decode", () => {
  it("round-trips arbitrary bytes", () => {
    const original = Buffer.from([0, 1, 2, 254, 255, 128, 42, 7]);
    expect(base32Decode(base32Encode(original))).toEqual(original);
  });

  it("decodes the RFC 6238 example secret back to its known ASCII form", () => {
    expect(base32Decode(RFC6238_SECRET_BASE32).toString("ascii")).toBe(RFC6238_SECRET_ASCII);
  });
});

describe("totpCode against RFC 6238's own published SHA1 test vectors", () => {
  for (const vector of RFC6238_VECTORS) {
    const expectedSixDigit = vector.eightDigit.slice(-6);
    it(`matches the RFC vector for T=${vector.timeSeconds} (expects ...${expectedSixDigit})`, () => {
      const code = totpCode(RFC6238_SECRET_BASE32, vector.timeSeconds * 1000);
      expect(code).toBe(expectedSixDigit);
    });
  }
});

describe("verifyTotpCode", () => {
  it("accepts the exact current code", () => {
    const secret = generateMfaSecret();
    const now = Date.now();
    const code = totpCode(secret, now);
    expect(verifyTotpCode(secret, code, now)).toBe(true);
  });

  it("accepts a code from one step earlier (clock drift tolerance)", () => {
    const secret = generateMfaSecret();
    const now = Date.now();
    const earlierCode = totpCode(secret, now - 30_000);
    expect(verifyTotpCode(secret, earlierCode, now)).toBe(true);
  });

  it("rejects a code from two steps away (outside the drift window)", () => {
    const secret = generateMfaSecret();
    const now = Date.now();
    const farCode = totpCode(secret, now - 90_000);
    expect(verifyTotpCode(secret, farCode, now)).toBe(false);
  });

  it("rejects a wrong secret's code", () => {
    const secretA = generateMfaSecret();
    const secretB = generateMfaSecret();
    const now = Date.now();
    const codeForA = totpCode(secretA, now);
    expect(verifyTotpCode(secretB, codeForA, now)).toBe(false);
  });

  it("rejects malformed input instead of throwing", () => {
    const secret = generateMfaSecret();
    expect(verifyTotpCode(secret, "not-a-code")).toBe(false);
    expect(verifyTotpCode(secret, "12345")).toBe(false);
    expect(verifyTotpCode(secret, "")).toBe(false);
  });
});

describe("buildOtpauthUri", () => {
  it("embeds the secret, issuer, account, and RFC-standard params", () => {
    const uri = buildOtpauthUri({ secretBase32: "JBSWY3DPEHPK3PXP", accountLabel: "anna@voorbeeld", issuer: "Vezrap" });
    expect(uri).toMatch(/^otpauth:\/\/totp\//);
    expect(uri).toContain("secret=JBSWY3DPEHPK3PXP");
    expect(uri).toContain("issuer=Vezrap");
    expect(uri).toContain("digits=6");
    expect(uri).toContain("period=30");
  });
});

describe("backup codes", () => {
  it("generates 10 distinct, correctly formatted codes", () => {
    const codes = generateBackupCodes();
    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
    for (const code of codes) {
      expect(looksLikeBackupCode(code)).toBe(true);
    }
  });

  it("hashes a code and verifies only the matching plaintext", async () => {
    const [code] = generateBackupCodes(1);
    const { hash, salt } = await hashBackupCode(code);
    expect(await verifyBackupCode(code, hash, salt)).toBe(true);
    expect(await verifyBackupCode("ZZZZ-ZZZZ", hash, salt)).toBe(false);
  });

  it("is case- and whitespace-insensitive on verify", async () => {
    const [code] = generateBackupCodes(1);
    const { hash, salt } = await hashBackupCode(code);
    expect(await verifyBackupCode(code.toLowerCase(), hash, salt)).toBe(true);
    expect(await verifyBackupCode(` ${code} `, hash, salt)).toBe(true);
  });
});
