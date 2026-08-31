import { describe, it, expect } from "vitest";
import { ipMatchesAny, parseIpList, getRequestIp } from "@/lib/ip-match";

describe("parseIpList", () => {
  it("splits on commas, whitespace and newlines", () => {
    expect(parseIpList("1.2.3.4, 5.6.7.8\n9.10.11.12")).toEqual(["1.2.3.4", "5.6.7.8", "9.10.11.12"]);
  });

  it("returns an empty array for blank input", () => {
    expect(parseIpList("  \n ")).toEqual([]);
  });
});

describe("ipMatchesAny", () => {
  it("matches an exact IP", () => {
    expect(ipMatchesAny("82.171.23.4", ["82.171.23.4"])).toBe(true);
    expect(ipMatchesAny("82.171.23.5", ["82.171.23.4"])).toBe(false);
  });

  it("matches a CIDR range", () => {
    expect(ipMatchesAny("82.171.0.1", ["82.171.0.0/16"])).toBe(true);
    expect(ipMatchesAny("82.172.0.1", ["82.171.0.0/16"])).toBe(false);
  });

  it("matches a /24 range at its edges", () => {
    expect(ipMatchesAny("10.0.0.0", ["10.0.0.0/24"])).toBe(true);
    expect(ipMatchesAny("10.0.0.255", ["10.0.0.0/24"])).toBe(true);
    expect(ipMatchesAny("10.0.1.0", ["10.0.0.0/24"])).toBe(false);
  });

  it("returns false for a null IP", () => {
    expect(ipMatchesAny(null, ["10.0.0.0/24"])).toBe(false);
  });

  it("returns false when no patterns are configured", () => {
    expect(ipMatchesAny("10.0.0.1", [])).toBe(false);
  });

  it("ignores malformed patterns instead of throwing", () => {
    expect(ipMatchesAny("10.0.0.1", ["not-an-ip", "10.0.0.0/99", "10.0.0.1"])).toBe(true);
  });
});

describe("getRequestIp", () => {
  it("takes the first entry of x-forwarded-for", () => {
    const headers = new Map([["x-forwarded-for", "1.2.3.4, 5.6.7.8"]]);
    expect(getRequestIp({ get: (k) => headers.get(k) ?? null })).toBe("1.2.3.4");
  });

  it("falls back to x-real-ip", () => {
    const headers = new Map([["x-real-ip", "9.9.9.9"]]);
    expect(getRequestIp({ get: (k) => headers.get(k) ?? null })).toBe("9.9.9.9");
  });

  it("returns null when neither header is present", () => {
    expect(getRequestIp({ get: () => null })).toBeNull();
  });
});
