import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  IRISS_LISTINGS_CRON_UTC_SCHEDULE,
  irissListingsAutomaticSlot,
  isIrissListingsAutomaticSlot,
  nextIrissListingsAutomaticReadLabel,
  rigaDateTimeParts,
} from "@/lib/iriss-listings-schedule";

function utc(iso: string): Date {
  return new Date(iso);
}

describe("IRISS LIST automatic schedule", () => {
  it("vercel.json uses one DST-safe UTC cron (Pro: 100 jobs, not Hobby daily-only)", () => {
    const vercel = JSON.parse(readFileSync(path.join(process.cwd(), "vercel.json"), "utf8")) as {
      crons: Array<{ path: string; schedule: string }>;
    };
    const listings = vercel.crons.filter((c) => c.path === "/api/cron/iriss-listings-daily-sync");
    expect(listings).toHaveLength(1);
    expect(listings[0]!.schedule).toBe(IRISS_LISTINGS_CRON_UTC_SCHEDULE);
    expect(listings[0]!.schedule).toBe("0 6,7,10,11,14,15 * * *");
    expect(vercel.crons.length).toBeLessThanOrEqual(100);
  });

  it("winter UTC+2: 07/11/15 UTC are 09/13/17 Riga; the other offset hours skip", () => {
    expect(rigaDateTimeParts(utc("2026-01-15T07:00:00.000Z"))).toMatchObject({ hour: 9, day: "15" });
    expect(irissListingsAutomaticSlot(utc("2026-01-15T07:00:00.000Z"))).toBe("2026-01-15T09");
    expect(irissListingsAutomaticSlot(utc("2026-01-15T11:00:00.000Z"))).toBe("2026-01-15T13");
    expect(irissListingsAutomaticSlot(utc("2026-01-15T15:00:00.000Z"))).toBe("2026-01-15T17");
    expect(irissListingsAutomaticSlot(utc("2026-01-15T06:00:00.000Z"))).toBeNull();
    expect(irissListingsAutomaticSlot(utc("2026-01-15T10:00:00.000Z"))).toBeNull();
    expect(irissListingsAutomaticSlot(utc("2026-01-15T14:00:00.000Z"))).toBeNull();
  });

  it("summer UTC+3: 06/10/14 UTC are 09/13/17 Riga; the winter hours skip", () => {
    expect(rigaDateTimeParts(utc("2026-07-15T06:00:00.000Z"))).toMatchObject({ hour: 9, day: "15" });
    expect(irissListingsAutomaticSlot(utc("2026-07-15T06:00:00.000Z"))).toBe("2026-07-15T09");
    expect(irissListingsAutomaticSlot(utc("2026-07-15T10:00:00.000Z"))).toBe("2026-07-15T13");
    expect(irissListingsAutomaticSlot(utc("2026-07-15T14:00:00.000Z"))).toBe("2026-07-15T17");
    expect(irissListingsAutomaticSlot(utc("2026-07-15T07:00:00.000Z"))).toBeNull();
    expect(irissListingsAutomaticSlot(utc("2026-07-15T11:00:00.000Z"))).toBeNull();
    expect(irissListingsAutomaticSlot(utc("2026-07-15T15:00:00.000Z"))).toBeNull();
  });

  it("next header label walks 09:00 / 13:00 / 17:00 and skips a slot already run this hour", () => {
    expect(nextIrissListingsAutomaticReadLabel(utc("2026-01-15T06:30:00.000Z"))).toBe("09:00");
    expect(nextIrissListingsAutomaticReadLabel(utc("2026-01-15T07:15:00.000Z"))).toBe("09:00");
    expect(nextIrissListingsAutomaticReadLabel(utc("2026-01-15T07:15:00.000Z"), "2026-01-15T09")).toBe("13:00");
    expect(nextIrissListingsAutomaticReadLabel(utc("2026-01-15T12:00:00.000Z"))).toBe("17:00");
    expect(nextIrissListingsAutomaticReadLabel(utc("2026-01-15T16:00:00.000Z"))).toBe("09:00");
    expect(isIrissListingsAutomaticSlot("2026-10-08T13")).toBe(true);
    expect(isIrissListingsAutomaticSlot("2026-10-08T10")).toBe(false);
  });
});
