import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("IRISS mobile waybill bar", () => {
  it("renders mini LV plates with status hours and no waybill number", () => {
    const bar = readFileSync(new URL("../components/admin/IrissPavadzimesMobileBar.tsx", import.meta.url), "utf8");
    const strip = readFileSync(new URL("../components/admin/IrissPavadzimesPlateStrip.tsx", import.meta.url), "utf8");
    expect(bar).toContain("IrissPavadzimesPlateStrip");
    expect(bar).toMatch(/pasutijumi\|scan/);
    expect(bar).toContain("sludinajumi");
    expect(strip).toContain("IrissMiniLvPlate");
    expect(strip).toContain("statusLabel");
    expect(strip).toContain("min-h-11");
    expect(strip).not.toMatch(/formatIrissWaybillChip/);
    expect(strip).not.toMatch(/item\.number/);
  });
});
