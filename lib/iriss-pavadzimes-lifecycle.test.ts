import { describe, expect, it } from "vitest";
import { computeWaybillLifecycles, sortWaybillsNewestFirst, waybillLifecycleLabel } from "@/lib/iriss-pavadzimes-lifecycle";
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

  it("jaunāka pavadzīme pēc termiņa beigām nenosauc iepriekšējo par pārtrauktu", () => {
    const first = { number: "P03001", plate: "B193-7", issuedAt: iso(2026, 10, 14, 9, 0), validUntil: iso(2026, 10, 14, 16, 0) };
    const later = { number: "P03002", plate: "B193-7", issuedAt: iso(2026, 10, 14, 17, 0), validUntil: iso(2026, 10, 16, 17, 0) };
    const mid = new Date(iso(2026, 10, 15, 12, 0));
    const after = new Date(iso(2026, 10, 17, 12, 0));
    expect(computeWaybillLifecycles([first, later], mid).get(first)?.lifecycle).toBe("expired");
    expect(computeWaybillLifecycles([first, later], mid).get(later)?.lifecycle).toBe("active");
    expect(computeWaybillLifecycles([first, later], after).get(first)?.lifecycle).toBe("expired");
    expect(computeWaybillLifecycles([first, later], after).get(later)?.lifecycle).toBe("expired");
  });

  it("tas pats numurs un tukša numurzīme negrupējas kā aizvietošana", () => {
    const a = { number: "P03010", plate: "B193-7", issuedAt: iso(2026, 10, 14, 9, 0), validUntil: iso(2026, 10, 16, 9, 0) };
    const sameNo = { number: "P03010", plate: "B193-7", issuedAt: iso(2026, 10, 14, 12, 0), validUntil: iso(2026, 10, 16, 12, 0) };
    const noPlate = { number: "P03011", plate: "", issuedAt: iso(2026, 10, 14, 10, 0), validUntil: iso(2026, 10, 16, 10, 0) };
    const now = new Date(iso(2026, 10, 15, 12, 0));
    const m = computeWaybillLifecycles([a, sameNo, noPlate], now);
    expect(m.get(a)?.lifecycle).toBe("active");
    expect(m.get(sameNo)?.lifecycle).toBe("active");
    expect(m.get(noPlate)?.lifecycle).toBe("active");
  });

  it("termiņa beigu milisekundē vēl derīga, pēc tam expired; etiķetes ir latviski", () => {
    const row = { number: "P03020", plate: "B192-7", issuedAt: iso(2026, 10, 14, 9, 0), validUntil: iso(2026, 10, 16, 13, 41) };
    const atEnd = new Date(iso(2026, 10, 16, 13, 41));
    const justAfter = new Date(atEnd.getTime() + 1);
    expect(computeWaybillLifecycles([row], atEnd).get(row)?.lifecycle).toBe("active");
    expect(computeWaybillLifecycles([row], justAfter).get(row)?.lifecycle).toBe("expired");
    expect(waybillLifecycleLabel("interrupted")).toBe("Pārtraukta");
    expect(waybillLifecycleLabel("expired")).toBe("Beigusies");
    expect(waybillLifecycleLabel("active")).toBe("Derīga");
    expect(waybillLifecycleLabel("unknown")).toBe("");
    expect(waybillLifecycleLabel(undefined)).toBe("");
  });

  it("saraksts (arī derīgās) atveras ar jaunāko, nevis ar to, kam termiņš beidzas pirmais vai vecāko", () => {
    // Vecāka pavadzīme ar garāku termiņu (72 h) un jaunāka ar 1 h: augšā jaunākā izdotā.
    const old72 = { number: "P02809", plate: "B762-7", issuedAt: iso(2026, 10, 22, 9, 0), validUntil: iso(2026, 10, 25, 9, 0) };
    const new1 = { number: "P02811", plate: "B193-7", issuedAt: iso(2026, 10, 23, 14, 0), validUntil: iso(2026, 10, 23, 15, 0) };
    const mid = { number: "P02810", plate: "B192-7", issuedAt: iso(2026, 10, 23, 8, 0), validUntil: iso(2026, 10, 24, 8, 0) };
    expect(sortWaybillsNewestFirst([old72, mid, new1]).map((r) => r.number)).toEqual(["P02811", "P02810", "P02809"]);
  });
});
