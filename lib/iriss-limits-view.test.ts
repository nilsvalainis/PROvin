import { describe, expect, it } from "vitest";
import {
  formatIrissLimitsSpend,
  irissLimitsIsStale,
  irissLimitsPercent,
  irissLimitsTone,
  irissLimitsWorstTone,
} from "@/lib/iriss-limits-view";

describe("iriss limits view", () => {
  it("formats spend and picks warn/bad tones", () => {
    expect(formatIrissLimitsSpend(4.3, 4.5)).toBe("4,30 $ / 4,50 $");
    expect(irissLimitsPercent(4.3, 4.5)).toBeGreaterThan(95);
    expect(irissLimitsTone(79)).toBe("ok");
    expect(irissLimitsTone(80)).toBe("warn");
    expect(irissLimitsTone(95)).toBe("bad");
    expect(irissLimitsWorstTone(["ok", "warn"])).toBe("warn");
    expect(irissLimitsIsStale(new Date(Date.now() - 27 * 60 * 60 * 1000).toISOString())).toBe(true);
    expect(irissLimitsIsStale(new Date().toISOString())).toBe(false);
  });
});
