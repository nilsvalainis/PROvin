import { describe, expect, it } from "vitest";
import { buildWaybillCalendar, waybillHistoryForVin } from "@/lib/iriss-waybill-calendar";

const H = 3_600_000;
const now = new Date(2026, 9, 22, 12, 0, 0).getTime(); // vietējais 12:00
const iso = (ms: number) => new Date(ms).toISOString();
const row = (id: string, plate: string, issued: number, until: number, vin = "") => ({
  id,
  number: `N${id}`,
  brandModel: "BMW",
  plate,
  vin,
  issuedAt: iso(issued),
  validUntil: iso(until),
});

describe("pavadzīmju kalendārs", () => {
  it("katram numuram sava josla, pareizi toņi", () => {
    const cal = buildWaybillCalendar(
      [
        row("a", "BA 1234", now - 10 * H, now + 30 * H),
        row("b", "BA 1234", now - 40 * H, now - 2 * H),
        row("c", "BC 9", now - H, now + 5 * H),
        row("d", "BD 7", now + 10 * 24 * H, now + 11 * 24 * H), // ārpus loga
      ],
      now,
    );
    expect(cal.lanes.map((l) => l.plate)).toEqual(["BA1234", "BC9"]);
    const ba = cal.lanes[0]!.segments;
    expect(ba.map((s) => [s.id, s.tone])).toEqual([
      ["b", "expired"],
      ["a", "active"],
    ]);
    expect(cal.lanes[1]!.segments[0]!.tone).toBe("soon");
    expect(cal.days.length).toBe(7);
    expect(cal.nowPct).toBeGreaterThan(5);
    expect(cal.nowPct).toBeLessThan(10);
  });

  it("vēsture pēc VIN: tikai šis auto, jaunākā augšā", () => {
    const rows = [
      row("1", "BA1", now - 100 * H, now - 50 * H, "WBA3A5C50CF256551"),
      row("2", "BA1", now - 10 * H, now + 10 * H, "wba3a5c50cf256551"),
      row("3", "BA1", now - 5 * H, now + 10 * H, "OTHERVIN12345"),
    ];
    expect(waybillHistoryForVin(rows, "WBA3A5C50CF256551").map((r) => r.id)).toEqual(["2", "1"]);
    expect(waybillHistoryForVin(rows, "")).toEqual([]);
  });
});
