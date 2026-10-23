import { describe, expect, it } from "vitest";
import {
  defaultOfferValidUntilYmd,
  deriveOfferValidUntil,
  formatOfferDeadlineLv,
  formatOfferValidUntilLv,
  isIrissOfferExpired,
  isOfferDeadlinePassed,
  normalizeOfferValidUntil,
  normalizeOfferValidUntilAt,
  offerDeadlineMs,
  offerValidUntilYmdFromAt,
  parseOfferDeadlineInput,
  rigaLocalParts,
  rigaLocalToUtcIso,
} from "@/lib/iriss-offer-valid-until";

describe("iriss offer validUntil", () => {
  it("normalizes date strings", () => {
    expect(normalizeOfferValidUntil("2026-10-20")).toBe("2026-10-20");
    expect(normalizeOfferValidUntil("20.10.2026")).toBe("2026-10-20");
    expect(normalizeOfferValidUntil("")).toBe("");
  });

  it("uses validUntil first, else createdAt + offerValidDays", () => {
    expect(deriveOfferValidUntil({ validUntil: "2026-10-20", offerValidDays: "2" })).toBe("2026-10-20");
    expect(deriveOfferValidUntil({ offerValidDays: "3", createdAt: "2026-10-14T08:00:00.000Z" })).toBe("2026-10-17");
  });

  it("marks an offer expired after the Riga end of validUntil", () => {
    const ymd = "2026-10-14";
    expect(isIrissOfferExpired({ validUntil: ymd }, Date.parse("2026-10-14T12:00:00.000Z"))).toBe(false);
    expect(isIrissOfferExpired({ validUntil: ymd }, Date.parse("2026-10-14T20:59:00.000Z"))).toBe(false);
    expect(isIrissOfferExpired({ validUntil: ymd }, Date.parse("2026-10-14T21:00:00.000Z"))).toBe(true);
    expect(formatOfferValidUntilLv(ymd)).toBe("14.10.2026");
  });

  it("defaults a LIST offer to +3 Riga days", () => {
    expect(defaultOfferValidUntilYmd(Date.parse("2026-10-14T10:00:00.000Z"))).toBe("2026-10-17");
  });
});

describe("offer deadline (validUntilAt) Riga time <-> UTC", () => {
  it("converts winter and summer time", () => {
    expect(rigaLocalToUtcIso("2026-10-26", "18:00")).toMatchObject({ ok: true, iso: "2026-10-26T16:00:00.000Z" });
    expect(rigaLocalToUtcIso("2026-07-01", "18:00")).toMatchObject({ ok: true, iso: "2026-07-01T15:00:00.000Z" });
  });

  it("takes the earlier moment for the repeated autumn hour", () => {
    expect(rigaLocalToUtcIso("2026-10-25", "03:30")).toMatchObject({ ok: true, iso: "2026-10-25T00:30:00.000Z" });
    expect(rigaLocalToUtcIso("2026-10-25", "04:00")).toMatchObject({ ok: true, iso: "2026-10-25T02:00:00.000Z" });
  });

  it("rejects the skipped spring hour", () => {
    expect(rigaLocalToUtcIso("2027-03-28", "03:30")).toEqual({ ok: false, error: "nonexistent" });
    expect(rigaLocalToUtcIso("2026-03-29", "03:00")).toEqual({ ok: false, error: "nonexistent" });
    expect(rigaLocalToUtcIso("2026-03-29", "02:59")).toMatchObject({ ok: true, iso: "2026-03-29T00:59:00.000Z" });
    expect(rigaLocalToUtcIso("2026-03-29", "04:00")).toMatchObject({ ok: true, iso: "2026-03-29T01:00:00.000Z" });
  });

  it("rejects bad input", () => {
    expect(rigaLocalToUtcIso("2026-02-30", "10:00")).toEqual({ ok: false, error: "invalid" });
    expect(rigaLocalToUtcIso("2026-10-26", "24:00")).toEqual({ ok: false, error: "invalid" });
    expect(rigaLocalToUtcIso("26.10.2026", "18:00")).toEqual({ ok: false, error: "invalid" });
    expect(rigaLocalToUtcIso("2026-10-26", "")).toEqual({ ok: false, error: "invalid" });
  });

  it("counts real time across the DST night (24.10 18:00 -> 25.10 18:00 = 25 h)", () => {
    const a = rigaLocalToUtcIso("2026-10-24", "18:00");
    const b = rigaLocalToUtcIso("2026-10-25", "18:00");
    if (!a.ok || !b.ok) throw new Error("conversion failed");
    expect((b.ms - a.ms) / 3_600_000).toBe(25);
  });

  it("accepts a decision until the last millisecond", () => {
    const deadline = Date.parse("2026-10-26T16:00:00.000Z");
    expect(isOfferDeadlinePassed(deadline, deadline - 1)).toBe(false);
    expect(isOfferDeadlinePassed(deadline, deadline)).toBe(true);
    expect(isOfferDeadlinePassed(null, deadline + 1)).toBe(false);
  });

  it("formats and derives the Riga date", () => {
    expect(formatOfferDeadlineLv("2026-10-26T16:00:00.000Z")).toBe("26.10.2026 18:00");
    expect(offerValidUntilYmdFromAt("2026-10-26T22:30:00.000Z")).toBe("2026-10-27");
    expect(rigaLocalParts(Date.parse("2026-10-25T00:30:00.000Z"))).toEqual({ ymd: "2026-10-25", hm: "03:30" });
    expect(formatOfferDeadlineLv("")).toBe("");
  });

  it("reads only real ISO deadlines (old offers have none)", () => {
    expect(offerDeadlineMs({})).toBeNull();
    expect(offerDeadlineMs({ validUntilAt: "" })).toBeNull();
    expect(offerDeadlineMs({ validUntilAt: "2026-10-26" })).toBeNull();
    expect(offerDeadlineMs({ validUntilAt: "2026-10-26T16:00:00.000Z" })).toBe(Date.parse("2026-10-26T16:00:00.000Z"));
    expect(normalizeOfferValidUntilAt("nonsense")).toBe("");
  });

  it("checks the admin input window (>= 5 min, <= 180 days)", () => {
    const now = Date.parse("2026-10-23T10:00:00.000Z");
    expect(parseOfferDeadlineInput("2026-10-23", "13:04", now)).toMatchObject({ ok: false, error: "past" });
    expect(parseOfferDeadlineInput("2026-10-23", "13:05", now)).toMatchObject({ ok: true });
    expect(parseOfferDeadlineInput("2027-06-01", "12:00", now)).toMatchObject({ ok: false, error: "too_far" });
    expect(parseOfferDeadlineInput("2027-03-28", "03:30", now)).toMatchObject({
      ok: false,
      error: "nonexistent",
      message: "Šāds laiks neeksistē (pulksteņa pāreja).",
    });
  });
});
