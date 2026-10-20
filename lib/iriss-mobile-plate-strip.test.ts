import { describe, expect, it } from "vitest";
import { rigaLocalToUtc } from "@/lib/iriss-pavadzimes-parse";
import { irissMobilePlateBusyCount, irissMobilePlateStripItems } from "@/lib/iriss-mobile-plate-strip";

describe("IRISS mobile plate strip", () => {
  const now = rigaLocalToUtc(2026, 10, 20, 16, 50)!;

  it("shows all three plates with hours or Brīvs, never a waybill number", () => {
    const items = irissMobilePlateStripItems(
      [
        {
          number: "P02799",
          plate: "B1937",
          brandModel: "Volvo V50",
          validUntil: rigaLocalToUtc(2026, 10, 22, 11, 50)!.toISOString(),
          issuedAt: rigaLocalToUtc(2026, 10, 18, 15, 59)!.toISOString(),
        },
        {
          number: "P02801",
          plate: "B762-7",
          brandModel: "Audi A6",
          validUntil: rigaLocalToUtc(2026, 10, 21, 10, 50)!.toISOString(),
          issuedAt: rigaLocalToUtc(2026, 10, 19, 10, 0)!.toISOString(),
        },
      ],
      now,
    );
    expect(items.map((row) => row.plate)).toEqual(["B193-7", "B762-7", "B192-7"]);
    expect(items[0]).toMatchObject({ busy: true, hoursLeft: 43, statusLabel: "43 h" });
    expect(items[1]).toMatchObject({ busy: true, hoursLeft: 18, statusLabel: "18 h" });
    expect(items[2]).toMatchObject({ busy: false, hoursLeft: null, statusLabel: "Brīvs" });
    expect(irissMobilePlateBusyCount(items)).toBe(2);
    const blob = JSON.stringify(items);
    expect(blob).not.toMatch(/P02799|P02801/);
    expect(blob).not.toMatch(/Volvo|Audi/);
  });
});
