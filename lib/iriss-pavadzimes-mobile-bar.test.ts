import { describe, expect, it } from "vitest";
import { rigaLocalToUtc } from "@/lib/iriss-pavadzimes-parse";
import { irissWaybillMobileBarItems } from "@/lib/iriss-pavadzimes-mobile-bar";

describe("IRISS mobile waybill bar", () => {
  const now = rigaLocalToUtc(2026, 10, 14, 12, 0)!;

  it("formats one-line chips with make/model and hours, filled if under 24 h", () => {
    const items = irissWaybillMobileBarItems(
      [
        {
          id: "a",
          number: "B192-7",
          brandModel: "Audi A6",
          validUntil: rigaLocalToUtc(2026, 10, 14, 18, 0)!.toISOString(),
        },
        {
          id: "b",
          plate: "C100-1",
          brandModel: "BMW",
          validUntil: rigaLocalToUtc(2026, 10, 17, 12, 0)!.toISOString(),
        },
        {
          id: "c",
          plate: "",
          validUntil: rigaLocalToUtc(2026, 10, 13, 12, 0)!.toISOString(),
        },
      ],
      now,
    );
    expect(items[0]).toEqual({ id: "a", label: "B192-7 Audi A6 6 h", urgent: true });
    expect(items[1]).toEqual({ id: "b", label: "C100-1 BMW 72 h", urgent: false });
    expect(items[2].id).toBe("c");
    expect(items[2].urgent).toBe(true);
    expect(items[2].label).toMatch(/0 h$/);
  });
});
