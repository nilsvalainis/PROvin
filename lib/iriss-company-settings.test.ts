import { describe, expect, it } from "vitest";
import { DEFAULT_LISTING_COSTS } from "@/lib/iriss-listings-cost";
import { DZ_PASUTIJUMS_TERMS_BLOCKS } from "@/lib/dzintarzeme-pasutijums-terms-content";
import {
  buildIrissFooterLinesFromSettings,
  defaultIrissCompanySettings,
  defaultIrissTermsText,
  irissCompanyListingCosts,
  irissCompanyLogoSrc,
  irissTermsBlocksForPdf,
  normalizeIrissCompanySettings,
  parseIrissTermsBlocks,
} from "@/lib/iriss-company-settings";

describe("iriss company settings", () => {
  it("defaults match current LIST costs and leave identity empty for env fallback", () => {
    const s = defaultIrissCompanySettings();
    expect(irissCompanyListingCosts(s)).toEqual(DEFAULT_LISTING_COSTS);
    expect(s.vatPercent).toBe(21);
    expect(s.depositEur).toBe(200);
    expect(s.legalName).toBe("");
    expect(buildIrissFooterLinesFromSettings(s)).toEqual([]);
    expect(irissCompanyLogoSrc(s)).toBe("/brands/dzintarzeme-iriss-offer-pdf-logo.png");
    expect(irissTermsBlocksForPdf(s)).toBe(DZ_PASUTIJUMS_TERMS_BLOCKS);
  });

  it("builds footer lines from company fields when the operator fills them", () => {
    const s = normalizeIrissCompanySettings({
      legalName: "SIA IRISS",
      regNo: "40000000000",
      phone: "+371 20000000",
      email: "info@example.com",
    });
    expect(buildIrissFooterLinesFromSettings(s)).toEqual([
      "SIA IRISS",
      "Reģ. nr.: 40000000000",
      "+371 20000000",
      "info@example.com",
    ]);
  });

  it("keeps built-in terms when the saved text is the default dump", () => {
    const s = normalizeIrissCompanySettings({ termsText: defaultIrissTermsText() });
    expect(irissTermsBlocksForPdf(s)).toBe(DZ_PASUTIJUMS_TERMS_BLOCKS);
    const parsed = parseIrissTermsBlocks("1. Komisijas maksa\nA variants.\n- VIN un CSDD.");
    expect(parsed[0]).toEqual({ kind: "h", text: "1. Komisijas maksa" });
    expect(parsed[1]).toEqual({ kind: "p", text: "A variants." });
    expect(parsed[2]).toEqual({ kind: "b", items: ["VIN un CSDD."] });
  });

  it("does not invent values from unknown JSON keys", () => {
    const s = normalizeIrissCompanySettings({ commission: "1190", extra: "nope" });
    expect(s.commission).toBe(1190);
    expect(s.transport).toBe(800);
  });
});
