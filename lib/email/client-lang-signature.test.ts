/**
 * Nils 26.11: (1) klienta e-pasta valoda = vietnes valoda, kurā pasūtīja (nekad pārlūka / Stripe «auto»);
 * (2) klientu e-pastos un WhatsApp tekstos parakstā nav «Nils» - tikai «PROVIN.LV» (B2B «PROVIN»).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { checkoutSessionSiteLang } from "@/lib/checkout-session-site-lang";
import { resolveClientEmailLang, resolveOrderClientLang } from "@/lib/email/client-lang-email-copy";
import { clientMessageSignOff } from "@/lib/email/report-ready-copy";
import { auditCompletedEmailHtml } from "@/lib/email/html-templates";
import { defaultSignOffBlock } from "@/lib/messages/shared-blocks";
import { LOCALIZED_TEMPLATES } from "@/lib/messages/localized-templates";
import { MESSAGE_TEMPLATE_DEFS } from "@/lib/messages/registry-data";
import { DEALER_SEND_TEMPLATE_DEFS } from "@/lib/messages/dealer-send-template-defs";
import { AUCTION_ARCHIVE_SEND_TEMPLATE_DEFS } from "@/lib/messages/auction-archive-send-template-defs";
import { stripeCheckoutLocale } from "@/lib/stripe-session";

const LANGS = ["lv", "en", "ru", "de"] as const;
const NILS = /\bNils\b/;

describe("klienta valoda no vietnes, ne no pārlūka", () => {
  it("EN pārlūks LV lapā -> LV (checkout nodod lapas valodu, nevis «auto»)", () => {
    expect(stripeCheckoutLocale("lv")).toBe("lv");
    expect(stripeCheckoutLocale(undefined)).toBe("lv");
    expect(stripeCheckoutLocale("auto")).toBe("lv");
    const lvPage = {
      locale: stripeCheckoutLocale("lv"),
      success_url: "https://www.provin.lv/lv/paldies?session_id={CHECKOUT_SESSION_ID}",
      cancel_url: "https://www.provin.lv/lv?atcelts=1",
    };
    expect(checkoutSessionSiteLang(lvPage)).toBe("lv");
    expect(resolveOrderClientLang({ locale: checkoutSessionSiteLang(lvPage) })).toBe("lv");
  });

  it("Stripe «auto» / pārlūka valoda neizšķir: tad lapas ceļš, citādi LV", () => {
    expect(checkoutSessionSiteLang({ locale: "auto", success_url: "https://www.provin.lv/lv/paldies" })).toBe("lv");
    expect(checkoutSessionSiteLang({ locale: "auto", cancel_url: "https://www.provin.lv/de?atcelts=1" })).toBe("de");
    expect(checkoutSessionSiteLang({ locale: "fr", success_url: "https://www.provin.lv/ru/paldies" })).toBe("ru");
    expect(checkoutSessionSiteLang({ locale: "auto" })).toBe("lv");
    expect(checkoutSessionSiteLang({ locale: null })).toBe("lv");
    expect(resolveClientEmailLang("auto")).toBe("lv");
  });

  it("EN lapā pasūtīts -> EN (B2B partnera izvēle - remaining-emails-i18n.test.ts)", () => {
    expect(checkoutSessionSiteLang({ locale: "en", success_url: "https://www.provin.lv/en/paldies" })).toBe("en");
    expect(resolveOrderClientLang({ locale: "en" })).toBe("en");
  });

  it("visi checkout ceļi nodod Stripe `locale` (nekad «auto» pēc noklusējuma)", () => {
    const files = [
      "app/api/checkout/route.ts",
      "app/api/checkout/test-pricing/route.ts",
      "app/api/checkout/partner/topup/route.ts",
      "lib/order-upsell-checkout.ts",
      "lib/manual-order-checkout.ts",
      "lib/client-link.ts",
      "lib/business-link.ts",
    ];
    for (const f of files) {
      const src = readFileSync(join(process.cwd(), f), "utf8");
      expect(src, f).toMatch(/\blocale:\s*(stripeCheckoutLocale\(|lang\b|"lv")/);
      expect(src, f).not.toMatch(/locale:\s*"auto"/);
    }
  });
});

describe("paraksts bez «Nils» visās valodās", () => {
  it("clientMessageSignOff: «<sveiciens>\\nPROVIN.LV»", () => {
    expect(clientMessageSignOff("lv")).toBe("Ar cieņu,\nPROVIN.LV");
    expect(clientMessageSignOff("en")).toBe("Best regards,\nPROVIN.LV");
    expect(clientMessageSignOff("ru")).toBe("С уважением,\nPROVIN.LV");
    expect(clientMessageSignOff("de")).toBe("Mit freundlichen Grüßen,\nPROVIN.LV");
    expect(defaultSignOffBlock()).toBe("Ar cieņu,\nPROVIN.LV");
  });

  it("HTML e-pasta paraksts bez vārda", () => {
    for (const lang of LANGS) {
      const html = auditCompletedEmailHtml({ carVin: "WVWZZZ1JZXW000001", attachmentLines: [], productKind: "audits", lang });
      expect(html).not.toMatch(NILS);
      expect(html).toContain("PROVIN.LV");
    }
  });

  it("noklusētie šabloni (LV reģistrs, dīlera/izsoļu sūtīšana) un EN/RU/DE tulkojumi bez «Nils»", () => {
    for (const def of [...MESSAGE_TEMPLATE_DEFS, ...DEALER_SEND_TEMPLATE_DEFS, ...AUCTION_ARCHIVE_SEND_TEMPLATE_DEFS]) {
      expect(`${def.subject ?? ""}\n${def.body}`, def.id).not.toMatch(NILS);
      for (const v of def.vars ?? []) expect(v.sample ?? "", `${def.id}:${v.key}`).not.toMatch(NILS);
    }
    for (const [id, byLang] of Object.entries(LOCALIZED_TEMPLATES)) {
      for (const [lang, t] of Object.entries(byLang)) {
        expect(`${t.subject ?? ""}\n${t.body}`, `${id}:${lang}`).not.toMatch(NILS);
      }
    }
  });

  it("klientu tekstu avotos nav «Nils» paraksta literāļu", () => {
    const files = [
      "lib/messages/shared-blocks.ts",
      "lib/messages/localized-templates.ts",
      "lib/messages/dealer-send-template-defs.ts",
      "lib/messages/auction-archive-send-template-defs.ts",
      "lib/email/report-ready-copy.ts",
      "lib/email/auction-archive-email.ts",
      "lib/email/auction-archive-email-i18n.ts",
      "lib/email/client-lang-email-copy.ts",
      "lib/admin-whatsapp-messages.ts",
    ];
    for (const f of files) {
      const src = readFileSync(join(process.cwd(), f), "utf8");
      expect(src, f).not.toMatch(/["'`]Nils(?: Valainis)?["',]|\\nNils|>Nils</);
    }
  });

  it("bez vārda - nav 1. personas vienskaitļa (būšu pateicīgs / I would / буду / würde ich, pievienoju u.c.)", () => {
    const first = /būšu|pateicīgs\b|pievienoju|nosūtu\b|\bI would\b|\bI am\b|буду благодарен|прикладываю|отправляю|würde ich|sende ich|füge ich|ich sende/;
    for (const def of [...MESSAGE_TEMPLATE_DEFS, ...DEALER_SEND_TEMPLATE_DEFS, ...AUCTION_ARCHIVE_SEND_TEMPLATE_DEFS]) {
      expect(`${def.subject ?? ""}\n${def.body}`, def.id).not.toMatch(first);
    }
    for (const [id, byLang] of Object.entries(LOCALIZED_TEMPLATES)) {
      for (const [lang, t] of Object.entries(byLang)) expect(`${t.subject ?? ""}\n${t.body}`, `${id}:${lang}`).not.toMatch(first);
    }
    for (const lang of LANGS) {
      const html = auditCompletedEmailHtml({ carVin: "WVWZZZ1JZXW000001", attachmentLines: [], productKind: "audits", lang, includeGoogleReview: true });
      expect(html, lang).not.toMatch(first);
    }
  });
});
