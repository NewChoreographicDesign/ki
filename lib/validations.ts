import { z } from "zod";
import { SETTING_KEYS } from "@/lib/utils";

const ddmmyyyy = /^\d{2}-\d{2}-\d{4}$/;
const timeOfDay = /^([01]\d|2[0-3]):[0-5]\d$/;

// 2 ("om de dag") through 6 — see Todo.intervalDays's own schema.prisma comment.
const intervalDaysField = z.union([z.literal(2), z.literal(3), z.literal(4), z.literal(5), z.literal(6)]);

export const loginSchema = z.object({
  name: z.string().trim().min(2).max(100),
  birthDate: z.string().regex(ddmmyyyy, "Gebruik het formaat DD-MM-JJJJ"),
});

// One-time first-run setup: creates the very first (admin) account and the
// two required email settings. The API route refuses to run this a second
// time once any user exists, so this never becomes a standing attack surface.
export const setupSchema = z.object({
  name: z.string().trim().min(2).max(100),
  birthDate: z.string().regex(ddmmyyyy, "Gebruik het formaat DD-MM-JJJJ"),
});

export const clientSchema = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  dateOfBirth: z.string().regex(ddmmyyyy).optional().or(z.literal("")),
  room: z.string().trim().max(100).optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
  active: z.boolean().optional(),
});

export const userSchema = z.object({
  name: z.string().trim().min(2).max(100),
  birthDate: z.string().regex(ddmmyyyy, "Gebruik het formaat DD-MM-JJJJ"),
  role: z.enum(["ADMIN", "COORDINATOR", "EMPLOYEE"]),
  active: z.boolean().optional(),
  // Optional contact email, settable at creation or later.
  email: z.union([z.string().trim().email("Ongeldig e-mailadres"), z.literal("")]).optional(),
});

// Self-service email (Mijn account) AND admin edit (Medewerkers) share
// this shape — same rules either way, just a different actor/route.
export const setEmailSchema = z.object({
  email: z.union([z.string().trim().email("Ongeldig e-mailadres"), z.literal("")]),
});

export const mfaVerifySchema = z.object({
  code: z.string().trim().min(4).max(20),
});

export const mfaConfirmSchema = z.object({
  code: z.string().trim().regex(/^\d{6}$/, "Voer de 6-cijferige code in"),
});

// Step-up confirmation for disabling MFA — same reasoning as
// changeBirthDateSchema: a valid session cookie on a shared device
// doesn't prove who's actually at the keyboard.
export const mfaDisableSchema = z.object({
  birthDate: z.string().regex(ddmmyyyy, "Gebruik het formaat DD-MM-JJJJ"),
});

// Self-registration for an invaller (flexwerker) account — see
// app/invaller-registratie. No role field (always INVALLER); carries the
// one-time-shared registration code plus which uitzendbureau this person
// is from.
export const invallerRegisterSchema = z.object({
  code: z.string().trim().min(4).max(40),
  name: z.string().trim().min(2).max(100),
  birthDate: z.string().regex(ddmmyyyy, "Gebruik het formaat DD-MM-JJJJ"),
  uitzendbureau: z.string().trim().min(1).max(200),
});

export const settingSchema = z.object({
  key: z.enum(SETTING_KEYS),
  value: z.string().trim().max(2000),
});

// Self-service credential change (/account) — requires the current birthdate
// as step-up confirmation even though the request is already authenticated,
// since a shared-device session left open is enough to reach this page
// otherwise. See app/api/account/birthdate/route.ts.
export const changeBirthDateSchema = z.object({
  currentBirthDate: z.string().regex(ddmmyyyy, "Gebruik het formaat DD-MM-JJJJ"),
  newBirthDate: z.string().regex(ddmmyyyy, "Gebruik het formaat DD-MM-JJJJ"),
});

export const reportSchema = z.object({
  clientId: z.string().min(1),
  shift: z.enum(["MORNING", "EVENING", "NIGHT"]),
  date: z.string().regex(ddmmyyyy),
  content: z.string().trim().min(3).max(5000),
});

export const medicationSchema = z
  .object({
    clientId: z.string().min(1),
    name: z.string().trim().min(1).max(200),
    dosage: z.string().trim().min(1).max(200),
    instructions: z.string().trim().max(1000).optional().or(z.literal("")),
    // Required unless asNeeded ("Indien nodig") — see the refine below.
    times: z.string().trim().max(200).optional().or(z.literal("")),
    asNeeded: z.boolean().optional(),
    active: z.boolean().optional(),
  })
  .refine((data) => data.asNeeded || !!data.times, {
    message: "Kies tijden of \"Indien nodig\"",
    path: ["times"],
  });

export const medicationCheckSchema = z.object({
  medicationId: z.string().min(1),
  status: z.enum(["TAKEN", "LEAVE", "NOT_TAKEN"]),
  comment: z.string().trim().max(1000).optional().or(z.literal("")),
});

// Anyone can annotate an existing check with a comment (e.g. flagging that a
// button was tapped by mistake) — this never touches the status itself.
export const medicationCheckCommentSchema = z.object({
  comment: z.string().trim().max(1000),
});

// Admin-only status correction — requires the admin's own birthdate as
// step-up confirmation, same reasoning as changeBirthDateSchema: a valid
// session cookie on a shared device doesn't prove who's at the keyboard.
export const medicationCheckStatusSchema = z.object({
  status: z.enum(["TAKEN", "LEAVE", "NOT_TAKEN"]),
  birthDate: z.string().regex(ddmmyyyy, "Gebruik het formaat DD-MM-JJJJ"),
});

// Admin-only reset (delete) of a wrongly logged check, same birthdate gate.
export const medicationCheckResetSchema = z.object({
  birthDate: z.string().regex(ddmmyyyy, "Gebruik het formaat DD-MM-JJJJ"),
});

export const presenceSchema = z.object({
  clientId: z.string().min(1),
  date: z.string().regex(ddmmyyyy),
  present: z.boolean(),
  comment: z.string().trim().max(1000).optional().or(z.literal("")),
});

export const handoverSchema = z.object({
  content: z.string().trim().min(3).max(5000),
  clientId: z.string().optional().or(z.literal("")),
});

export const createInterventionSchema = z.object({
  clientId: z.string().min(1),
  description: z.string().trim().min(3).max(4000),
  goal: z.string().trim().min(3).max(2000),
  stepsTaken: z.string().trim().min(1).max(4000),
  followUpNeeded: z.string().trim().min(1).max(2000),
});

export const createInterventionNoteSchema = z.object({
  content: z.string().trim().min(1).max(4000),
});

const VERBINDEND_GEZAG_PILLARS = ["AANWEZIGHEID", "VERZET", "HERSTEL_RELATIE", "STEUN_SUPPORT", "DEESCALATIE"] as const;

// The task optionally linked to an InterventionPlan — same recurrence
// shape as todoSchema (daysOfWeek XOR intervalDays+intervalAnchorDate,
// only required at all when recurring), minus assignedToId/room (always a
// shared Werklijst task) and showUntil (always derived server-side from
// the plan's own evaluationDate — see app/api/intervention-plans/route.ts).
const interventionPlanTaskSchema = z
  .object({
    title: z.string().trim().min(1).max(300),
    description: z.string().trim().max(2000).optional().or(z.literal("")),
    priority: z.enum(["NONE", "LOW", "MEDIUM", "HIGH"]),
    time: z.string().regex(timeOfDay, "Gebruik het formaat UU:MM").optional().or(z.literal("")),
    recurring: z.boolean().optional(),
    daysOfWeek: z.array(z.number().int().min(0).max(6)).max(7).optional(),
    intervalDays: intervalDaysField.optional(),
    intervalAnchorDate: z.string().regex(ddmmyyyy, "Gebruik het formaat DD-MM-JJJJ").optional().or(z.literal("")),
  })
  .refine((data) => !data.intervalDays || !!data.intervalAnchorDate, {
    message: "Kies een startdag voor het interval",
    path: ["intervalAnchorDate"],
  })
  .refine((data) => !data.recurring || (data.daysOfWeek && data.daysOfWeek.length > 0) || !!data.intervalDays, {
    message: "Kies minstens één dag, of een interval, voor de gekoppelde taak",
    path: ["daysOfWeek"],
  });

// The 5-pillar steps every InterventionPlan needs, shared by the create
// schema below and the "ADJUSTED" branch of interventionPlanEvaluationSchema
// (a revised plan is still a full plan with all 5 filled in — see
// InterventionPlan's own schema.prisma comment on why that's a new row,
// not a patch of the old one).
const interventionPlanContentSchema = z.object({
  goal: z.string().trim().min(1).max(2000),
  stepsAanwezigheid: z.string().trim().min(1).max(2000),
  stepsVerzet: z.string().trim().min(1).max(2000),
  stepsHerstelRelatie: z.string().trim().min(1).max(2000),
  stepsSteunSupport: z.string().trim().min(1).max(2000),
  stepsDeescalatie: z.string().trim().min(1).max(2000),
  evaluationDate: z.string().regex(ddmmyyyy, "Gebruik het formaat DD-MM-JJJJ"),
  task: interventionPlanTaskSchema.optional(),
});

export const createInterventionPlanSchema = interventionPlanContentSchema.extend({
  clientId: z.string().min(1),
  startDate: z.string().regex(ddmmyyyy, "Gebruik het formaat DD-MM-JJJJ"),
});

// CONTINUE just logs the reflection and pushes evaluationDate forward on
// the SAME plan; ADJUSTED logs the reflection against the OLD plan and
// creates a whole new plan version from `newPlan` — see
// app/api/intervention-plans/[id]/evaluate/route.ts.
export const interventionPlanEvaluationSchema = z.discriminatedUnion("decision", [
  z.object({
    decision: z.literal("CONTINUE"),
    date: z.string().regex(ddmmyyyy, "Gebruik het formaat DD-MM-JJJJ"),
    pillarsThatHelped: z.array(z.enum(VERBINDEND_GEZAG_PILLARS)).max(5),
    reflection: z.string().trim().min(1).max(2000),
    nextEvaluationDate: z.string().regex(ddmmyyyy, "Gebruik het formaat DD-MM-JJJJ"),
  }),
  z.object({
    decision: z.literal("ADJUSTED"),
    date: z.string().regex(ddmmyyyy, "Gebruik het formaat DD-MM-JJJJ"),
    pillarsThatHelped: z.array(z.enum(VERBINDEND_GEZAG_PILLARS)).max(5),
    reflection: z.string().trim().min(1).max(2000),
    newPlan: interventionPlanContentSchema,
  }),
]);

export const todoSchema = z
  .object({
    title: z.string().trim().min(1).max(300),
    description: z.string().trim().max(2000).optional().or(z.literal("")),
    priority: z.enum(["NONE", "LOW", "MEDIUM", "HIGH"]),
    daysOfWeek: z.array(z.number().int().min(0).max(6)).max(7).optional(),
    // Alternative to daysOfWeek — a task is never saved with both (see the
    // refine below and Todo.intervalDays's schema.prisma comment).
    intervalDays: intervalDaysField.optional(),
    intervalAnchorDate: z.string().regex(ddmmyyyy, "Gebruik het formaat DD-MM-JJJJ").optional().or(z.literal("")),
    // Only ever set automatically from an InterventionPlan's own
    // evaluationDate (see app/api/intervention-plans/route.ts) — not part
    // of the plain Werklijst form, but still accepted here so editing an
    // already-linked task through the normal PATCH /api/todos/[id] keeps
    // it intact instead of silently clearing it.
    showUntil: z.string().regex(ddmmyyyy, "Gebruik het formaat DD-MM-JJJJ").optional().or(z.literal("")),
    time: z.string().regex(timeOfDay, "Gebruik het formaat UU:MM").optional().or(z.literal("")),
    recurring: z.boolean().optional(),
    // Personal to-do (see app/api/todos/route.ts for who may set this to
    // someone other than themselves) — omitted/empty keeps today's behavior
    // of a shared team task on the Werklijst.
    assignedToId: z.string().optional().or(z.literal("")),
    room: z.string().trim().max(100).optional().or(z.literal("")),
  })
  .refine((data) => !data.intervalDays || !!data.intervalAnchorDate, {
    message: "Kies een startdag voor het interval",
    path: ["intervalAnchorDate"],
  })
  .refine((data) => !data.recurring || (data.daysOfWeek && data.daysOfWeek.length > 0) || !!data.intervalDays, {
    message: "Kies minstens één dag, of een interval, voor een terugkerende taak",
    path: ["daysOfWeek"],
  });

export const todoCompleteSchema = z.object({
  completionNote: z.string().trim().max(1000).optional().or(z.literal("")),
});

const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Gebruik een geldige datum");

// "Herhaling" of an afspraak — see lib/appointment-recurrence.ts for how
// each mode expands. Repeating modes need an end (until or count).
export const appointmentRepeatSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("none") }),
  z.object({
    mode: z.enum(["daily", "weekly", "biweekly", "monthly"]),
    weekdays: z.array(z.number().int().min(1).max(7)).max(7).optional(),
    until: ymd.optional(),
    count: z.number().int().min(2).max(120).optional(),
  }),
  z.object({ mode: z.literal("dates"), dates: z.array(ymd).min(1).max(120) }),
]);

export const appointmentSchema = z.object({
  title: z.string().trim().min(1).max(300),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  clientId: z.string().optional().or(z.literal("")),
  startAt: z.string().min(1), // ISO datetime-local string
  endAt: z.string().optional().or(z.literal("")), // idem; empty = default duration
  repeat: appointmentRepeatSchema.optional(), // create only
  scope: z.enum(["this", "following", "all"]).optional(), // edit/delete of a series
});

export const protocolSchema = z
  .object({
    title: z.string().trim().min(1).max(300),
    content: z.string().trim().max(10000).optional().or(z.literal("")),
    // Restrict to http(s): z.url() alone also accepts javascript:/data: URIs,
    // which would let a stored link execute script when another staff member
    // (including an admin) clicks it — a stored self-XSS vector.
    url: z
      .string()
      .trim()
      .url()
      .refine((value) => /^https?:\/\//i.test(value), "Alleen http(s) links zijn toegestaan")
      .optional()
      .or(z.literal("")),
    clientId: z.string().optional().or(z.literal("")),
  })
  .refine((data) => !!data.content || !!data.url, {
    message: "Vul tekst in of upload een bestand",
    path: ["content"],
  });


export const createDataBreachSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(4000),
  affectedData: z.string().trim().min(1).max(2000),
  affectedPersonsEstimate: z.number().int().min(0).max(1_000_000).optional(),
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  detectedAt: z.string().min(1), // ISO instant, combined client-side from date + time inputs
});

export const updateDataBreachSchema = z.object({
  status: z.enum(["NEW", "ASSESSED", "AP_NOTIFIED", "DATA_SUBJECTS_NOTIFIED", "CLOSED"]).optional(),
  likelyRisk: z.boolean().optional(),
  apNotifiedAt: z.string().min(1).optional(),
  apReference: z.string().trim().max(200).optional().or(z.literal("")),
  dataSubjectsNotifiedAt: z.string().min(1).optional(),
  closedSummary: z.string().trim().max(4000).optional().or(z.literal("")),
});

export const createDataBreachNoteSchema = z.object({
  body: z.string().trim().min(1).max(4000),
});

export const pushSubscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

export const pushUnsubscribeSchema = z.object({
  endpoint: z.string().url(),
});

export const weekPlanSchema = z.object({
  clientId: z.string().min(1),
  userId: z.string().optional().or(z.literal("")),
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  activity: z.string().trim().min(1).max(300),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
});
