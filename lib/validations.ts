import { z } from "zod";

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
});

export const settingSchema = z.object({
  key: z.string().trim().min(1).max(100),
  value: z.string().trim().max(2000),
});

export const reportSchema = z.object({
  clientId: z.string().min(1),
  shift: z.enum(["MORNING", "EVENING"]),
  date: z.string().regex(ddmmyyyy),
  content: z.string().trim().min(3).max(5000),
});

export const medicationSchema = z.object({
  clientId: z.string().min(1),
  name: z.string().trim().min(1).max(200),
  dosage: z.string().trim().min(1).max(200),
  instructions: z.string().trim().max(1000).optional().or(z.literal("")),
  times: z.string().trim().min(1).max(200),
  active: z.boolean().optional(),
});

export const medicationCheckSchema = z.object({
  medicationId: z.string().min(1),
  status: z.enum(["TAKEN", "LEAVE", "NOT_TAKEN"]),
  comment: z.string().trim().max(1000).optional().or(z.literal("")),
});

export const presenceSchema = z.object({
  clientId: z.string().min(1),
  date: z.string().regex(ddmmyyyy),
  present: z.boolean(),
  comment: z.string().trim().max(1000).optional().or(z.literal("")),
});

export const handoverSchema = z.object({
  content: z.string().trim().min(3).max(5000),
});

export const todoSchema = z.object({
  title: z.string().trim().min(1).max(300),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]),
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


export const weekPlanSchema = z.object({
  clientId: z.string().min(1),
  userId: z.string().optional().or(z.literal("")),
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  activity: z.string().trim().min(1).max(300),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
});
