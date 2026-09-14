import { describe, expect, it } from "vitest";
import {
  formatB2bArchiveAmount,
  formatB2bPartnerOrderDate,
  partnerNotesMatchId,
} from "@/lib/b2b-partner-orders";

describe("b2b partner archive rows", () => {
  it("formats archive amounts without a unicode dash", () => {
    expect(formatB2bArchiveAmount(6999, "eur")).toBe("69,99 €");
    expect(formatB2bArchiveAmount(null, "EUR")).toBe("-");
  });

  it("formats dates for lv and en", () => {
    expect(formatB2bPartnerOrderDate("2026-09-02T10:14:00+03:00", "lv")).toBe("02.09.2026");
    expect(formatB2bPartnerOrderDate("2026-09-02T10:14:00+03:00", "en")).toBe("02/09/2026");
  });

  it("matches partner notes by partner_id", () => {
    expect(partnerNotesMatchId("B2B dealer · partner_id=ptr_0123456789abcdef · lot=lot_1", "ptr_0123456789abcdef")).toBe(
      true,
    );
    expect(partnerNotesMatchId("B2B dealer · partner_id=ptr_0123456789abcdef", "ptr_ffffffffffffffff")).toBe(false);
  });
});
