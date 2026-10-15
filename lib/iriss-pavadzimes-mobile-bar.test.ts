import { describe, expect, it } from "vitest";
import { rigaLocalToUtc } from "@/lib/iriss-pavadzimes-parse";
import { irissWaybillMobileBarItems } from "@/lib/iriss-pavadzimes-mobile-bar";

describe("IRISS mobile waybill bar", () => {
  const now = rigaLocalToUtc(2026, 10, 14, 12, 0)!;

  it("shows remaining days and marks near-expiry in red", () => {
    const items = irissWaybillMobileBarItems(
      [
        { id: "a", plate: "B193-7", validUntil: rigaLocalToUtc(2026, 10, 17, 12, 0)!.toISOString() },
        { id: "b", plate: "C100-1", validUntil: rigaLocalToUtc(2026, 10, 14, 18, 0)!.toISOString() },
        { id: "c", plate: "", validUntil: rigaLocalToUtc(2026, 10, 13, 12, 0)!.toISOString() },
      ],
      now,
    );
    expect(items).toEqual([
      { id: "a", plate: "B193-7", daysLabel: "3 d", urgent: false },
      { id: "b", plate: "C100-1", daysLabel: "šodien", urgent: true },
      { id: "c", plate: "Pavadzīme", daysLabel: "0 d", urgent: true },
    ]);
  });
});
