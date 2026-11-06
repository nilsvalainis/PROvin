import { describe, expect, it } from "vitest";
import { MESSAGE_TEMPLATE_DEFS } from "@/lib/messages/registry";
import { renderTemplateById } from "@/lib/messages/render-template-id";
import { validateMessageOverride } from "@/lib/messages/resolve-message";
import {
  whatsappPrefillDealerNoDataRefunded,
  whatsappPrefillDealerPaymentCancelled,
  whatsappPrefillReportReady,
} from "@/lib/admin-whatsapp-messages";
import { buildUpsellDraft } from "@/lib/order-upsell";
import { buildManualOrderPaymentDraft } from "@/lib/manual-order-payment";
import { buildClientLinkEmailCopy, buildClientLinkWhatsAppText } from "@/lib/client-link";
import { buildMiniToAuditsRecommendationDraft } from "@/lib/email/mini-to-audits-recommendation";
import { unpaidReminderFallbackCopy } from "@/lib/admin-unpaid-reminder-copy";

const VIN = "WDC1671191A002835";

/** Nils 06.11: katrā klientam sūtītā produkta / atskaites ziņā jābūt VIN. */
describe("klienta ziņās ir VIN", () => {
  it("katrs noklusējuma šablons iet cauri redaktora pārbaudei (mainīgie deklarēti)", () => {
    for (const def of MESSAGE_TEMPLATE_DEFS) {
      const r = validateMessageOverride(def.id, { subject: def.subject, body: def.body });
      expect(r, def.id).toEqual({ ok: true });
    }
  });

  const vinTemplates = [
    "email.payment_confirmation",
    "email.client_link",
    "email.unpaid_reminder",
    "email.report_ready.audits",
    "email.report_ready.mini",
    "email.report_ready.dealer",
    "email.dealer.ready_pdf",
    "email.dealer.no_data",
    "email.dealer.cancelled",
    "email.upsell.mini_to_dealer",
    "email.upsell.dealer_to_audit",
    "email.upsell.mini_to_audit",
    "wa.report_ready.audits",
    "wa.report_ready.mini",
    "wa.report_ready.dealer",
    "wa.dealer.no_data_refunded",
    "wa.dealer.cancelled",
    "wa.upsell.mini_to_dealer",
    "wa.upsell.dealer_to_audit",
  ];

  it.each(vinTemplates)("%s: teksts satur VIN, bez VIN nav tukšu iekavu", (id) => {
    const def = MESSAGE_TEMPLATE_DEFS.find((d) => d.id === id)!;
    const sample = Object.fromEntries(def.vars.map((v) => [v.key, v.sample ?? "x"]));
    const withVin = renderTemplateById(id, { ...sample, vin: VIN, lead: `Ievads (VIN ${VIN}).`, temats: `PROVIN · X · ${VIN}`, temats_auto: `PROVIN · X · ${VIN}` });
    expect(withVin?.text, id).toContain(VIN);
    if (def.subject) expect(withVin?.subject, id).toContain(VIN);
    const noVin = renderTemplateById(id, { ...sample, vin: "" });
    expect(noVin?.text ?? "", id).not.toMatch(/\(\s*\)|VIN\s*\)|VIN\s*$/m);
  });

  it("WhatsApp gatavie teksti un atmaksas teksti", () => {
    expect(whatsappPrefillReportReady({ kind: "audits", vin: VIN })).toContain(`(VIN ${VIN})`);
    expect(whatsappPrefillReportReady({ kind: "dealer", vin: VIN })).toContain(VIN);
    expect(whatsappPrefillReportReady({ kind: "audits", vin: "" })).not.toMatch(/\bVIN\b/);
    expect(whatsappPrefillDealerNoDataRefunded(VIN, "24,99 €")).toContain(VIN);
    expect(whatsappPrefillDealerPaymentCancelled(VIN)).toContain(VIN);
  });

  it("piedāvājumi, apmaksas saite, atgādinājums", () => {
    for (const kind of ["mini_to_dealer", "dealer_to_audit", "mini_to_audit"] as const) {
      const d = buildUpsellDraft({ kind, vin: VIN, url: "https://buy.stripe.com/x", priorCents: 2499, chargeCents: 7500, targetCents: 9999, car: "VW Golf" });
      expect(d.subject, kind).toContain(VIN);
      expect(d.emailText, kind).toContain(VIN);
      expect(d.whatsappText, kind).toContain(VIN);
    }
    const pay = buildManualOrderPaymentDraft({ serviceName: "PROVIN AUDITS", amountCents: 9999, url: "https://x", vin: VIN });
    expect(pay.subject).toContain(VIN);
    expect(pay.emailText).toContain(`VIN: ${VIN}`);
    expect(pay.whatsappText).toContain(VIN);
    const link = { url: "https://provin.lv/l/x", productName: "PROVIN AUDITS", expiresAt: "2026-11-20T10:00:00Z", amountCents: 9999, vin: VIN };
    expect(buildClientLinkEmailCopy(link).subject).toContain(VIN);
    expect(buildClientLinkEmailCopy(link).text).toContain(`VIN: ${VIN}`);
    expect(buildClientLinkWhatsAppText(link)).toContain(VIN);
    expect(buildClientLinkWhatsAppText({ ...link, vin: "" })).not.toMatch(/\bVIN\b/);
    const mini = buildMiniToAuditsRecommendationDraft({ vin: VIN, car: "VW Golf", differencePrice: "60,00 €", paymentUrl: "https://x" });
    expect(mini.subject).toBe(`PROVIN · Ieteikums: PROVIN AUDITS · VW Golf · ${VIN}`);
    expect(mini.emailText.split("\n")[2]).toBe(`Paldies par PROVIN MINI pasūtījumu (VW Golf, VIN ${VIN}).`);
    expect(unpaidReminderFallbackCopy({ vin: VIN, paymentUrl: "https://x" }).text).toContain(`(VIN ${VIN})`);
  });
});
