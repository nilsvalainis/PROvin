import { describe, expect, it } from "vitest";

import {
  buildDealerCancelledEmailDraft,
  buildDealerNoDataEmailDraft,
  buildDealerReadyEmailDraft,
  plainTextToEmailHtmlParagraphs,
} from "@/lib/dealer-data-client-email";

describe("dealer-data-client-email drafts", () => {
  it("builds no_data draft mentioning refund when already refunded", () => {
    const d = buildDealerNoDataEmailDraft({
      vin: "WDB1400511A032828",
      amountEur: "19,00 €",
      refunded: true,
    });
    expect(d.kind).toBe("no_data");
    expect(d.subject).toMatch(/atgriezts/i);
    expect(d.text).toContain("WDB1400511A032828");
    expect(d.text).toMatch(/Atmaksa/);
    expect(d.text).not.toMatch(/—/);
  });

  it("builds no_data draft without claiming refund completed", () => {
    const d = buildDealerNoDataEmailDraft({ vin: "WDB1400511A032828", refunded: false });
    expect(d.subject).not.toMatch(/atgriezts/i);
    expect(d.text).toMatch(/atgriezīsim/i);
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
