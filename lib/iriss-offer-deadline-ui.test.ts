import { describe, expect, it } from "vitest";
import {
  irissOfferListBadge,
  offerDeadlineInputInitial,
  offerDeadlineRemainingLv,
} from "@/lib/iriss-offer-deadline-ui";
import { parseOfferDeadlineInput, rigaLocalToUtcIso } from "@/lib/iriss-offer-valid-until";

const H = 3_600_000;

describe("offerDeadlineRemainingLv", () => {
  it("formats days, hours and minutes", () => {
    const now = Date.parse("2026-10-23T18:14:00.000Z");
    expect(offerDeadlineRemainingLv(now + 2 * 24 * H + 20 * H + 5 * 60_000, now)).toBe("Atlicis 2 d. 20 st.");
    expect(offerDeadlineRemainingLv(now + 3 * H + 15 * 60_000, now)).toBe("Atlicis 3 st. 15 min.");
    expect(offerDeadlineRemainingLv(now + 30_000, now)).toBe("Atlicis 1 min.");
    expect(offerDeadlineRemainingLv(now, now)).toBe("Beidzies");
    expect(offerDeadlineRemainingLv(now - 1, now)).toBe("Beidzies");
  });

  it("counts real time across the autumn DST night (25 h in one Riga day)", () => {
    const from = rigaLocalToUtcIso("2026-10-24", "18:00");
    const to = rigaLocalToUtcIso("2026-10-25", "18:00");
    if (!from.ok || !to.ok) throw new Error("dst");
    expect(to.ms - from.ms).toBe(25 * H);
    expect(offerDeadlineRemainingLv(to.ms, from.ms)).toBe("Atlicis 1 d. 1 st.");
  });
});

describe("offerDeadlineInputInitial", () => {
  it("shows the stored UTC deadline in Riga time", () => {
    expect(offerDeadlineInputInitial({ validUntilAt: "2026-10-26T16:00:00.000Z" })).toEqual({ ymd: "2026-10-26", hm: "18:00" });
    expect(offerDeadlineInputInitial({ validUntilAt: "2026-07-01T15:00:00.000Z" })).toEqual({ ymd: "2026-07-01", hm: "18:00" });
  });

  it("old offers: date from validUntil, time empty", () => {
    expect(offerDeadlineInputInitial({ validUntil: "2026-10-30" })).toEqual({ ymd: "2026-10-30", hm: "" });
    expect(offerDeadlineInputInitial({})).toEqual({ ymd: "", hm: "" });
  });

  it("round-trips through parseOfferDeadlineInput", () => {
    const now = Date.parse("2026-10-23T18:14:00.000Z");
    const r = parseOfferDeadlineInput("2026-10-26", "18:00", now);
    expect(r).toMatchObject({ ok: true, iso: "2026-10-26T16:00:00.000Z" });
    expect(parseOfferDeadlineInput("2027-03-28", "03:30", now)).toMatchObject({ ok: false, error: "nonexistent" });
  });
});

describe("irissOfferListBadge", () => {
  const now = Date.parse("2026-10-23T18:14:00.000Z");
  const base = { offerId: "o1", at: "2026-10-23T18:00:00.000Z", validUntilAt: "2026-10-25T22:14:00.000Z" };
  it("maps decisions, expiry and remaining time", () => {
    expect(irissOfferListBadge({ ...base, status: "approved" }, now)).toEqual({ label: "Apstiprināts", tone: "approved" });
    expect(irissOfferListBadge({ ...base, status: "declined" }, now)).toEqual({ label: "Noraidīts", tone: "declined" });
    expect(irissOfferListBadge({ ...base, status: "sent" }, now)).toEqual({ label: "2 d. 4 st.", tone: "time" });
    expect(irissOfferListBadge({ ...base, status: "sent" }, Date.parse(base.validUntilAt))).toEqual({ label: "Beidzies", tone: "expired" });
  });
  it("no badge for revoked links or old links without a deadline", () => {
    expect(irissOfferListBadge({ ...base, status: "revoked" }, now)).toBeNull();
    expect(irissOfferListBadge({ ...base, status: "sent", validUntilAt: "" }, now)).toBeNull();
    expect(irissOfferListBadge(null, now)).toBeNull();
  });
});
