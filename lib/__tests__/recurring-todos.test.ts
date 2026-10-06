// lib/recurring-todos.ts against a real ephemeral SQLite DB (same pattern
// as lib/__tests__/audit-review.test.ts) — the interval-based regeneration
// path (intervalDays/intervalAnchorDate/showUntil) needs real date
// comparisons against actual DB rows, not just the pure isTodoDueToday
// logic already covered in lib/__tests__/utils.test.ts.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execSync } from "node:child_process";
import { existsSync, unlinkSync } from "node:fs";
import path from "node:path";

const TEST_DB_PATH = path.resolve(__dirname, "../../prisma/recurring-todos-test.db");
const TEST_DATABASE_URL = `file:${TEST_DB_PATH}`;

function cleanupDbFile() {
  for (const suffix of ["", "-journal", "-wal", "-shm"]) {
    const p = TEST_DB_PATH + suffix;
    if (existsSync(p)) unlinkSync(p);
  }
}

let regenerateRecurringTodos: typeof import("@/lib/recurring-todos").regenerateRecurringTodos;
let rawDb: typeof import("@/lib/db").db;
let todayCalendarDate: typeof import("@/lib/utils").todayCalendarDate;

const USER_ID = "user-recurring-todos-test";

beforeAll(async () => {
  cleanupDbFile();
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  process.env.JWT_SECRET = process.env.JWT_SECRET || "test-only-secret-min-32-characters-long-xxxx";
  execSync("npx prisma db push --skip-generate --accept-data-loss", {
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    stdio: "pipe",
  });

  ({ regenerateRecurringTodos } = await import("@/lib/recurring-todos"));
  ({ db: rawDb } = await import("@/lib/db"));
  ({ todayCalendarDate } = await import("@/lib/utils"));

  await rawDb.user.create({
    data: { id: USER_ID, name: "Tester", birthDate: new Date("1980-01-01"), role: "EMPLOYEE" },
  });
}, 30000);

afterAll(async () => {
  await rawDb.$disconnect();
  cleanupDbFile();
});

function daysAgo(n: number): Date {
  const d = todayCalendarDate();
  d.setUTCDate(d.getUTCDate() - n);
  return d;
}

describe("regenerateRecurringTodos — interval-based recurrence", () => {
  it("spawns a new occurrence when today lands on the interval cycle, carrying the same anchor forward", async () => {
    const anchor = daysAgo(6); // intervalDays=3 → due again today (6 % 3 === 0)
    const completed = await rawDb.todo.create({
      data: {
        title: "Interval taak",
        priority: "MEDIUM",
        intervalDays: 3,
        intervalAnchorDate: anchor,
        recurring: true,
        completed: true,
        completedAt: daysAgo(1),
        createdById: USER_ID,
      },
    });

    const result = await regenerateRecurringTodos();
    expect(result.regenerated).toBe(1);

    const spawned = await rawDb.todo.findFirst({ where: { title: "Interval taak", completed: false } });
    expect(spawned).not.toBeNull();
    expect(spawned!.intervalDays).toBe(3);
    expect(spawned!.intervalAnchorDate?.getTime()).toBe(anchor.getTime());

    const original = await rawDb.todo.findUnique({ where: { id: completed.id } });
    expect(original!.regenerated).toBe(true);
  });

  it("does not spawn a new occurrence on an off-cycle day", async () => {
    const anchor = daysAgo(4); // intervalDays=3, diff=4 → 4 % 3 !== 0
    await rawDb.todo.create({
      data: {
        title: "Interval taak off-cycle",
        priority: "MEDIUM",
        intervalDays: 3,
        intervalAnchorDate: anchor,
        recurring: true,
        completed: true,
        completedAt: daysAgo(1),
        createdById: USER_ID,
      },
    });

    const before = await rawDb.todo.count({ where: { title: "Interval taak off-cycle" } });
    await regenerateRecurringTodos();
    const after = await rawDb.todo.count({ where: { title: "Interval taak off-cycle" } });
    expect(after).toBe(before);
  });

  it("never regenerates once past showUntil, even on an otherwise-due cycle day", async () => {
    const anchor = daysAgo(3); // intervalDays=3, diff=3 → due today by the cycle alone
    await rawDb.todo.create({
      data: {
        title: "Interval taak na evaluatie",
        priority: "MEDIUM",
        intervalDays: 3,
        intervalAnchorDate: anchor,
        showUntil: daysAgo(1), // plan's evaluation date already passed
        recurring: true,
        completed: true,
        completedAt: daysAgo(1),
        createdById: USER_ID,
      },
    });

    const before = await rawDb.todo.count({ where: { title: "Interval taak na evaluatie" } });
    await regenerateRecurringTodos();
    const after = await rawDb.todo.count({ where: { title: "Interval taak na evaluatie" } });
    expect(after).toBe(before);
  });

  it("carries interventionPlanId forward to the regenerated occurrence", async () => {
    const client = await rawDb.client.create({ data: { firstName: "Plan", lastName: "Client" } });
    const plan = await rawDb.interventionPlan.create({
      data: {
        clientId: client.id,
        goal: "doel",
        stepsAanwezigheid: "x",
        stepsVerzet: "x",
        stepsHerstelRelatie: "x",
        stepsSteunSupport: "x",
        stepsDeescalatie: "x",
        startDate: daysAgo(10),
        evaluationDate: daysAgo(-10),
        createdById: USER_ID,
      },
    });
    const anchor = daysAgo(2); // intervalDays=2 → due today
    await rawDb.todo.create({
      data: {
        title: "Plan-taak",
        priority: "MEDIUM",
        intervalDays: 2,
        intervalAnchorDate: anchor,
        recurring: true,
        completed: true,
        completedAt: daysAgo(1),
        createdById: USER_ID,
        interventionPlanId: plan.id,
      },
    });

    await regenerateRecurringTodos();

    const spawned = await rawDb.todo.findFirst({ where: { title: "Plan-taak", completed: false } });
    expect(spawned?.interventionPlanId).toBe(plan.id);
  });
});
