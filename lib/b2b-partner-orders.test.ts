import { describe, expect, it } from "vitest";
import {
  buildPartnerOrderNotes,
  formatB2bArchiveAmount,
  formatB2bPartnerOrderDate,
  b2bPackInfoLabelLv,
  isB2bPackAdminOrder,
  isPartnerHighlightAdminOrder,
  parsePartnerAuditPurposeFromNotes,
  parsePartnerCheckoutLineFromNotes,
  parsePartnerCompanyFromNotes,
  parsePartnerIdFromNotes,
  partnerAuditPurposeLabelLv,
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

  it("parses partner id, company and checkout line from notes", () => {
    const notes = buildPartnerOrderNotes({
      plan: "business",
      partnerId: "ptr_0123456789abcdef",
      lotId: "lot_1",
      companyName: "SIA Demo Auto",
      auditPurpose: "internal",
    });
    expect(notes).toContain("partner_id=ptr_0123456789abcdef");
    expect(notes).toContain("partner_company=SIA Demo Auto");
    expect(notes).toContain("audit_purpose=internal");
    expect(parsePartnerIdFromNotes(notes)).toBe("ptr_0123456789abcdef");
    expect(parsePartnerCompanyFromNotes(notes)).toBe("SIA Demo Auto");
    expect(parsePartnerCheckoutLineFromNotes(notes)).toBe("business");
    expect(parsePartnerAuditPurposeFromNotes(notes)).toBe("internal");
    expect(partnerAuditPurposeLabelLv("internal")).toBe("Iekšējai lietošanai");
    expect(partnerAuditPurposeLabelLv("client")).toBe("Klientam");
    expect(isPartnerHighlightAdminOrder({ notes })).toBe(true);
    expect(isPartnerHighlightAdminOrder({ partnerCompanyName: "SIA X" })).toBe(true);
    expect(isPartnerHighlightAdminOrder({ notes: "parasts komentārs" })).toBe(false);
  });

  it("detects B2B credit packs, not VIN jobs", () => {
    expect(
      isB2bPackAdminOrder({ checkoutLine: "business", vin: null, fulfillment: "b2b_pack" }),
    ).toBe(true);
    expect(isB2bPackAdminOrder({ checkoutLine: "dealer", vin: "", isManual: false })).toBe(false);
    expect(
      isB2bPackAdminOrder({
        checkoutLine: "dealer",
        vin: "",
        partnerId: "ptr_0123456789abcdef",
      }),
    ).toBe(true);
    expect(
      isB2bPackAdminOrder({ checkoutLine: "business", vin: "WVWZZZ1JZXW000001", isManual: false }),
    ).toBe(false);
    expect(isB2bPackAdminOrder({ checkoutLine: "audit", vin: null, isManual: true })).toBe(false);
  });

  it("labels pack info rows with product and quantity", () => {
    expect(b2bPackInfoLabelLv({ checkoutLine: "business", packQty: 1 })).toBe("Paka · PROVIN BUSINESS × 1");
    expect(b2bPackInfoLabelLv({ checkoutLine: "dealer", packQty: 10 })).toBe("Paka · Dīlera dati × 10");
  });
});
