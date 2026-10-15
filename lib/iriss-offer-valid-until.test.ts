import { describe, expect, it } from "vitest";
import {
  defaultOfferValidUntilYmd,
  deriveOfferValidUntil,
  formatOfferValidUntilLv,
  isIrissOfferExpired,
  normalizeOfferValidUntil,
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
