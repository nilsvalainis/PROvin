import { describe, expect, it } from "vitest";
import { formatEmailAmountEur, provinEmailSubject } from "@/lib/email/email-subject";
import { buildReportReadyEmailVars } from "@/lib/messages/template-vars";
import { unpaidReminderFallbackCopy } from "@/lib/admin-unpaid-reminder-copy";
import { buildManualOrderPaidEmail } from "@/lib/manual-order-payment";

/** E-pastu sakārtošana 06.11 (Nils "jā"): A tēmas, B summas/teksti. */
describe("e-pastu tēmas un summas", () => {
  it("viens tēmas formāts PROVIN · notikums · produkts · VIN", () => {
    expect(provinEmailSubject("Atskaite gatava", { product: "PROVIN AUDITS", vin: "wdc1671191a002835" })).toBe(
      "PROVIN · Atskaite gatava · PROVIN AUDITS · WDC1671191A002835",
    );
    expect(provinEmailSubject("Maksājums saņemts", { vin: "ABC" })).toBe("PROVIN · Maksājums saņemts");
    expect(provinEmailSubject("Apmaksa saņemta", { product: "  " })).toBe("PROVIN · Apmaksa saņemta");
  });

  it("summas ar komatu un €", () => {
    expect(formatEmailAmountEur("24.99")).toBe("24,99 €");
    expect(formatEmailAmountEur(99.9)).toBe("99,90 €");
    expect(formatEmailAmountEur("1234.5")).toBe("1 234,50 €");
    expect(formatEmailAmountEur(null)).toBe("-");
  });

  it("atgādinājums bez tālruņa un IRISS, ar PROVIN tēmu", () => {
    const c = unpaidReminderFallbackCopy({ vin: "WDC1671191A002835", paymentUrl: "https://www.provin.lv/apmaksa/x" });
    expect(c.subject).toBe("PROVIN · Pasūtījums gaida apmaksu · WDC1671191A002835");
    expect(c.text).not.toMatch(/\+371|29\s?502|IRISS|zvaniet/);
    expect(c.text).toContain("https://www.provin.lv/apmaksa/x");
  });

  it("AUDITS „atskaite gatava” rāda reālos pielikumus", () => {
    const v = buildReportReadyEmailVars({
      kind: "audits",
      vin: "WDC1671191A002835",
      attachmentLines: ["PROVIN_AUDITS_WDC1671191A002835.pdf", "Rekins_PRV-1042.pdf"],
    });
    expect(v.pielikumi).toContain("- PROVIN_AUDITS_WDC1671191A002835.pdf");
    expect(v.pielikumi).toContain("- Rekins_PRV-1042.pdf");
    expect(v.pielikumi).not.toContain("Papildu materiālus");
  });

  it("manuālā pasūtījuma apmaksa saņemta - PROVIN tēma, bez .LV", () => {
    const e = buildManualOrderPaidEmail({ serviceName: "PROVIN AUDITS", amountCents: 9999 });
    expect(e.subject).toBe("PROVIN · Apmaksa saņemta · PROVIN AUDITS");
  });
});
