import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { ShiftType } from "@prisma/client";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Parses a "DD-MM-JJJJ" string into a UTC Date at midnight. Returns null when malformed.
export function parseDDMMYYYY(input: string): Date | null {
  const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(input.trim());
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date;
}

export function formatDDMMYYYY(date: Date): string {
  const d = String(date.getUTCDate()).padStart(2, "0");
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const y = date.getUTCFullYear();
  return `${d}-${m}-${y}`;
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("nl-NL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat("nl-NL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatTime(date: Date): string {
  return new Intl.DateTimeFormat("nl-NL", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export function fullName(client: { firstName: string; lastName: string }): string {
  return `${client.firstName} ${client.lastName}`;
}

// --- Shift logic -----------------------------------------------------------
// Morning shift: 07:00-15:00. Evening shift: 14:00-23:00 (overlaps 14:00-15:00).
// Outside those windows (23:00-07:00) we attach the login to the nearest shift.

export function determineShiftType(date: Date = new Date()): ShiftType {
  const hour = date.getHours();
  if (hour >= 7 && hour < 15) return ShiftType.MORNING;
  if (hour >= 15 && hour < 23) return ShiftType.EVENING;
  // Night hours (23:00-07:00): treat as a continuation of the evening shift.
  return ShiftType.EVENING;
}

export function shiftEndForStart(type: ShiftType, startedAt: Date): Date {
  const end = new Date(startedAt);
  if (type === ShiftType.MORNING) {
    end.setHours(15, 0, 0, 0);
  } else {
    end.setHours(23, 0, 0, 0);
  }
  if (end <= startedAt) {
    end.setDate(end.getDate() + 1);
  }
  return end;
}
