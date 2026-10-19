import { describe, expect, it } from "vitest";
import {
  applyB2bClientBrandText,
  applyB2bInternationalReportChrome,
  B2B_CLIENT_BRAND,
  isB2bClientBrandText,
  isB2bInternationalClientReport,
} from "@/lib/b2b-pdf-brand";

describe("B2B client brand", () => {
  it("rewrites PROVIN.LV to PROVIN and leaves LV3101 alone", () => {
    expect(applyB2bClientBrandText("PROVIN.LV atskaite")).toBe("PROVIN atskaite");
    expect(applyB2bClientBrandText("Tukums, LV3101")).toBe("Tukums, LV3101");
    expect(B2B_CLIENT_BRAND).toBe("PROVIN");
    expect(isB2bClientBrandText("PROVIN")).toBe(true);
    expect(isB2bClientBrandText("PROVIN.LV")).toBe(false);
  });

  it("treats partner notes as international report, not retail business checkout", () => {
    expect(
      isB2bInternationalClientReport({
        notes: "B2B dealer · partner_id=ptr_0123456789abcdef · wallet_product=dealer_pro",
      }),
    ).toBe(true);
    expect(isB2bInternationalClientReport({ notes: "parasts komentārs" })).toBe(false);
    expect(isB2bInternationalClientReport({ partnerCompanyName: "Auto GmbH" })).toBe(true);
  });

  it("strips provider chrome and keeps vehicle-country facts", () => {
    const html = applyB2bInternationalReportChrome(
      [
        "PROVIN.LV",
        "Nils Valainis",
        "Reg.nr. 09118711109",
        "Jana iela 3, Tukums, LV3101, Latvija",
        "info@provin.lv",
        "https://provin.lv",
        "Latvijā ekspluatētiem auto",
        "Pirmā reģistrācija: Latvija",
      ].join(" | "),
    );
    expect(html).toContain("PROVIN");
    expect(html).not.toContain("PROVIN.LV");
    expect(html).not.toContain("Nils Valainis");
    expect(html).not.toContain("09118711109");
    expect(html).not.toContain("Jana iela");
    expect(html).not.toContain("info@");
    expect(html).not.toContain("provin.lv");
    expect(html).not.toContain("Latvijā ekspluatētiem");
    expect(html).toContain("Pirmā reģistrācija: Latvija");
  });
});
