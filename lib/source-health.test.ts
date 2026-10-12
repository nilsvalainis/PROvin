import { describe, expect, it } from "vitest";
import { applySourceOutcomes, emptySourceHealthDoc, sourceHealthColor } from "./source-health";

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
});
