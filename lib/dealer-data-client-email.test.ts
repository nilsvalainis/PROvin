import { describe, expect, it } from "vitest";

import {
  buildDealerCancelledEmailDraft,
  buildDealerNoDataEmailDraft,
  buildDealerReadyEmailDraft,
  DEALER_NO_DATA_AUDIT_CTA_URL,
  plainTextToEmailHtmlParagraphs,
} from "@/lib/dealer-data-client-email";
import { whatsappPrefillDealerNoDataRefunded } from "@/lib/admin-whatsapp-messages";
import {
  dealerDataNoDataRefundEmailHtml,
  dealerDataOperatorMessageEmailHtml,
} from "@/lib/email/html-templates";

describe("dealer-data-client-email drafts", () => {
  it("builds no_data draft after refund with A body and soft CTA", () => {
    const d = buildDealerNoDataEmailDraft({
      vin: "WDB1400511A032828",
      amountEur: "24,99 €",
      refunded: true,
    });
    expect(d.kind).toBe("no_data");
    expect(d.subject).toMatch(/atgriezts/i);
    expect(d.text).toContain("WDB1400511A032828");
    expect(d.text).toContain("24,99 €");
    expect(d.text).toMatch(/atcelta rezervētā summa/);
    expect(d.text).toContain("PROVIN AUDITS");
    expect(d.text).toContain(`Pasūtīt: ${DEALER_NO_DATA_AUDIT_CTA_URL}`);
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
    expect(t).toContain("VIN WDB1400511A032828");
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
