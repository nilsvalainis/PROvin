import { describe, expect, it } from "vitest";
import { buildB2bWalletOrderNoteParts } from "@/lib/b2b-wallet";
import {
  b2bChosenReportLang,
  b2bChosenReportLangLabel,
  isB2bPdfLangLocked,
} from "@/lib/b2b-report-lang-lock";

describe("b2b report language lock", () => {
  it("reads report_lang from stored notes and locks the other buttons", () => {
    const notes = buildB2bWalletOrderNoteParts({
      txnId: "wtx_1_1_abc",
      product: "dealer_pro",
      priceCents: 2499,
      reportLang: "en",
    }).join(" · ");
    expect(b2bChosenReportLang(notes)).toBe("en");
    expect(b2bChosenReportLangLabel(notes)).toBe("EN");
    expect(isB2bPdfLangLocked({ preferredLang: "en", unlocked: false, lang: "en" })).toBe(false);
    expect(isB2bPdfLangLocked({ preferredLang: "en", unlocked: false, lang: "lv" })).toBe(true);
    expect(isB2bPdfLangLocked({ preferredLang: "en", unlocked: false, lang: "de" })).toBe(true);
    expect(isB2bPdfLangLocked({ preferredLang: "en", unlocked: true, lang: "lv" })).toBe(false);
  });

  it("leaves old orders without report_lang unlocked", () => {
    expect(b2bChosenReportLang("B2B dealer · partner_id=ptr_1 · wallet_product=dealer_raw")).toBeNull();
    expect(b2bChosenReportLangLabel(null)).toBeNull();
    expect(isB2bPdfLangLocked({ preferredLang: null, unlocked: false, lang: "ru" })).toBe(false);
  });
});
