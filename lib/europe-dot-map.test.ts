import { describe, expect, it } from "vitest";
import { EU_MAP_PACKETS, EU_MAP_RIGA, euMapDotCount, euMapRuns } from "@/lib/europe-dot-map";

describe("europe dot map", () => {
  it("keeps all map dots from the approved mockup", () => {
    expect(euMapDotCount()).toBe(3684);
    for (const r of euMapRuns()) {
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.x + r.length).toBeLessThanOrEqual(1000.5);
    }
  });

  it("every packet ends in Riga", () => {
    expect(EU_MAP_PACKETS).toHaveLength(32);
    for (const p of EU_MAP_PACKETS) {
      const [x, y] = p.path[p.path.length - 1];
      expect(x).toBeCloseTo(EU_MAP_RIGA.x, 0);
      expect(y).toBeCloseTo(EU_MAP_RIGA.y, 0);
    }
  });
});
