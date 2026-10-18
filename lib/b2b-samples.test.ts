import { describe, expect, it } from "vitest";
import { B2B_WALLET_SAMPLES, resolveB2bWalletSampleUrl, type B2bWalletSampleConfig } from "@/lib/b2b-samples";
import { B2B_WALLET_PRODUCT_IDS, B2B_WALLET_REPORT_LANGS, type B2bWalletProductId } from "@/lib/b2b-wallet";

describe("b2b wallet samples", () => {
  it("keeps Business disabled and RAW/PRO active", () => {
    for (const lang of B2B_WALLET_REPORT_LANGS) {
      expect(resolveB2bWalletSampleUrl("business", lang)).toBeNull();
      expect(resolveB2bWalletSampleUrl("dealer_raw", lang)).toBe("/samples/b2b/dilera-dati-raw-paraugs.pdf");
      expect(resolveB2bWalletSampleUrl("dealer_pro", lang)).toBe(`/samples/b2b/dilera-dati-pro-paraugs-${lang}.pdf`);
    }
  });

  it("PRO follows the selected language and null disables a single language", () => {
    const samples: Record<B2bWalletProductId, B2bWalletSampleConfig> = {
      business: { default: " /samples/b2b/business.pdf " },
      dealer_raw: { default: "" },
      dealer_pro: { default: "/samples/b2b/pro.pdf", byLang: { lv: "/samples/b2b/pro-lv.pdf", ru: null } },
    };
    expect(resolveB2bWalletSampleUrl("business", "lv", samples)).toBe("/samples/b2b/business.pdf");
    expect(resolveB2bWalletSampleUrl("dealer_raw", "lv", samples)).toBeNull();
    expect(resolveB2bWalletSampleUrl("dealer_pro", "lv", samples)).toBe("/samples/b2b/pro-lv.pdf");
    expect(resolveB2bWalletSampleUrl("dealer_pro", "ru", samples)).toBeNull();
    expect(resolveB2bWalletSampleUrl("dealer_pro", "en", samples)).toBe("/samples/b2b/pro.pdf");
  });

  it("only uses site-relative sample paths", () => {
    for (const product of B2B_WALLET_PRODUCT_IDS) {
      for (const lang of B2B_WALLET_REPORT_LANGS) {
        const url = resolveB2bWalletSampleUrl(product, lang);
        if (url) expect(url).toMatch(/^\/samples\/b2b\/[a-z0-9-]+\.pdf$/);
      }
    }
    expect(Object.keys(B2B_WALLET_SAMPLES).sort()).toEqual([...B2B_WALLET_PRODUCT_IDS].sort());
  });
});
