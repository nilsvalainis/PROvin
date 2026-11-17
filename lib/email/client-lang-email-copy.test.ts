import { describe, expect, it } from "vitest";
import {
  dealerRefundEmailCopy,
  paymentConfirmationCopy,
  resolveClientEmailLang,
} from "@/lib/email/client-lang-email-copy";
import { paymentConfirmationHtml } from "@/lib/email/html-templates";

/** C4 (Nils 06.11): maksājuma un atmaksas e-pasti klienta valodā. */
describe("e-pasti klienta valodā", () => {
  it("valoda no Stripe locale, nezināma - lv", () => {
    expect(resolveClientEmailLang("en")).toBe("en");
    expect(resolveClientEmailLang("de-DE")).toBe("de");
    expect(resolveClientEmailLang("auto")).toBe("lv");
    expect(resolveClientEmailLang(null)).toBe("lv");
  });

  it("maksājums angliski un vāciski - tēma, teksts, HTML", () => {
    const en = paymentConfirmationCopy("en", { amountLine: "99,99 €", vin: "WDC1671191A002835", invoiceUrl: "https://provin.lv/i" });
    expect(en.subject).toBe("PROVIN · Payment received · WDC1671191A002835");
    expect(en.text).toContain("Amount: 99,99 €");
    expect(en.text).not.toMatch(/Summa|Labdien|[—–]/);
    const html = paymentConfirmationHtml({ invoiceUrl: "https://provin.lv/i", amountLine: "99,99 €", vin: "WDC1671191A002835", copy: en });
    expect(html).toContain("Download invoice (PDF)");
    expect(html).not.toContain("Lejupielādēt");
    expect(paymentConfirmationCopy("de", { amountLine: "99,99 €", invoiceUrl: "x" }).subject).toBe("PROVIN · Zahlung erhalten");
  });

  it("atmaksa krieviski - nav datu un atcelts", () => {
    const noData = dealerRefundEmailCopy("ru", { cancelled: false, amount: "24,99 €", vin: "WDC1671191A002835" });
    expect(noData.subject).toBe("PROVIN · Данные дилера недоступны, деньги возвращены · WDC1671191A002835");
    expect(noData.text).toContain("24,99 €");
    const cancelled = dealerRefundEmailCopy("ru", { cancelled: true, amount: "24,99 €" });
    expect(cancelled.subject).toBe("PROVIN · Заказ отменён, деньги возвращены");
    expect(cancelled.text).not.toMatch(/[—–]|Labdien/);
  });
});
