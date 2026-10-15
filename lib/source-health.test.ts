import { describe, expect, it } from "vitest";
import { applySourceOutcomes, emptySourceHealthDoc, sourceHealthColor, sourcesFailingInARow } from "./source-health";

describe("source health", () => {
  it("krāsa pēc pēdējiem rezultātiem", () => {
    const now = Date.parse("2026-10-12T20:00:00Z");
    let d = applySourceOutcomes(emptySourceHealthDoc(), [{ id: "csdd", ok: true, at: "2026-10-10T10:00:00Z" }]);
    expect(sourceHealthColor(d.sources.csdd, now)).toBe("green");
    d = applySourceOutcomes(d, [{ id: "csdd", ok: false, msg: "timeout", at: "2026-10-12T19:00:00Z" }]);
    expect(sourceHealthColor(d.sources.csdd, now)).toBe("red");
    d = applySourceOutcomes(d, [{ id: "csdd", ok: true, at: "2026-10-12T19:30:00Z" }]);
    expect(sourceHealthColor(d.sources.csdd, now)).toBe("orange");
    expect(d.sources.csdd.errors[0]?.msg).toBe("timeout");
    expect(sourceHealthColor(undefined, now)).toBe("gray");
  });

  it("trīs kļūdas pēc kārtas; veiksmīgs zvans nullē sēriju", () => {
    let d = applySourceOutcomes(emptySourceHealthDoc(), [
      { id: "stat_vin", ok: false, msg: "timeout" },
      { id: "csdd", ok: false, msg: "HTTP 500" },
    ]);
    d = applySourceOutcomes(d, [{ id: "stat_vin", ok: false, msg: "timeout" }]);
    expect(sourcesFailingInARow(d, 3)).toEqual([]);
    d = applySourceOutcomes(d, [{ id: "stat_vin", ok: false, msg: "timeout" }]);
    expect(sourcesFailingInARow(d, 3)).toEqual([{ id: "stat_vin", streak: 3, msg: "timeout" }]);
    d = applySourceOutcomes(d, [{ id: "stat_vin", ok: true }]);
    expect(d.sources.stat_vin?.failStreak).toBe(0);
    expect(sourcesFailingInARow(d, 3)).toEqual([]);
  });
});
