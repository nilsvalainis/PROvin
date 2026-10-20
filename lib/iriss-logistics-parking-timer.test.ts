import { describe, expect, it } from "vitest";
import { logisticsParkingDeadlineTimer } from "@/lib/iriss-logistics-parking-timer";

describe("parking deadline timer", () => {
  it("counts remaining days and hours", () => {
    const now = new Date("2026-10-20T12:00:00");
    const t = logisticsParkingDeadlineTimer("2026-10-22", now);
    expect(t.overdue).toBe(false);
    expect(t.label).toMatch(/vēl 2 d\./);
  });

  it("marks an overdue deadline", () => {
    const now = new Date("2026-10-23T10:00:00");
    const t = logisticsParkingDeadlineTimer("2026-10-20", now);
    expect(t.overdue).toBe(true);
    expect(t.label).toBe("stāvvietas termiņš beidzies");
  });

  it("returns empty when the date is missing", () => {
    expect(logisticsParkingDeadlineTimer("", new Date()).label).toBe("");
  });
});
