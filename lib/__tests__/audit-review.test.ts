// Real-SQLite-backed test for the periodic log-review thresholds — proves
// the actual counting/threshold logic against a real database, not mocks.
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { execSync } from "node:child_process";
import { existsSync, unlinkSync } from "node:fs";
import path from "node:path";

const TEST_DB_PATH = path.resolve(__dirname, "../../prisma/audit-review-test.db");
const TEST_DATABASE_URL = `file:${TEST_DB_PATH}`;

function cleanupDbFile() {
  for (const suffix of ["", "-journal", "-wal", "-shm"]) {
    const p = TEST_DB_PATH + suffix;
    if (existsSync(p)) unlinkSync(p);
  }
}

let runAuditReview: typeof import("@/lib/audit-review").runAuditReview;
let rawDb: typeof import("@/lib/db").db;

beforeAll(async () => {
  cleanupDbFile();
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  process.env.JWT_SECRET = process.env.JWT_SECRET || "test-only-secret-min-32-characters-long-xxxx";
  execSync("npx prisma db push --skip-generate --accept-data-loss", {
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    stdio: "pipe",
  });

  ({ runAuditReview } = await import("@/lib/audit-review"));
  ({ db: rawDb } = await import("@/lib/db"));
}, 30000);

afterAll(async () => {
  await rawDb?.$disconnect();
  cleanupDbFile();
});

beforeEach(async () => {
  await rawDb.auditReviewFinding.deleteMany();
  await rawDb.auditReviewRun.deleteMany();
  await rawDb.auditLog.deleteMany();
});

describe("runAuditReview", () => {
  it("always writes a run row, even with nothing to find", async () => {
    const result = await runAuditReview();
    expect(result.findingsCount).toBe(0);
    const run = await rawDb.auditReviewRun.findUnique({ where: { id: result.runId } });
    expect(run).not.toBeNull();
  });

  it("flags 5+ failed logins in the last 24 hours, ignores older ones", async () => {
    const now = new Date();
    const recent = new Date(now.getTime() - 60 * 60 * 1000); // 1h ago
    const old = new Date(now.getTime() - 48 * 60 * 60 * 1000); // 48h ago — outside the window

    await rawDb.auditLog.createMany({
      data: [
        ...Array.from({ length: 5 }, () => ({ action: "login.failed", createdAt: recent })),
        { action: "login.failed", createdAt: old },
      ],
    });

    const result = await runAuditReview(now);
    expect(result.findingsCount).toBe(1);
    const findings = await rawDb.auditReviewFinding.findMany({ where: { runId: result.runId } });
    expect(findings[0].category).toBe("FAILED_LOGINS");
    expect(findings[0].summary).toContain("5 mislukte");
  });

  it("does not flag fewer than the threshold", async () => {
    const now = new Date();
    await rawDb.auditLog.createMany({
      data: Array.from({ length: 4 }, () => ({ action: "login.failed", createdAt: now })),
    });
    const result = await runAuditReview(now);
    expect(result.findingsCount).toBe(0);
  });

  it("flags 5+ failed MFA attempts separately from failed logins", async () => {
    const now = new Date();
    await rawDb.auditLog.createMany({
      data: Array.from({ length: 5 }, () => ({ action: "login.mfa.failed", createdAt: now })),
    });
    const result = await runAuditReview(now);
    expect(result.findingsCount).toBe(1);
    const findings = await rawDb.auditReviewFinding.findMany({ where: { runId: result.runId } });
    expect(findings[0].category).toBe("FAILED_MFA");
    expect(findings[0].severity).toBe("HIGH");
  });

  it("marks findings HIGH severity once double the failed-login threshold", async () => {
    const now = new Date();
    await rawDb.auditLog.createMany({
      data: Array.from({ length: 10 }, () => ({ action: "login.failed", createdAt: now })),
    });
    const result = await runAuditReview(now);
    const findings = await rawDb.auditReviewFinding.findMany({ where: { runId: result.runId } });
    expect(findings[0].severity).toBe("HIGH");
  });
});
