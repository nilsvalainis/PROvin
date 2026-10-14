import { describe, expect, it } from "vitest";
import {
  whatsappPrefillDealerNoDataRefunded,
  whatsappPrefillReportReady,
  whatsappPrefillSelectConsultation,
} from "@/lib/admin-whatsapp-messages";
import { buildClientLinkEmailCopy, formatClientLinkExpiryLong, formatClientLinkAmount } from "@/lib/client-link";
import {
  buildDealerCancelledEmailDraft,
  buildDealerNoDataEmailDraft,
  buildDealerReadyEmailDraft,
} from "@/lib/dealer-data-client-email";
import { buildMiniToAuditsRecommendationDraft } from "@/lib/email/mini-to-audits-recommendation";
import { buildReportReadyPlainText, buildReportReadySubject } from "@/lib/email/report-ready-copy";
import { listingOfferText } from "@/lib/iriss-listings-offer";
import { buildUpsellDraft } from "@/lib/order-upsell";
import { MESSAGE_TEMPLATE_DEFS, MESSAGE_TEMPLATE_IDS } from "@/lib/messages/registry-data";
import { previewMessage, resolveMessageSync } from "@/lib/messages/resolve-message";
import {
  buildDealerNoDataVars,
  buildReportReadyEmailVars,
  buildUpsellEmailVars,
  buildUpsellWaVars,
  buildWaReportReadyVars,
  miniToAuditsVarsFromDraftInput,
  reportReadyTemplateId,
  waReportReadyTemplateId,
} from "@/lib/messages/template-vars";

describe("message template registry", () => {
  it("exports stable template id list (41 entries incl. B2B locales)", () => {
    expect(MESSAGE_TEMPLATE_IDS.length).toBe(MESSAGE_TEMPLATE_DEFS.length);
    expect(MESSAGE_TEMPLATE_DEFS.length).toBeGreaterThanOrEqual(70);
  });

  it("each template renders with sample vars", () => {
    for (const def of MESSAGE_TEMPLATE_DEFS) {
      const rendered = previewMessage(def.id);
      expect(rendered?.text?.trim().length ?? 0).toBeGreaterThan(0);
      if (def.subject) expect(rendered?.subject?.trim().length ?? 0).toBeGreaterThan(0);
    }
  });
});

describe("template parity without overrides", () => {
  it("report ready audits plain text", () => {
    const opts = {
      kind: "audits" as const,
      vin: "WVWZZZ1KZAW000123",
      attachmentLines: [] as string[],
      includeGoogleReview: true,
    };
    const legacy = buildReportReadyPlainText(opts);
    const vars = buildReportReadyEmailVars(opts);
    const tpl = resolveMessageSync(reportReadyTemplateId("audits"), vars)?.text;
    expect(tpl).toBe(legacy);
    expect(resolveMessageSync(reportReadyTemplateId("audits"), vars)?.subject).toBe(
      buildReportReadySubject("audits", opts.vin),
    );
  });

  it("dealer email drafts", () => {
    const noData = buildDealerNoDataEmailDraft({ vin: "ABC", amountEur: "24,99 €", refunded: false });
    const noDataTpl = resolveMessageSync(
      "email.dealer.no_data",
      buildDealerNoDataVars({ vin: "ABC", amountEur: "24,99 €", refunded: false }),
    );
    expect(noDataTpl?.text).toBe(noData.text);
    expect(noDataTpl?.subject).toBe(noData.subject);

    const cancelled = buildDealerCancelledEmailDraft({ vin: "ABC", amountEur: "24,99 €" });
    const cancelledTpl = resolveMessageSync("email.dealer.cancelled", {
      summa: "24,99 €",
    });
    expect(cancelledTpl?.text).toBe(cancelled.text);

    const ready = buildDealerReadyEmailDraft({ vin: "ABC" });
    const readyTpl = resolveMessageSync("email.dealer.ready_pdf", {});
    expect(readyTpl?.text).toBe(ready.text);
  });

  it("upsell mini_to_dealer", () => {
    const opts = {
      kind: "mini_to_dealer" as const,
      vin: "ABC",
      url: "https://pay.example/1",
      priorCents: 3999,
      chargeCents: 1999,
      targetCents: 5998,
    };
    const legacy = buildUpsellDraft(opts);
    const emailTpl = resolveMessageSync("email.upsell.mini_to_dealer", buildUpsellEmailVars(opts));
    const waTpl = resolveMessageSync("wa.upsell.mini_to_dealer", buildUpsellWaVars(opts));
    expect(emailTpl?.text).toBe(legacy.emailText);
    expect(waTpl?.text).toBe(legacy.whatsappText);
  });

  it("mini to audits recommendation", () => {
    const input = {
      customerName: "Jānis Bērziņš",
      vin: "WVWZZZ1KZAW000123",
      car: "VW Golf",
      paymentUrl: "https://pay.example/2",
      differencePrice: "60,00 €",
    };
    const legacy = buildMiniToAuditsRecommendationDraft(input);
    const vars = miniToAuditsVarsFromDraftInput(input);
    expect(resolveMessageSync("email.upsell.mini_to_audit", vars)?.text).toBe(legacy.emailText);
    expect(resolveMessageSync("wa.upsell.mini_to_audit", vars)?.text).toBe(legacy.whatsappText);
  });

  it("client link email", () => {
    const opts = {
      url: "https://buy.stripe.com/test",
      productName: "PROVIN AUDITS",
      expiresAt: new Date("2026-10-20T12:00:00.000Z").toISOString(),
      amountCents: 9999,
    };
    const legacy = buildClientLinkEmailCopy(opts);
    const tpl = resolveMessageSync("email.client_link", {
      produkts: opts.productName,
      summa: formatClientLinkAmount(opts.amountCents),
      derigs_lidz: formatClientLinkExpiryLong(opts.expiresAt),
      maksajuma_saite: opts.url,
    });
    expect(tpl?.text).toBe(legacy.text);
  });

  it("whatsapp prefills", () => {
    const legacyWa = whatsappPrefillReportReady({ kind: "audits", vin: "WVWZZZ1KZAW000123" });
    const waVars = buildWaReportReadyVars({ kind: "audits", vin: "WVWZZZ1KZAW000123" });
    expect(resolveMessageSync(waReportReadyTemplateId("audits"), waVars)?.text).toBe(legacyWa);

    const legacyRefund = whatsappPrefillDealerNoDataRefunded("WVWZZZ1KZAW000123", "24,99 €");
    expect(previewMessage("wa.dealer.no_data_refunded")?.text).toBe(legacyRefund);
  });

  it("whatsapp select consultation matches template", () => {
    expect(previewMessage("wa.select_consultation")?.text).toBe(whatsappPrefillSelectConsultation());
  });

  it("iriss listing offer uses template vars", () => {
    const v = {
      title: "BMW 320d",
      year: "2018",
      mileageKm: 145000,
      fuel: "Dīzelis",
      transmission: "Automatic",
      powerKw: "140",
      location: "Vācija",
      countryCode: "DE",
      platform: "autobid",
      detailUrl: "https://example.com",
      externalId: "x1",
    };
    const text = listingOfferText(v);
    expect(text).toContain("BMW 320d");
    expect(text).toContain("Dzintarzeme Auto");
  });
});

describe("template snapshots (default text)", () => {
  for (const id of MESSAGE_TEMPLATE_IDS) {
    it(`snapshot ${id}`, () => {
      const msg = previewMessage(id);
      expect(msg).toMatchSnapshot();
    });
  }
});
