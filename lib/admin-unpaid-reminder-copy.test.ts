import { describe, expect, it } from "vitest";
import {
  injectUnpaidReminderPaymentUrl,
  unpaidReminderEmailHtml,
  unpaidReminderFallbackCopy,
  UNPAID_REMINDER_BODY_TEMPLATE,
  UNPAID_REMINDER_SUBJECT_TEMPLATE,
} from "@/lib/admin-unpaid-reminder-copy";

describe("unpaid reminder copy v3", () => {
  it("keeps the approved subject, Labdien greeting, and payment placeholder", () => {
    expect(UNPAID_REMINDER_SUBJECT_TEMPLATE).toBe("Par Jūsu auto pārbaudi (VIN {{vin}})");
    expect(UNPAID_REMINDER_BODY_TEMPLATE.startsWith("Labdien!")).toBe(true);
    expect(UNPAID_REMINDER_BODY_TEMPLATE).toContain("{{maksājuma_saite}}");
    expect(UNPAID_REMINDER_BODY_TEMPLATE).toContain("Nils V. (IRISS)");
    expect(UNPAID_REMINDER_BODY_TEMPLATE).toContain("+371 29 502 039");
    expect(UNPAID_REMINDER_BODY_TEMPLATE).not.toMatch(/[—–]/);
    expect(UNPAID_REMINDER_BODY_TEMPLATE).not.toMatch(/Sveiki,\s+\S/);
  });

  it("fills vin and payment url without a name greeting", () => {
    const copy = unpaidReminderFallbackCopy({
      vin: "WVWZZZ1KZAW000123",
      paymentUrl: "https://www.provin.lv/apmaksa/abc",
    });
    expect(copy.subject).toBe("Par Jūsu auto pārbaudi (VIN WVWZZZ1KZAW000123)");
    expect(copy.text.startsWith("Labdien!")).toBe(true);
    expect(copy.text).toContain("https://www.provin.lv/apmaksa/abc");
    expect(copy.text).not.toContain("{{");
  });

  it("injects the url into edited text that still has the placeholder", () => {
    const out = injectUnpaidReminderPaymentUrl("Labdien!\n{{maksājuma_saite}}\n", "https://pay.example/1");
    expect(out).toContain("https://pay.example/1");
    expect(out).not.toContain("{{");
  });

  it("appends the url when the operator removed the placeholder", () => {
    const out = injectUnpaidReminderPaymentUrl("Labdien!\nPaldies.", "https://pay.example/1");
    expect(out.endsWith("https://pay.example/1")).toBe(true);
  });

  it("plain html is not the branded template", () => {
    const html = unpaidReminderEmailHtml("Labdien!\n\nTeksts");
    expect(html).toContain("Labdien!");
    expect(html).not.toContain("PROVIN.LV");
    expect(html.toLowerCase()).not.toContain("logo");
  });
});
