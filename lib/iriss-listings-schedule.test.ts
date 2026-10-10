import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  IRISS_LISTINGS_CRON_UTC_SCHEDULE,
  irissListingsAutomaticSlot,
  irissListingsClockInContinuationWindow,
  irissListingsSlotStartUtc,
  isIrissListingsAutomaticSlot,
  isIrissListingsContinuationWindow,
  nextIrissListingsAutomaticReadLabel,
  rigaDateTimeParts,
} from "@/lib/iriss-listings-schedule";

function utc(iso: string): Date {
  return new Date(iso);
}

describe("IRISS LIST automatic schedule", () => {
  it("vercel.json uses one DST-safe UTC cron every ~2 h of Riga daytime", () => {
    const vercel = JSON.parse(readFileSync(path.join(process.cwd(), "vercel.json"), "utf8")) as {
      crons: Array<{ path: string; schedule: string }>;
    };
    const listings = vercel.crons.filter((c) => c.path === "/api/cron/iriss-listings-daily-sync");
    expect(listings).toHaveLength(1);
    expect(listings[0]!.schedule).toBe(IRISS_LISTINGS_CRON_UTC_SCHEDULE);
    expect(listings[0]!.schedule).toBe("*/6 5-19 * * *");
    expect(vercel.crons.length).toBeLessThanOrEqual(100);
  });

  it("winter UTC+2: 06/08/10/12/14/16/18 UTC are 08-20 Riga even hours", () => {
    expect(rigaDateTimeParts(utc("2026-01-15T06:00:00.000Z"))).toMatchObject({ hour: 8, day: "15" });
    expect(irissListingsAutomaticSlot(utc("2026-01-15T06:00:00.000Z"))).toBe("2026-01-15T08");
    expect(irissListingsAutomaticSlot(utc("2026-01-15T08:00:00.000Z"))).toBe("2026-01-15T10");
    expect(irissListingsAutomaticSlot(utc("2026-01-15T10:00:00.000Z"))).toBe("2026-01-15T12");
    expect(irissListingsAutomaticSlot(utc("2026-01-15T18:00:00.000Z"))).toBe("2026-01-15T20");
    expect(irissListingsAutomaticSlot(utc("2026-01-15T07:00:00.000Z"))).toBeNull();
  });

  it("summer UTC+3: 05/07/09/11/13/15/17 UTC are 08-20 Riga even hours", () => {
    expect(rigaDateTimeParts(utc("2026-07-15T05:00:00.000Z"))).toMatchObject({ hour: 8, day: "15" });
    expect(irissListingsAutomaticSlot(utc("2026-07-15T05:00:00.000Z"))).toBe("2026-07-15T08");
    expect(irissListingsAutomaticSlot(utc("2026-07-15T07:00:00.000Z"))).toBe("2026-07-15T10");
    expect(irissListingsAutomaticSlot(utc("2026-07-15T17:00:00.000Z"))).toBe("2026-07-15T20");
    expect(irissListingsAutomaticSlot(utc("2026-07-15T06:00:00.000Z"))).toBeNull();
  });

  it("next header label walks 08:00-20:00 and skips a slot already run this hour", () => {
    expect(nextIrissListingsAutomaticReadLabel(utc("2026-01-15T05:30:00.000Z"))).toBe("08:00");
    expect(nextIrissListingsAutomaticReadLabel(utc("2026-01-15T06:15:00.000Z"))).toBe("08:00");
    expect(nextIrissListingsAutomaticReadLabel(utc("2026-01-15T06:15:00.000Z"), "2026-01-15T08")).toBe("10:00");
    expect(nextIrissListingsAutomaticReadLabel(utc("2026-01-15T12:00:00.000Z"))).toBe("14:00");
    expect(nextIrissListingsAutomaticReadLabel(utc("2026-01-15T19:00:00.000Z"))).toBe("08:00");
    expect(isIrissListingsAutomaticSlot("2026-10-08T14")).toBe(true);
    expect(isIrissListingsAutomaticSlot("2026-10-08T09")).toBe(false);
    expect(isIrissListingsAutomaticSlot("2026-10-08T13")).toBe(false);
  });

  it("continuation window is ~60 min after the slot, not a second restart", () => {
    expect(irissListingsSlotStartUtc("2026-01-15T08")?.toISOString()).toBe("2026-01-15T06:00:00.000Z");
    expect(irissListingsClockInContinuationWindow(utc("2026-01-15T06:00:00.000Z"))).toBe(false);
    expect(irissListingsClockInContinuationWindow(utc("2026-01-15T06:06:00.000Z"))).toBe(true);
    expect(irissListingsClockInContinuationWindow(utc("2026-01-15T07:00:00.000Z"))).toBe(true);
    expect(irissListingsClockInContinuationWindow(utc("2026-01-15T07:06:00.000Z"))).toBe(false);
    expect(isIrissListingsContinuationWindow(utc("2026-01-15T06:06:00.000Z"), "2026-01-15T08")).toBe(true);
    expect(isIrissListingsContinuationWindow(utc("2026-01-15T07:00:00.000Z"), "2026-01-15T08")).toBe(true);
    expect(isIrissListingsContinuationWindow(utc("2026-01-15T07:06:00.000Z"), "2026-01-15T08")).toBe(false);
    expect(isIrissListingsContinuationWindow(utc("2026-01-15T06:06:00.000Z"), "2026-01-14T20")).toBe(false);
  });
});
