import { describe, expect, it } from "vitest";
import { computeWaybillLifecycles, sortWaybillsNewestFirst } from "@/lib/iriss-pavadzimes-lifecycle";
import { rigaLocalToUtc } from "@/lib/iriss-pavadzimes-parse";

const iso = (y: number, m: number, d: number, h: number, mi: number) => rigaLocalToUtc(y, m, d, h, mi)!.toISOString();

describe("computeWaybillLifecycles", () => {
  const p02787 = { number: "P02787", plate: "B193-7", issuedAt: iso(2026, 10, 14, 9, 59), validUntil: iso(2026, 10, 14, 15, 59) };
  const p02788 = { number: "P02788", plate: "B193-7", issuedAt: iso(2026, 10, 14, 13, 41), validUntil: iso(2026, 10, 16, 13, 41) };
  const p00741 = { number: "P00741", plate: "B192-7", issuedAt: iso(2026, 10, 14, 18, 3), validUntil: iso(2026, 10, 16, 18, 3) };
  const p02799 = { number: "P02799", plate: "B193-7", issuedAt: iso(2026, 10, 16, 15, 24), validUntil: iso(2026, 10, 18, 15, 24) };

  it("P02787 ir pārtraukta, jo P02788 izdota pirms termiņa beigām", () => {
    const now = new Date(iso(2026, 10, 17, 14, 0));
    const m = computeWaybillLifecycles([p02787, p02788, p00741, p02799], now);
    expect(m.get(p02787)).toEqual({ lifecycle: "interrupted", supersededBy: "P02788" });
    expect(m.get(p02788)?.lifecycle).toBe("expired");
    expect(m.get(p00741)?.lifecycle).toBe("expired");
    expect(m.get(p02799)?.lifecycle).toBe("active");
  });

  it("bez datumiem — unknown", () => {
    const row = { number: "P1", plate: "B193-7", issuedAt: "", validUntil: "" };
    expect(computeWaybillLifecycles([row]).get(row)?.lifecycle).toBe("unknown");
  });

  it("kārto jaunākās augšā", () => {
    expect(sortWaybillsNewestFirst([p02787, p02799, p00741, p02788]).map((r) => r.number)).toEqual([
      "P02799",
      "P00741",
      "P02788",
      "P02787",
    ]);
  });
});
