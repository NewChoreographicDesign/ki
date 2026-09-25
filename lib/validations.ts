import { z } from "zod";
import { SETTING_KEYS } from "@/lib/utils";

const ddmmyyyy = /^\d{2}-\d{2}-\d{4}$/;

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
  // Optional at creation — lets an admin pre-link an account to their
  // Microsoft email so SSO can match it on that person's very first
  // login, rather than requiring them to first log in with
  // naam+geboortedatum and set it themselves via Mijn account.
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

const timeOfDay = /^([01]\d|2[0-3]):[0-5]\d$/;

export const todoSchema = z
  .object({
    title: z.string().trim().min(1).max(300),
    description: z.string().trim().max(2000).optional().or(z.literal("")),
    priority: z.enum(["NONE", "LOW", "MEDIUM", "HIGH"]),
    daysOfWeek: z.array(z.number().int().min(0).max(6)).max(7).optional(),
    time: z.string().regex(timeOfDay, "Gebruik het formaat UU:MM").optional().or(z.literal("")),
    recurring: z.boolean().optional(),
    // Personal to-do (see app/api/todos/route.ts for who may set this to
    // someone other than themselves) — omitted/empty keeps today's behavior
    // of a shared team task on the Werklijst.
    assignedToId: z.string().optional().or(z.literal("")),
    room: z.string().trim().max(100).optional().or(z.literal("")),
  })
  .refine((data) => !data.recurring || (data.daysOfWeek && data.daysOfWeek.length > 0), {
    message: "Kies minstens één dag voor een terugkerende taak",
    path: ["daysOfWeek"],
  });

export const todoCompleteSchema = z.object({
  completionNote: z.string().trim().max(1000).optional().or(z.literal("")),
});

export const appointmentSchema = z.object({
  title: z.string().trim().min(1).max(300),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  clientId: z.string().optional().or(z.literal("")),
  startAt: z.string().min(1), // ISO datetime-local string
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
