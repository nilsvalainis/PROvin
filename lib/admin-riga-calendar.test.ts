import { describe, expect, it } from "vitest";
import {
  currentRigaYearMonth,
  formatLvYearMonth,
  formatYearMonthKey,
  isoInRigaYearMonth,
  parseYearMonthKey,
  rigaCalendarDayKey,
  rigaYearMonthKey,
  shiftYearMonth,
} from "@/lib/admin-riga-calendar";

describe("admin-riga-calendar", () => {
  it("formats Riga calendar day as YYYY-MM-DD", () => {
    // 2026-10-13 08:00 Riga (vasara UTC+3)
    const ms = Date.parse("2026-10-13T05:00:00.000Z");
    expect(rigaCalendarDayKey(ms)).toBe("2026-10-13");
    expect(rigaYearMonthKey(ms)).toBe("2026-10");
  });

  it("keeps late evening in the Riga day, not UTC next day", () => {
    const ms = Date.parse("2026-10-13T21:30:00.000Z");
    expect(rigaCalendarDayKey(ms)).toBe("2026-10-14");
  });

  it("parses and shifts year-month", () => {
    expect(parseYearMonthKey("2026-10")).toEqual({ year: 2026, month: 10 });
    expect(parseYearMonthKey("2026-13")).toBeNull();
    expect(parseYearMonthKey("nope")).toBeNull();
    expect(shiftYearMonth(2026, 1, -1)).toEqual({ year: 2025, month: 12 });
    expect(shiftYearMonth(2026, 12, 1)).toEqual({ year: 2027, month: 1 });
    expect(formatYearMonthKey(2026, 3)).toBe("2026-03");
  });

  it("classifies ISO timestamps against a Riga month", () => {
    expect(isoInRigaYearMonth("2026-10-01T00:30:00.000Z", 2026, 10)).toBe(true);
    expect(isoInRigaYearMonth("2026-09-30T21:30:00.000Z", 2026, 10)).toBe(true);
    expect(isoInRigaYearMonth("2026-09-30T20:30:00.000Z", 2026, 10)).toBe(false);
    expect(isoInRigaYearMonth("bad", 2026, 10)).toBe(false);
  });

  it("labels the month in Latvian and defaults to current Riga month", () => {
    expect(formatLvYearMonth(2026, 10)).toBe("2026. gada oktobris");
    const now = Date.parse("2026-01-15T10:00:00.000Z");
    expect(currentRigaYearMonth(now)).toEqual({ year: 2026, month: 1 });
  });
});
