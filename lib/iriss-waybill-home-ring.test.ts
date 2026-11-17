import { describe, expect, it } from "vitest";
import { waybillHomeRingColor, waybillHomeRingTone } from "@/lib/iriss-waybill-home-ring";

describe("waybillHomeRingTone", () => {
  it("12-48 h ir zaļš, ~8 h oranžs, ~2 h sarkans, brīvs pelēks", () => {
    expect(waybillHomeRingTone(48)).toBe("ok");
    expect(waybillHomeRingTone(36)).toBe("ok");
    expect(waybillHomeRingTone(12)).toBe("ok");
    expect(waybillHomeRingTone(11)).toBe("soon");
    expect(waybillHomeRingTone(8)).toBe("soon");
    expect(waybillHomeRingTone(3)).toBe("soon");
    expect(waybillHomeRingTone(2)).toBe("urgent");
    expect(waybillHomeRingTone(0)).toBe("urgent");
    expect(waybillHomeRingTone(20, false)).toBe("free");
  });

  it("dod luksofora krāsas, ne zaļo slēdža toni brīvajam", () => {
    expect(waybillHomeRingColor(36)).toBe("#34c759");
    expect(waybillHomeRingColor(8)).toBe("#ff9500");
    expect(waybillHomeRingColor(2)).toBe("#ff3b30");
    expect(waybillHomeRingColor(0, false)).toBe("#c7c7cc");
  });
});
