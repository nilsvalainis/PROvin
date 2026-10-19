import { describe, expect, it } from "vitest";
import {
  whatsappPrefillDealerNoDataRefunded,
  whatsappPrefillForOrder,
  whatsappPrefillReportReady,
} from "@/lib/admin-whatsapp-messages";

describe("whatsapp report-ready prefills", () => {
  it("builds dealer text without a consumer discount", () => {
    const t = whatsappPrefillForOrder({
      checkoutLine: "dealer",
      vin: "WAUZZZF44LA062962",
    });
    expect(t).toContain("oficiālā dīlera dati");
    expect(t).not.toMatch(/\(VIN\s/i);
    expect(t).not.toContain("20%");
    expect(t).not.toContain("79,99");
    expect(t).toContain("būšu pateicīgs par īsu atsauksmi");
    expect(t).toContain("Nils");
    expect(t).not.toMatch(/—/);
    expect(t).not.toMatch(/–/);
  });

  it("builds mini and audits without the dealer offer", () => {
    const mini = whatsappPrefillReportReady({ kind: "mini", vin: "ABC" });
    expect(mini).toContain("PROVIN MINI atskaite");
    expect(mini).not.toContain("20%");
    expect(mini).toContain("Nils");

    const audits = whatsappPrefillReportReady({ kind: "audits", vin: "ABC" });
    expect(audits).toContain("PROVIN AUDITS atskaite");
    expect(audits).not.toContain("20%");
    expect(audits).toContain("g.page/r/CamRaT51IPQ_EBM/review");
  });
});

describe("dealer no-data WhatsApp", () => {
  it("keeps refund copy and the new sign-off", () => {
    const t = whatsappPrefillDealerNoDataRefunded("WDB1400511A032828", "24,99 €");
    expect(t).not.toMatch(/\(VIN\s/i);
    expect(t).toContain("Nils");
    expect(t).toContain("PROVIN.LV");
    expect(t).not.toMatch(/—/);
  });
});
