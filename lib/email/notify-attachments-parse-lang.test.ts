import { describe, expect, it } from "vitest";
import { collectAttachmentsFromFormData } from "@/lib/email/notify-attachments-parse";

function form(): FormData {
  const fd = new FormData();
  fd.append("reportPdf", new File([new Uint8Array([37, 80, 68, 70])], "x.pdf", { type: "application/pdf" }));
  return fd;
}

describe("servera pielikuma nosaukums (audits 20.11)", () => {
  it("Business + EN", async () => {
    const r = await collectAttachmentsFromFormData(form(), { auditReportVin: "WVWZZZ1JZXW000001", checkoutLine: "business", lang: "en" });
    expect(r.attachments[0]!.filename).toBe("PROVIN_BUSINESS_WVWZZZ1JZXW000001_EN.pdf");
  });
  it("Dīlera dati, LV bez galotnes", async () => {
    const r = await collectAttachmentsFromFormData(form(), { auditReportVin: "WVWZZZ1JZXW000001", checkoutLine: "dealer" });
    expect(r.attachments[0]!.filename).toBe("OFICIALA_DILERA_DATI_WVWZZZ1JZXW000001.pdf");
  });
});
