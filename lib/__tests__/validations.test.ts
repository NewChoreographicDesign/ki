import { describe, it, expect } from "vitest";
import {
  loginSchema,
  reportSchema,
  medicationSchema,
  medicationCheckSchema,
  presenceSchema,
  todoSchema,
  clientSchema,
  settingSchema,
} from "@/lib/validations";

describe("loginSchema", () => {
  it("accepts a valid login payload", () => {
    const result = loginSchema.safeParse({ name: "Anna Jansen", birthDate: "12-05-1985" });
    expect(result.success).toBe(true);
  });

  it("rejects a birth date not in DD-MM-JJJJ format", () => {
    const result = loginSchema.safeParse({ name: "Anna Jansen", birthDate: "1985-05-12" });
    expect(result.success).toBe(false);
  });

  it("rejects an empty name", () => {
    const result = loginSchema.safeParse({ name: "", birthDate: "12-05-1985" });
    expect(result.success).toBe(false);
  });
});

describe("reportSchema", () => {
  it("accepts a valid report", () => {
    const result = reportSchema.safeParse({
      clientId: "abc",
      shift: "MORNING",
      date: "01-01-2026",
      content: "Alles goed verlopen vandaag.",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid shift value", () => {
    const result = reportSchema.safeParse({
      clientId: "abc",
      shift: "NIGHT",
      date: "01-01-2026",
      content: "Alles goed verlopen vandaag.",
    });
    expect(result.success).toBe(false);
  });

  it("rejects too-short content", () => {
    const result = reportSchema.safeParse({
      clientId: "abc",
      shift: "MORNING",
      date: "01-01-2026",
      content: "ok",
    });
    expect(result.success).toBe(false);
  });
});

describe("medicationSchema", () => {
  it("accepts valid medication data", () => {
    const result = medicationSchema.safeParse({
      clientId: "abc",
      name: "Paracetamol",
      dosage: "500mg",
      times: "08:00,20:00",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing required fields", () => {
    const result = medicationSchema.safeParse({ clientId: "abc", name: "Paracetamol" });
    expect(result.success).toBe(false);
  });
});

describe("medicationCheckSchema", () => {
  it.each(["TAKEN", "LEAVE", "NOT_TAKEN"])("accepts status %s", (status) => {
    const result = medicationCheckSchema.safeParse({ medicationId: "abc", status });
    expect(result.success).toBe(true);
  });

  it("rejects a missing status", () => {
    const result = medicationCheckSchema.safeParse({ medicationId: "abc" });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid status", () => {
    const result = medicationCheckSchema.safeParse({ medicationId: "abc", status: "SKIPPED" });
    expect(result.success).toBe(false);
  });
});

describe("presenceSchema", () => {
  it("accepts a valid presence entry", () => {
    const result = presenceSchema.safeParse({
      clientId: "abc",
      date: "01-01-2026",
      present: true,
    });
    expect(result.success).toBe(true);
  });
});

describe("todoSchema", () => {
  it("accepts a valid todo", () => {
    const result = todoSchema.safeParse({ title: "Voorraad checken", priority: "HIGH" });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid priority", () => {
    const result = todoSchema.safeParse({ title: "Voorraad checken", priority: "URGENT" });
    expect(result.success).toBe(false);
  });

  it("accepts a recurring todo with a day set", () => {
    const result = todoSchema.safeParse({
      title: "Vuilnis buiten zetten",
      priority: "MEDIUM",
      dayOfWeek: 2,
      recurring: true,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a recurring todo without a day", () => {
    const result = todoSchema.safeParse({
      title: "Vuilnis buiten zetten",
      priority: "MEDIUM",
      recurring: true,
    });
    expect(result.success).toBe(false);
  });
});

describe("clientSchema", () => {
  it("accepts a client with only required fields", () => {
    const result = clientSchema.safeParse({ firstName: "Jan", lastName: "Bakker" });
    expect(result.success).toBe(true);
  });

  it("rejects a missing last name", () => {
    const result = clientSchema.safeParse({ firstName: "Jan" });
    expect(result.success).toBe(false);
  });
});

describe("settingSchema", () => {
  it("accepts a known setting key", () => {
    const result = settingSchema.safeParse({ key: "ORG_NAME", value: "Woongroep" });
    expect(result.success).toBe(true);
  });

  it("rejects a key that isn't in the known-settings whitelist", () => {
    const result = settingSchema.safeParse({ key: "ANYTHING_ELSE", value: "x" });
    expect(result.success).toBe(false);
  });
});
