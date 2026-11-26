import { describe, expect, it } from "vitest";
import { buildDealerSendMessage } from "@/lib/dealer-send-message";
import { CLIENT_EMAIL_QUESTION_LINE } from "@/lib/email/client-email-contact";
import { emailFooterRows } from "@/lib/email/email-layout";
import {
  auditCompletedEmailHtml,
  dealerDataNoDataRefundEmailHtml,
  dealerDataOperatorMessageEmailHtml,
} from "@/lib/email/html-templates";
import { listMessageTemplates } from "@/lib/messages/registry";

const VIN = "WDD2122231A338701";

/** Redzamais teksts (bez tagiem un href) - kontaktu skaitam. */
function visibleText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ");
}

const count = (s: string, needle: string) => s.split(needle).length - 1;

function clientSamples(): string[] {
  const ready = buildDealerSendMessage({ channel: "email", situation: "ready", b2b: false, vin: VIN });
  const noData = buildDealerSendMessage({ channel: "email", situation: "no_data", b2b: false, vin: VIN, refundCents: 2499 });
  return [
    dealerDataOperatorMessageEmailHtml({ text: ready.text, context: { situation: "ready", productKind: "dealer", vin: VIN } }),
    dealerDataOperatorMessageEmailHtml({ text: noData.text, context: { situation: "no_data", vin: VIN } }),
    auditCompletedEmailHtml({ carVin: VIN, attachmentLines: ["a.pdf"], productKind: "audits" }),
    auditCompletedEmailHtml({ carVin: VIN, attachmentLines: ["a.pdf"], productKind: "dealer", lang: "de" }),
    auditCompletedEmailHtml({ carVin: VIN, attachmentLines: ["a.pdf"], productKind: "mini", lang: "ru" }),
    dealerDataNoDataRefundEmailHtml({ vin: VIN, amountEur: "24,99 €" }),
    dealerDataNoDataRefundEmailHtml({ vin: VIN, amountEur: "24,99 €", cancelled: true }),
  ];
}

describe("klientu e-pastu beigas (Nils 26.11, variants A)", () => {
  it("kājene: viena pelēka rinda provin.lv · +371 29 502 039, bez e-pasta", () => {
    const footer = emailFooterRows(false, "A");
    const text = visibleText(footer).trim();
    expect(text).toBe("provin.lv · +371 29 502 039");
    expect(footer).not.toContain("info@provin.lv");
  });

  it("variants B: bez līnijas, zem paraksta info@provin.lv · +371 29 502 039", () => {
    const footer = emailFooterRows(false, "B");
    expect(visibleText(footer).trim()).toBe("info@provin.lv · +371 29 502 039");
    expect(footer).not.toContain("border-top");
  });

  it("katrs kontakts e-pastā redzams tikai vienreiz", () => {
    for (const html of clientSamples()) {
      const t = visibleText(html);
      expect(count(t, "info@provin.lv")).toBe(0);
      expect(count(t, "29 502 039")).toBe(1);
      expect(count(t, "Ar cieņu") + count(t, "Mit freundlichen") + count(t, "С уважением")).toBe(1);
    }
  });

  it("jautājumu rinda - vienkārši atbildiet uz šo e-pastu", () => {
    const lv = visibleText(clientSamples()[0]);
    expect(lv).toContain(CLIENT_EMAIL_QUESTION_LINE.lv);
    expect(lv).not.toContain("atbildiet uz šo ziņu vai rakstiet");
    expect(visibleText(clientSamples()[3])).toContain(CLIENT_EMAIL_QUESTION_LINE.de);
  });
});

describe("locījumi: «Pasūtīt PROVIN AUDITU»", () => {
  it("nevienā e-pastā vai šablonā nav «Pasūtīt PROVIN AUDITS»", () => {
    for (const html of clientSamples()) {
      expect(html).not.toContain("Pasūtīt PROVIN AUDITS");
    }
    for (const t of listMessageTemplates()) {
      const body = JSON.stringify(t);
      expect(body).not.toMatch(/(Pasūtīt|Iegādāties|Izvēlēties|iesakām|Iesakām) PROVIN AUDITS\b/);
    }
  });
});
