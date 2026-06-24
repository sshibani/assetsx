import { describe, it, expect } from "vitest";
import { formatDateTime } from "../lib/datetime.js";

const iso = "2026-06-24T13:45:30.000Z";

describe("formatDateTime", () => {
  it("returns empty string for nullish input", () => {
    expect(formatDateTime(null)).toBe("");
    expect(formatDateTime(undefined)).toBe("");
    expect(formatDateTime("")).toBe("");
  });

  it("returns empty string for an invalid date", () => {
    expect(formatDateTime("not-a-date")).toBe("");
  });

  it("formats ISO with the configured UTC timezone", () => {
    expect(
      formatDateTime(iso, { dateTimeFormat: "ISO", timezone: "UTC" }),
    ).toBe("2026-06-24 13:45:30");
  });

  it("respects the timezone offset for ISO format", () => {
    // Europe/Paris is UTC+2 in June (DST).
    expect(
      formatDateTime(iso, { dateTimeFormat: "ISO", timezone: "Europe/Paris" }),
    ).toBe("2026-06-24 15:45:30");
  });

  it("formats EU as day-first 24-hour", () => {
    const out = formatDateTime(iso, {
      dateTimeFormat: "EU",
      timezone: "UTC",
    });
    expect(out).toContain("24/06/2026");
  });

  it("formats US with a 12-hour clock", () => {
    const out = formatDateTime(iso, {
      dateTimeFormat: "US",
      timezone: "UTC",
    });
    expect(out).toMatch(/06\/24\/2026/);
    expect(out.toUpperCase()).toMatch(/PM|AM/);
  });
});
