import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import {
  whatsappPrefillDealerNoDataRefunded,
  whatsappPrefillReportReady,
  whatsappPrefillSelectConsultation,
} from "@/lib/admin-whatsapp-messages";
import { previewMessage } from "@/lib/messages/resolve-message";
import { renderWhatsappPrefillText } from "@/lib/messages/whatsapp-prefill-server";
import { buildWaReportReadyVars, waReportReadyTemplateId } from "@/lib/messages/template-vars";

describe("whatsapp prefill server render", () => {
  it("matches legacy report-ready prefills", () => {
    for (const kind of ["audits", "mini", "dealer"] as const) {
      const vin = "WVWZZZ1KZAW000123";
      const legacy = whatsappPrefillReportReady({ kind, vin });
      const api = renderWhatsappPrefillText({ templateId: waReportReadyTemplateId(kind), kind, vin });
      expect(api).toBe(legacy);
      expect(previewMessage(waReportReadyTemplateId(kind), buildWaReportReadyVars({ kind, vin }))?.text).toBe(legacy);
    }
  });

  it("matches SELECT consultation template", () => {
    const legacy = whatsappPrefillSelectConsultation();
    expect(renderWhatsappPrefillText({ templateId: "wa.select_consultation" })).toBe(legacy);
    expect(previewMessage("wa.select_consultation")?.text).toBe(legacy);
  });

  it("matches dealer refund prefill", () => {
    const legacy = whatsappPrefillDealerNoDataRefunded("WVWZZZ1KZAW000123", "24,99 €");
    expect(
      renderWhatsappPrefillText({
        templateId: "wa.dealer.no_data_refunded",
        vin: "WVWZZZ1KZAW000123",
        summa: "24,99 €",
      }),
    ).toBe(legacy);
  });

  it("listing peek uses template API", () => {
    const text = renderWhatsappPrefillText({ templateId: "wa.listing_peek" });
    expect(text).toBe(previewMessage("wa.listing_peek")?.text);
    expect(text?.length).toBeGreaterThan(20);
  });
});
