// lib/intervention-plans.ts against a real ephemeral SQLite DB — same
// pattern as lib/__tests__/audit-review.test.ts. The thing worth testing
// here (archiving + versioning on an "aangepast" evaluation, the linked
// task's showUntil staying in step with the plan, audit logging) only
// shows up against a real DB, not a mocked one.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execSync } from "node:child_process";
import { existsSync, unlinkSync } from "node:fs";
import path from "node:path";

const TEST_DB_PATH = path.resolve(__dirname, "../../prisma/intervention-plans-test.db");
const TEST_DATABASE_URL = `file:${TEST_DB_PATH}`;

function cleanupDbFile() {
  for (const suffix of ["", "-journal", "-wal", "-shm"]) {
    const p = TEST_DB_PATH + suffix;
    if (existsSync(p)) unlinkSync(p);
  }
}

let createInterventionPlan: typeof import("@/lib/intervention-plans").createInterventionPlan;
let evaluateInterventionPlan: typeof import("@/lib/intervention-plans").evaluateInterventionPlan;
let InterventionPlanError: typeof import("@/lib/intervention-plans").InterventionPlanError;
let rawDb: typeof import("@/lib/db").db;

const USER_ID = "user-intervention-plans-test";
let clientId: string;

const BASE_CONTENT = {
  goal: "Rustiger reageren bij frustratie",
  stepsAanwezigheid: "Elke ochtend rustig aanwezig zijn op de groep",
  stepsVerzet: "Duidelijk en vastberaden grenzen aangeven zonder straffen",
  stepsHerstelRelatie: "Na een incident een hersteltijd inplannen",
  stepsSteunSupport: "Collega betrekken bij escalatiemomenten",
  stepsDeescalatie: "Op tijd afstand nemen voordat het escaleert",
};

beforeAll(async () => {
  cleanupDbFile();
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  process.env.JWT_SECRET = process.env.JWT_SECRET || "test-only-secret-min-32-characters-long-xxxx";
  execSync("npx prisma db push --skip-generate --accept-data-loss", {
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    stdio: "pipe",
  });

  ({ createInterventionPlan, evaluateInterventionPlan, InterventionPlanError } = await import("@/lib/intervention-plans"));
  ({ db: rawDb } = await import("@/lib/db"));

  await rawDb.user.create({
    data: { id: USER_ID, name: "Begeleider", birthDate: new Date("1980-01-01"), role: "ADMIN" },
  });
  const client = await rawDb.client.create({ data: { firstName: "Jan", lastName: "Jansen" } });
  clientId = client.id;
}, 30000);

afterAll(async () => {
  await rawDb.$disconnect();
  cleanupDbFile();
});

describe("createInterventionPlan", () => {
  it("creates version 1, ACTIEF, for the given client", async () => {
    const plan = await createInterventionPlan(USER_ID, {
      clientId,
      startDate: "01-01-2026",
      evaluationDate: "15-01-2026",
      ...BASE_CONTENT,
    });

    expect(plan.version).toBe(1);
    expect(plan.status).toBe("ACTIEF");
    expect(plan.clientId).toBe(clientId);
    expect(plan.previousPlanId).toBeNull();
  });

  it("rejects an unknown clientId", async () => {
    await expect(
      createInterventionPlan(USER_ID, {
        clientId: "does-not-exist",
        startDate: "01-01-2026",
        evaluationDate: "15-01-2026",
        ...BASE_CONTENT,
      })
    ).rejects.toThrow(InterventionPlanError);
  });

  it("creates the linked task with showUntil equal to the plan's evaluationDate", async () => {
    const plan = await createInterventionPlan(USER_ID, {
      clientId,
      startDate: "01-02-2026",
      evaluationDate: "20-02-2026",
      ...BASE_CONTENT,
      task: {
        title: "Elke 3e dag kort gesprek",
        priority: "MEDIUM",
        recurring: true,
        intervalDays: 3,
        intervalAnchorDate: "01-02-2026",
      },
    });

    const task = await rawDb.todo.findFirst({ where: { interventionPlanId: plan.id } });
    expect(task).not.toBeNull();
    expect(task!.intervalDays).toBe(3);
    expect(task!.showUntil?.toISOString().slice(0, 10)).toBe("2026-02-20");
  });
});

describe("evaluateInterventionPlan — CONTINUE", () => {
  it("keeps the same plan row, pushes evaluationDate forward, and syncs the linked open task's showUntil", async () => {
    const plan = await createInterventionPlan(USER_ID, {
      clientId,
      startDate: "01-03-2026",
      evaluationDate: "15-03-2026",
      ...BASE_CONTENT,
      task: { title: "Dagelijkse check-in", priority: "LOW", recurring: true, daysOfWeek: [0, 1, 2, 3, 4] },
    });

    const result = await evaluateInterventionPlan(USER_ID, plan.id, {
      decision: "CONTINUE",
      date: "15-03-2026",
      pillarsThatHelped: ["AANWEZIGHEID", "STEUN_SUPPORT"],
      reflection: "Rust bleef goed, doorzetten.",
      nextEvaluationDate: "01-04-2026",
    });

    expect(result.decision).toBe("CONTINUE");
    const reloaded = await rawDb.interventionPlan.findUnique({ where: { id: plan.id } });
    expect(reloaded!.status).toBe("ACTIEF");
    expect(reloaded!.evaluationDate.toISOString().slice(0, 10)).toBe("2026-04-01");

    const task = await rawDb.todo.findFirst({ where: { interventionPlanId: plan.id } });
    expect(task!.showUntil?.toISOString().slice(0, 10)).toBe("2026-04-01");

    const evaluations = await rawDb.interventionPlanEvaluation.findMany({ where: { interventionPlanId: plan.id } });
    expect(evaluations).toHaveLength(1);
    expect(evaluations[0].pillarsThatHelped).toBe("AANWEZIGHEID,STEUN_SUPPORT");
  });

  it("rejects evaluating an already-archived plan", async () => {
    const plan = await createInterventionPlan(USER_ID, {
      clientId,
      startDate: "01-05-2026",
      evaluationDate: "15-05-2026",
      ...BASE_CONTENT,
    });
    await evaluateInterventionPlan(USER_ID, plan.id, {
      decision: "ADJUSTED",
      date: "15-05-2026",
      pillarsThatHelped: [],
      reflection: "Werkte niet, bijstellen.",
      newPlan: { ...BASE_CONTENT, evaluationDate: "01-06-2026" },
    });

    await expect(
      evaluateInterventionPlan(USER_ID, plan.id, {
        decision: "CONTINUE",
        date: "16-05-2026",
        pillarsThatHelped: [],
        reflection: "x",
        nextEvaluationDate: "01-06-2026",
      })
    ).rejects.toThrow(InterventionPlanError);
  });
});

describe("evaluateInterventionPlan — ADJUSTED", () => {
  it("archives the old plan and creates a new version chained to it, preserving the evaluation on the old plan", async () => {
    const plan = await createInterventionPlan(USER_ID, {
      clientId,
      startDate: "01-07-2026",
      evaluationDate: "15-07-2026",
      ...BASE_CONTENT,
    });

    const result = await evaluateInterventionPlan(USER_ID, plan.id, {
      decision: "ADJUSTED",
      date: "15-07-2026",
      pillarsThatHelped: ["DEESCALATIE"],
      reflection: "Doel was niet concreet genoeg, aangescherpt.",
      newPlan: {
        ...BASE_CONTENT,
        goal: "Scherper geformuleerd doel",
        evaluationDate: "01-08-2026",
        task: { title: "Nieuwe taak", priority: "HIGH", recurring: true, intervalDays: 2, intervalAnchorDate: "15-07-2026" },
      },
    });

    expect(result.decision).toBe("ADJUSTED");
    if (result.decision !== "ADJUSTED") throw new Error("unreachable");

    expect(result.archivedPlan.status).toBe("GEARCHIVEERD");
    expect(result.archivedPlan.archivedById).toBe(USER_ID);
    expect(result.newPlan.status).toBe("ACTIEF");
    expect(result.newPlan.version).toBe(plan.version + 1);
    expect(result.newPlan.previousPlanId).toBe(plan.id);
    expect(result.newPlan.goal).toBe("Scherper geformuleerd doel");

    // The evaluation is recorded against the OLD plan, not the new one.
    const oldEvaluations = await rawDb.interventionPlanEvaluation.findMany({ where: { interventionPlanId: plan.id } });
    expect(oldEvaluations).toHaveLength(1);
    const newEvaluations = await rawDb.interventionPlanEvaluation.findMany({ where: { interventionPlanId: result.newPlan.id } });
    expect(newEvaluations).toHaveLength(0);

    const newTask = await rawDb.todo.findFirst({ where: { interventionPlanId: result.newPlan.id } });
    expect(newTask).not.toBeNull();
    expect(newTask!.showUntil?.toISOString().slice(0, 10)).toBe("2026-08-01");

    // Both plan versions are still readable afterward — nothing was deleted.
    const bothVersions = await rawDb.interventionPlan.findMany({ where: { clientId }, orderBy: { version: "asc" } });
    expect(bothVersions.map((p) => p.id)).toContain(plan.id);
    expect(bothVersions.map((p) => p.id)).toContain(result.newPlan.id);
  });
});
