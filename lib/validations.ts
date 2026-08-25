import { z } from "zod";

const ddmmyyyy = /^\d{2}-\d{2}-\d{4}$/;

export const loginSchema = z.object({
  name: z.string().trim().min(2).max(100),
  birthDate: z.string().regex(ddmmyyyy, "Gebruik het formaat DD-MM-JJJJ"),
});

export const clientSchema = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  dateOfBirth: z.string().regex(ddmmyyyy).optional().or(z.literal("")),
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
  value: z.string().trim().min(1).max(500),
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

export const protocolSchema = z.object({
  title: z.string().trim().min(1).max(300),
  content: z.string().trim().min(1).max(10000),
  clientId: z.string().optional().or(z.literal("")),
});

export const documentSchema = z.object({
  title: z.string().trim().min(1).max(300),
  url: z.string().trim().url(),
  clientId: z.string().optional().or(z.literal("")),
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
