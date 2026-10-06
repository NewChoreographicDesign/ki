import "server-only";
import type { z } from "zod";
import { db } from "@/lib/db";
import { formatDaysOfWeek, parseDDMMYYYY } from "@/lib/utils";
import { logAudit } from "@/lib/audit";
import type { createInterventionPlanSchema, interventionPlanEvaluationSchema } from "@/lib/validations";

export class InterventionPlanError extends Error {}

function parseDate(value: string, fieldLabel: string): Date {
  const date = parseDDMMYYYY(value);
  if (!date) throw new InterventionPlanError(`Ongeldige datum (${fieldLabel}).`);
  return date;
}

type PlanContent = z.infer<typeof createInterventionPlanSchema>;
type TaskInput = NonNullable<PlanContent["task"]>;

/**
 * Creates the Werklijst task a new/revised InterventionPlan optionally
 * links — always shared (never assignedToId), always carries showUntil =
 * the plan's own evaluationDate (see Todo.showUntil's schema.prisma
 * comment), regardless of whether it recurs. interventionPlanId is what
 * lets the plan's own page later pull the FULL history of every
 * completed occurrence (see regenerateRecurringTodos, which carries the
 * link forward to each regenerated copy) with one query.
 */
async function createLinkedTask(userId: string, planId: string, task: TaskInput, evaluationDate: Date) {
  return db.todo.create({
    data: {
      title: task.title,
      description: task.description || null,
      priority: task.priority,
      daysOfWeek: formatDaysOfWeek(task.intervalDays ? [] : task.daysOfWeek ?? []),
      intervalDays: task.intervalDays ?? null,
      intervalAnchorDate: task.intervalDays && task.intervalAnchorDate ? parseDate(task.intervalAnchorDate, "startdag interval") : null,
      showUntil: evaluationDate,
      time: task.time || null,
      recurring: task.recurring ?? false,
      createdById: userId,
      interventionPlanId: planId,
    },
  });
}

/**
 * Starts the first InterventionPlan (version 1) for an existing
 * Intervention — see that model's schema.prisma comment for why this is
 * a separate, heavier object rather than extra fields bolted onto
 * Intervention itself.
 */
export async function createInterventionPlan(userId: string, data: z.infer<typeof createInterventionPlanSchema>) {
  const intervention = await db.intervention.findUnique({
    where: { id: data.interventionId },
    select: { id: true, clientId: true },
  });
  if (!intervention) throw new InterventionPlanError("Interventie niet gevonden.");

  const startDate = parseDate(data.startDate, "startdatum");
  const evaluationDate = parseDate(data.evaluationDate, "evaluatiedatum");

  const plan = await db.interventionPlan.create({
    data: {
      interventionId: data.interventionId,
      clientId: intervention.clientId,
      goal: data.goal,
      stepsAanwezigheid: data.stepsAanwezigheid,
      stepsVerzet: data.stepsVerzet,
      stepsHerstelRelatie: data.stepsHerstelRelatie,
      stepsSteunSupport: data.stepsSteunSupport,
      stepsDeescalatie: data.stepsDeescalatie,
      startDate,
      evaluationDate,
      createdById: userId,
    },
  });

  if (data.task) {
    await createLinkedTask(userId, plan.id, data.task, evaluationDate);
  }

  await logAudit({ userId, action: "intervention-plan.create", targetType: "InterventionPlan", targetId: plan.id });

  return plan;
}

export type EvaluateInterventionPlanResult =
  | { decision: "CONTINUE"; plan: Awaited<ReturnType<typeof db.interventionPlan.update>> }
  | { decision: "ADJUSTED"; archivedPlan: Awaited<ReturnType<typeof db.interventionPlan.update>>; newPlan: Awaited<ReturnType<typeof db.interventionPlan.create>> };

/**
 * Records one evaluation moment and applies its decision — see
 * InterventionPlan's own schema.prisma comment for the full CONTINUE vs
 * ADJUSTED picture. Never mutates an already-archived plan (each is only
 * ever evaluated once, by definition — a later look-back at an old
 * version is just reading it, not re-evaluating it).
 */
export async function evaluateInterventionPlan(
  userId: string,
  planId: string,
  data: z.infer<typeof interventionPlanEvaluationSchema>
): Promise<EvaluateInterventionPlanResult> {
  const plan = await db.interventionPlan.findUnique({ where: { id: planId } });
  if (!plan) throw new InterventionPlanError("Interventieplan niet gevonden.");
  if (plan.status !== "ACTIEF") throw new InterventionPlanError("Dit plan is al geëvalueerd en gearchiveerd.");

  const evaluationDate = parseDate(data.date, "evaluatiedatum");

  await db.interventionPlanEvaluation.create({
    data: {
      interventionPlanId: plan.id,
      userId,
      date: evaluationDate,
      pillarsThatHelped: data.pillarsThatHelped.join(","),
      reflection: data.reflection,
      decision: data.decision,
    },
  });

  if (data.decision === "CONTINUE") {
    const nextEvaluationDate = parseDate(data.nextEvaluationDate, "volgende evaluatiedatum");
    const updated = await db.interventionPlan.update({ where: { id: plan.id }, data: { evaluationDate: nextEvaluationDate } });
    // Keep every still-open, plan-linked task's showUntil in step with the
    // plan's new evaluationDate — otherwise a task created back at the
    // plan's start would still vanish from the Werklijst on the old date.
    await db.todo.updateMany({
      where: { interventionPlanId: plan.id, completed: false },
      data: { showUntil: nextEvaluationDate },
    });
    await logAudit({
      userId,
      action: `intervention-plan.evaluate:continue, volgende evaluatie ${data.nextEvaluationDate}`,
      targetType: "InterventionPlan",
      targetId: plan.id,
    });
    return { decision: "CONTINUE", plan: updated };
  }

  const newEvaluationDate = parseDate(data.newPlan.evaluationDate, "evaluatiedatum");
  const [archivedPlan, newPlan] = await db.$transaction(async (tx) => {
    const archived = await tx.interventionPlan.update({
      where: { id: plan.id },
      data: { status: "GEARCHIVEERD", archivedAt: new Date(), archivedById: userId },
    });
    const created = await tx.interventionPlan.create({
      data: {
        interventionId: archived.interventionId,
        clientId: archived.clientId,
        version: archived.version + 1,
        previousPlanId: archived.id,
        goal: data.newPlan.goal,
        stepsAanwezigheid: data.newPlan.stepsAanwezigheid,
        stepsVerzet: data.newPlan.stepsVerzet,
        stepsHerstelRelatie: data.newPlan.stepsHerstelRelatie,
        stepsSteunSupport: data.newPlan.stepsSteunSupport,
        stepsDeescalatie: data.newPlan.stepsDeescalatie,
        startDate: new Date(),
        evaluationDate: newEvaluationDate,
        createdById: userId,
      },
    });
    return [archived, created];
  });

  if (data.newPlan.task) {
    await createLinkedTask(userId, newPlan.id, data.newPlan.task, newEvaluationDate);
  }

  await logAudit({ userId, action: "intervention-plan.evaluate:adjusted", targetType: "InterventionPlan", targetId: plan.id });
  await logAudit({ userId, action: `intervention-plan.create, versie ${newPlan.version}`, targetType: "InterventionPlan", targetId: newPlan.id });

  return { decision: "ADJUSTED", archivedPlan, newPlan };
}
