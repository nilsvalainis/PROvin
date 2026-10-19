import { describe, expect, it } from "vitest";

import {
  B2B_DEALER_READY_SUBJECT,
  buildDealerCancelledEmailDraft,
  buildDealerNoDataEmailDraft,
  buildDealerReadyEmailDraft,
  DEALER_NO_DATA_AUDIT_CTA_URL,
  isB2bDealerReadyEmailOrder,
  plainTextToEmailHtmlParagraphs,
  resolveB2bDealerReadyEmailLang,
} from "@/lib/dealer-data-client-email";
import { whatsappPrefillDealerNoDataRefunded } from "@/lib/admin-whatsapp-messages";
import {
  dealerDataNoDataRefundEmailHtml,
  dealerDataOperatorMessageEmailHtml,
} from "@/lib/email/html-templates";
import { B2B_WALLET_REPORT_LANGS } from "@/lib/b2b-wallet";

describe("dealer-data-client-email drafts", () => {
  it("builds no_data draft after refund with A body and soft CTA", () => {
    const d = buildDealerNoDataEmailDraft({
      vin: "WDB1400511A032828",
      amountEur: "24,99 €",
      refunded: true,
    });
    expect(d.kind).toBe("no_data");
    expect(d.subject).toMatch(/atgriezts/i);
    expect(d.text).not.toMatch(/\(VIN\s/i);
    expect(d.text).toContain("24,99 €");
    expect(d.text).toMatch(/atcelta rezervētā summa/);
    expect(d.text).toContain("PROVIN AUDITS");
    expect(d.text).toContain(`Pasūtīt: ${DEALER_NO_DATA_AUDIT_CTA_URL}`);
    expect(d.text).toContain("Nils / IRISS");
    expect(d.text).not.toMatch(/—/);
  });

  it("builds no_data draft without claiming refund completed", () => {
    const d = buildDealerNoDataEmailDraft({ vin: "WDB1400511A032828", refunded: false });
    expect(d.subject).not.toMatch(/atgriezts/i);
    expect(d.text).toMatch(/atgriezīsim/i);
    expect(d.text).toContain("PROVIN AUDITS");
  });

  it("builds cancelled and ready drafts", () => {
    expect(buildDealerCancelledEmailDraft({ vin: "ABC" }).kind).toBe("cancelled");
    expect(buildDealerReadyEmailDraft({ vin: "ABC" }).text).toMatch(/PDF/i);
  });

  it("keeps the retail dealer-ready template unchanged", () => {
    const d = buildDealerReadyEmailDraft({ vin: "WVWZZZ3CZME138258" });
    expect(d.subject).toBe("PROVIN.LV: oficiālā dīlera dati pielikumā");
    expect(d.text).toContain("Nils / IRISS");
    expect(d.text).toContain("PROVIN.LV");
    expect(d.text).toContain("info@provin.lv");
    const html = dealerDataOperatorMessageEmailHtml({ text: d.text });
    expect(html).toContain("Nils / IRISS");
    expect(html).toContain("PROVIN.LV");
    expect(html).not.toContain('letter-spacing:0.12em;text-transform:uppercase;color:#0061D2;font-weight:700;">PROVIN<');
  });
});

describe("B2B dealer-ready email", () => {
  it("detects a partner order the same way as report-ready #323", () => {
    expect(
      isB2bDealerReadyEmailOrder({
        notes: "B2B dealer · partner_id=ptr_0123456789abcdef · partner_company=Auto2000",
      }),
    ).toBe(true);
    expect(isB2bDealerReadyEmailOrder({ partnerCompanyName: "Auto2000" })).toBe(true);
    expect(isB2bDealerReadyEmailOrder({ partnerId: "ptr_0123456789abcdef" })).toBe(true);
    expect(isB2bDealerReadyEmailOrder({ notes: "parasts klienta komentārs" })).toBe(false);
  });

  it("falls back like #323 wallet language rules, then LV", () => {
    expect(resolveB2bDealerReadyEmailLang({ reportLang: "de", walletProduct: "dealer_pro" })).toBe("de");
    expect(resolveB2bDealerReadyEmailLang({ reportLang: "en", walletProduct: "business" })).toBe("en");
    expect(resolveB2bDealerReadyEmailLang({ walletProduct: "business" })).toBe("lv");
    expect(resolveB2bDealerReadyEmailLang({ walletProduct: "dealer_raw" })).toBe("lv");
    expect(resolveB2bDealerReadyEmailLang({ walletProduct: "dealer_pro" })).toBe("lv");
    expect(resolveB2bDealerReadyEmailLang({ reportLang: "fr" })).toBe("lv");
  });

  it.each(B2B_WALLET_REPORT_LANGS)(
    "uses the B2B PROVIN template in %s without PROVIN.LV, .LV or IRISS",
    (lang) => {
      const d = buildDealerReadyEmailDraft({
        vin: "WVWZZZ3CZME138258",
        b2bClient: true,
        lang,
        walletProduct: "dealer_pro",
      });
      expect(d.kind).toBe("ready");
      expect(d.subject).toBe(B2B_DEALER_READY_SUBJECT[lang]);
      expect(d.subject).not.toContain("PROVIN.LV");
      expect(d.subject).not.toContain(".LV");
      expect(d.subject).not.toMatch(/IRISS/i);
      expect(d.text).not.toContain("PROVIN.LV");
      expect(d.text).not.toContain(".LV");
      expect(d.text).not.toMatch(/IRISS/i);
      expect(d.text).not.toContain("Nils");
      expect(d.text).not.toContain("SIA");
      expect(d.text).toContain("Ar cieņu,\nPROVIN");
      expect(d.text).not.toMatch(/[–—]/);

      const html = dealerDataOperatorMessageEmailHtml({ text: d.text, b2bClient: true });
      expect(html).toContain("#0061D2");
      expect(html).toContain("Ar cieņu,<br/><span style=\"color:#0061D2;font-weight:600;\">PROVIN</span>");
      expect(html).not.toContain("PROVIN.LV");
      expect(html).not.toContain("IRISS");
      expect(html).not.toContain("Nils");
    },
  );
});

describe("dealer-data-client-email html", () => {
  it("escapes plain text for HTML paragraphs", () => {
    const html = plainTextToEmailHtmlParagraphs("A <b>B</b>\n\nC & D");
    expect(html).toContain("&lt;b&gt;");
    expect(html).toContain("&amp;");
    expect(html).toContain("<p ");
  });
});

describe("dealer no-data WhatsApp + HTML CTA", () => {
  it("WA template matches A + soft CTA", () => {
    const t = whatsappPrefillDealerNoDataRefunded("WDB1400511A032828", "24,99 €");
    expect(t).not.toMatch(/\(VIN\s/i);
    expect(t).toContain("24,99 €");
    expect(t).toContain("Pasūtīt: https://provin.lv");
    expect(t).not.toMatch(/—/);
  });

  it("operator HTML turns Pasūtīt line into CTA button", () => {
    const draft = buildDealerNoDataEmailDraft({
      vin: "WDB1400511A032828",
      amountEur: "24,99 €",
      refunded: true,
    });
    const html = dealerDataOperatorMessageEmailHtml({ text: draft.text });
    expect(html).toContain('href="https://provin.lv"');
    expect(html).toContain("Pasūtīt PROVIN AUDITS");
    expect(html).not.toMatch(/>Pasūtīt: https:\/\/provin\.lv</);
  });

  it("automatic refund HTML includes CTA", () => {
    const html = dealerDataNoDataRefundEmailHtml({
      vin: "WDB1400511A032828",
      amountEur: "24,99 €",
    });
    expect(html).toContain("Pasūtīt PROVIN AUDITS");
    expect(html).toContain('href="https://provin.lv"');
    expect(html).toMatch(/atcelta rezervētā summa/);
  });
});
