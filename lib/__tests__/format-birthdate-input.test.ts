import { describe, it, expect } from "vitest";
import { formatBirthDateInput } from "@/lib/format-birthdate-input";

describe("formatBirthDateInput", () => {
  it("inserts dashes as digits are typed", () => {
    expect(formatBirthDateInput("1")).toBe("1");
    expect(formatBirthDateInput("12")).toBe("12");
    expect(formatBirthDateInput("120")).toBe("12-0");
    expect(formatBirthDateInput("1205")).toBe("12-05");
    expect(formatBirthDateInput("120519")).toBe("12-05-19");
    expect(formatBirthDateInput("12051990")).toBe("12-05-1990");
  });

  it("strips non-digit characters typed by mistake", () => {
    expect(formatBirthDateInput("12-05-1990")).toBe("12-05-1990");
    expect(formatBirthDateInput("ab12cd05ef1990")).toBe("12-05-1990");
  });

  it("caps input at 8 digits (DDMMYYYY)", () => {
    expect(formatBirthDateInput("120519901234")).toBe("12-05-1990");
  });

  it("returns an empty string for empty input", () => {
    expect(formatBirthDateInput("")).toBe("");
  });
});
