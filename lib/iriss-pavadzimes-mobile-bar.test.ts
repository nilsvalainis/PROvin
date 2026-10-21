import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { irissWaybillGauges, WAYBILL_MAX_HOURS } from "@/lib/iriss-waybill-gauges";

describe("IRISS pavadzīmju apļi", () => {
  it("no longer shows plates in the mobile top bar", () => {
    const bar = readFileSync(new URL("../components/admin/IrissPavadzimesMobileBar.tsx", import.meta.url), "utf8");
    expect(bar).toContain("return null;");
  });

  it("puts all 3 dealer plates in one view with hours left on a 48 h scale", () => {
    const now = new Date("2026-10-21T12:00:00Z");
    const gauges = irissWaybillGauges(
      [
        { id: "w1", plate: "B192-7", validUntil: "2026-10-22T12:00:00Z", issuedAt: "2026-10-20T12:00:00Z", brandModel: "MB E350" },
        { id: "w2", plate: "B 193-7", validUntil: "2026-10-21T15:30:00Z", issuedAt: "2026-10-20T15:30:00Z", brandModel: "Toyota Corolla" },
      ],
      now,
    );
    expect(gauges.map((g) => g.plate)).toEqual(["B193-7", "B762-7", "B192-7"]);
    const b193 = gauges[0]!;
    expect(b193).toMatchObject({ busy: true, hoursLeft: 3, brandModel: "Toyota Corolla", id: "w2", status: "soon" });
    expect(gauges[1]).toMatchObject({ busy: false, status: "free" });
    const b192 = gauges[2]!;
    expect(b192.hoursLeft).toBe(24);
    expect(b192.share).toBeCloseTo(24 / WAYBILL_MAX_HOURS);
  });
});
