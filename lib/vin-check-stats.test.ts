import { describe, expect, it } from "vitest";
import { applyEvent, eventKeys, lastRigaDates, parseVinCheckDay, rigaDate, rigaMonthDates, summarizeVinCheckDays } from "@/lib/vin-check-stats";

describe("eventKeys", () => {
  it("sekmīgs VIN skaita reģionu, modeli, atmiņu; kļūdainais tikai iznākumu un avotu", () => {
    expect(eventKeys({ type: "check", kind: "vin", outcome: "ok", source: "home", region: "europe", model: "vag", memoryHit: true })).toEqual([
      "check:vin:ok",
      "src:home",
      "region:europe",
      "model:vag",
      "memory:hit",
    ]);
    expect(eventKeys({ type: "check", kind: "vin", outcome: "invalid_length", source: "decoder", region: "europe" })).toEqual(["check:vin:invalid_length", "src:decoder"]);
    expect(eventKeys({ type: "csdd", outcome: "found", caller: "decoder" })).toEqual(["csdd:decoder:found"]);
    expect(eventKeys({ type: "cta", cta: "cta_audit", source: "decoder" })).toEqual(["cta:cta_audit", "cta_src:decoder:cta_audit"]);
  });
});

describe("applyEvent + summarize", () => {
  it("saskaita numurzīmes sekmīgos un neveiksmīgos, CSDD zvanus un CTA", () => {
    let d = { date: "2026-10-29", counts: {} as Record<string, number> };
    d = applyEvent(d, { type: "check", kind: "plate", outcome: "ok", source: "home", region: "europe", model: "csdd" });
    d = applyEvent(d, { type: "check", kind: "plate", outcome: "not_found", source: "home" });
    d = applyEvent(d, { type: "check", kind: "vin", outcome: "ok", source: "decoder", region: "europe", model: "none" });
    d = applyEvent(d, { type: "check", kind: "vin", outcome: "invalid_chars", source: "decoder" });
    d = applyEvent(d, { type: "csdd", outcome: "found", caller: "decoder" });
    d = applyEvent(d, { type: "csdd", outcome: "error", caller: "admin" });
    d = applyEvent(d, { type: "cta", cta: "cta_audit", source: "decoder" });
    const s = summarizeVinCheckDays([d, { date: "2026-10-28", counts: { "check:vin:ok": 3, "region:asia": 3 } }]);
    expect(s.checks).toBe(7);
    expect(s.byKind.plate).toMatchObject({ ok: 1, not_found: 1 });
    expect(s.byKind.vin).toMatchObject({ ok: 4, invalid_chars: 1 });
    expect(s.byRegion).toEqual({ europe: 2, asia: 3 });
    expect(s.byModel).toEqual({ csdd: 1, none: 1 });
    expect(s.bySource).toEqual({ home: 2, decoder: 2 });
    expect(s.csdd.decoder.found).toBe(1);
    expect(s.csdd.admin.error).toBe(1);
    expect(s.csddTotal).toBe(2);
    expect(s.cta.cta_audit).toBe(1);
  });
});

describe("parseVinCheckDay", () => {
  it("izmet svešas atslēgas un sliktas vērtības", () => {
    expect(parseVinCheckDay({ counts: { "check:vin:ok": 2, "evil key": 9, "region:europe": -1, "src:home": "3" } }, "2026-10-29")).toEqual({
      date: "2026-10-29",
      counts: { "check:vin:ok": 2 },
    });
    expect(parseVinCheckDay(null, "2026-10-29")).toEqual({ date: "2026-10-29", counts: {} });
  });
});

describe("Rīgas datumi", () => {
  it("diena pēc Rīgas laika, mēneša dienas līdz šodienai", () => {
    expect(rigaDate(new Date("2026-10-29T22:30:00Z"))).toBe("2026-10-30");
    expect(lastRigaDates(3, new Date("2026-10-29T10:00:00Z"))).toEqual(["2026-10-27", "2026-10-28", "2026-10-29"]);
    const m = rigaMonthDates(new Date("2026-10-03T10:00:00Z"));
    expect(m).toEqual(["2026-10-01", "2026-10-02", "2026-10-03"]);
  });
});
