import { describe, expect, it } from "vitest";
import { buildDealerSendMessage } from "@/lib/dealer-send-message";
import { dealerEmailFacts, upsellExpiryForText } from "@/lib/email/dealer-email-context";
import { EMAIL_ICON_BASE_URL } from "@/lib/email/email-layout";
import {
  auditCompletedEmailHtml,
  b2bProvinEmailHtml,
  dealerDataNoDataRefundEmailHtml,
  dealerDataOperatorMessageEmailHtml,
  partnerVerifyEmailHtml,
  paymentConfirmationHtml,
} from "@/lib/email/html-templates";

const VIN = "WDD2122231A338701";
const OFFER_URL = "https://www.provin.lv/lv/papildinajums/upk_abc123";

function readyWithOffer(): string {
  const msg = buildDealerSendMessage({
    channel: "email",
    situation: "ready",
    b2b: false,
    vin: VIN,
    offer: { url: OFFER_URL, priorCents: 2499, chargeCents: 7500, targetCents: 9999 },
  });
  return dealerDataOperatorMessageEmailHtml({
    text: msg.text,
    context: {
      situation: "ready",
      productKind: "dealer",
      vin: VIN,
      date: "22.11.2026",
      facts: [
        { value: "14", label: "servisa ieraksti" },
        { value: "2018", label: "pēdējais ieraksts" },
      ],
      attachments: [{ filename: `OFICIALA_DILERA_DATI_${VIN}.pdf`, bytes: 1_468_006 }],
      offerExpiresAt: "2026-12-22T10:00:00.000Z",
    },
  });
}

function allSamples(): string[] {
  return [
    readyWithOffer(),
    auditCompletedEmailHtml({ carVin: VIN, attachmentLines: ["a.pdf"], productKind: "audits", includeGoogleReview: true }),
    auditCompletedEmailHtml({ carVin: VIN, attachmentLines: ["a.pdf"], productKind: "dealer", b2bClient: true, lang: "de" }),
    dealerDataNoDataRefundEmailHtml({ vin: VIN, amountEur: "24,99 €" }),
    dealerDataNoDataRefundEmailHtml({ vin: VIN, amountEur: "24,99 €", cancelled: true }),
    paymentConfirmationHtml({ invoiceUrl: "https://www.provin.lv/i", amountLine: "99,99 €", vin: VIN }),
    partnerVerifyEmailHtml({ verifyUrl: "https://provin.lv/v?t=1", locale: "en" }),
    b2bProvinEmailHtml({ title: "PROVIN", paragraphs: ["Teksts."] }),
  ];
}

describe("e-pasti variants A", () => {
  it("operatora teksts escapots, rindu pārtraukumi saglabāti", () => {
    const html = dealerDataOperatorMessageEmailHtml({
      text: 'Labdien!\n\n<script>alert(1)</script> & "x"\nOtrā rinda',
      context: { situation: "ready", productKind: "dealer", vin: VIN },
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;x&quot;<br/>Otrā rinda");
  });

  it("piedāvājums - strukturēts bloks ar pogu uz esošo /papildinajums/ saiti", () => {
    const html = readyWithOffer();
    expect(html).toContain(`href="${OFFER_URL}"`);
    expect(html).toContain("Pasūtīt pilno auditu par 75,00&nbsp;€");
    expect(html).toContain("Jau samaksāts (dīlera dati)");
    expect(html).toContain("24,99&nbsp;€");
    expect(html).toContain("Kopā PROVIN AUDITS");
    expect(html).toContain("99,99&nbsp;€");
    expect(html).toContain("Saite derīga līdz 22.12.2026");
    // Cenu rindas un «Apmaksāt:» rinda vairs nav kā teksts.
    expect(html).not.toContain("Apmaksāt: ");
    expect(html).not.toContain("Piemaksa: 75,00 €");
  });

  it("statusa karte, fakti un pielikuma kartīte", () => {
    const html = readyWithOffer();
    expect(html).toContain("Oficiālie dīlera dati");
    expect(html).toContain("Atskaite gatava");
    expect(html).toContain(VIN);
    expect(html).toContain("22.11.2026");
    expect(html).toContain("servisa ieraksti");
    expect(html).toContain(`OFICIALA_DILERA_DATI_${VIN}.pdf`);
    expect(html).toContain("PDF · 1,4 MB");
  });

  it("bez faktiem - faktu bloks netiek rādīts", () => {
    const html = dealerDataOperatorMessageEmailHtml({
      text: "Labdien!",
      context: { situation: "ready", productKind: "dealer", vin: VIN },
    });
    expect(html).not.toContain(`class="c-ink m-num"`);
  });

  it("Google atsauksme tikai, ja rinda ir tekstā", () => {
    const off = dealerDataOperatorMessageEmailHtml({ text: "Labdien!", context: { situation: "ready", vin: VIN } });
    expect(off).not.toContain("star.png");
    const on = dealerDataOperatorMessageEmailHtml({
      text: "Labdien!\n\nJa mūsu darbs Jums noderēja, būšu pateicīgs par īsu atsauksmi Google: https://g.page/r/CamRaT51IPQ_EBM/review",
      context: { situation: "ready", vin: VIN },
    });
    expect(on).toContain("star.png");
    expect(on).toContain('href="https://g.page/r/CamRaT51IPQ_EBM/review"');
  });

  it("tumšais režīms: meta color-scheme + prefers-color-scheme + [data-ogsc]", () => {
    for (const html of allSamples()) {
      expect(html).toContain('<meta name="color-scheme" content="light dark"/>');
      expect(html).toContain('<meta name="supported-color-schemes" content="light dark"/>');
      expect(html).toContain("@media (prefers-color-scheme:dark)");
      expect(html).toContain("[data-ogsc] .c-card");
      expect(html).toContain("@media (max-width:480px)");
    }
  });

  it("nav data: URI, nav SVG, nav JS; ikonas - PNG no provin.lv", () => {
    for (const html of allSamples()) {
      expect(html).not.toMatch(/data:/i);
      expect(html).not.toMatch(/<svg/i);
      expect(html).not.toMatch(/<script/i);
      const imgs = [...html.matchAll(/<img src="([^"]+)"/g)].map((m) => m[1]);
      for (const src of imgs) expect(src).toMatch(new RegExp(`^${EMAIL_ICON_BASE_URL.replace(/\./g, "\\.")}/[a-z]+\\.png$`));
    }
  });

  it("nav «eksperts», nav garo domuzīmju, nav IRISS", () => {
    for (const html of allSamples()) {
      expect(html.toLowerCase()).not.toContain("ekspert");
      expect(html).not.toMatch(/[\u2013\u2014]/);
      expect(html).not.toContain("IRISS");
    }
  });

  it("kājene: info@provin.lv · 29 502 039 + automātiskā rinda", () => {
    const html = readyWithOffer();
    expect(html).toContain('href="mailto:info@provin.lv"');
    expect(html).toContain('href="tel:+37129502039"');
    expect(html).toContain("Šis e-pasts nosūtīts automātiski.");
  });

  it("B2B: logo un kājene bez .LV", () => {
    const html = auditCompletedEmailHtml({ carVin: VIN, attachmentLines: ["a.pdf"], productKind: "dealer", b2bClient: true, lang: "en" });
    expect(html).not.toContain("PROVIN.LV");
    expect(html).not.toContain(">.LV<");
    expect(html).toContain("Report ready");
  });

  it("atmaksa / atcelts - pelēka karte, poga uz PROVIN AUDITS", () => {
    const msg = buildDealerSendMessage({ channel: "email", situation: "no_data", b2b: false, vin: VIN, refundCents: 2499 });
    const html = dealerDataOperatorMessageEmailHtml({ text: msg.text, context: { situation: "no_data", vin: VIN } });
    expect(html).toContain("Dati nav pieejami");
    expect(html).toContain("refund.png");
    expect(html).toContain("Pasūtīt PROVIN AUDITS");
    const cancelled = dealerDataOperatorMessageEmailHtml({ text: "Labdien!", context: { situation: "cancelled", vin: VIN } });
    expect(cancelled).toContain("Pasūtījums atcelts");
  });

  it("piedāvājuma bloks netiek veidots mini → dīleris piemaksai", () => {
    const html = dealerDataOperatorMessageEmailHtml({
      text: "Labdien!\n\nJau samaksāts: 39,99 €\nPiemaksa: 19,99 €\nKopā: 59,98 €\n\nApmaksāt: https://www.provin.lv/lv/papildinajums/upk_x",
    });
    expect(html).not.toContain("Papildiniet līdz pilnam PROVIN AUDITAM");
    expect(html).toContain("Apmaksāt");
  });
});

describe("dīlera e-pasta fakti", () => {
  it("servisa ieraksti, pēdējais gads, eļļas maiņas", () => {
    const facts = dealerEmailFacts({
      serviceWorks: [
        { date: "12.03.2015", odometer: "30000", location: "", works: "Regulārā apkope: motoreļļas maiņa, eļļas filtrs" },
        { date: "20.04.2017", odometer: "60000", location: "", works: "Motoreļļas maiņa" },
        { date: "05.06.2018", odometer: "75000", location: "", works: "Bremžu diski" },
      ],
    });
    expect(facts[0]).toEqual({ value: "3", label: "servisa ieraksti" });
    expect(facts[1]).toEqual({ value: "2018", label: "pēdējais ieraksts" });
    expect(facts.length).toBeGreaterThanOrEqual(2);
  });

  it("bez ierakstiem - nekas", () => {
    expect(dealerEmailFacts({ serviceWorks: [] })).toEqual([]);
    expect(dealerEmailFacts(null)).toEqual([]);
  });

  it("piemaksas termiņš tikai saitei, kas ir tekstā", () => {
    const offers = [{ token: "upk_a", expiresAt: "2026-12-22T10:00:00.000Z" }];
    expect(upsellExpiryForText("Apmaksāt: https://www.provin.lv/lv/papildinajums/upk_a", offers)).toBe(
      "2026-12-22T10:00:00.000Z",
    );
    expect(upsellExpiryForText("Apmaksāt: https://www.provin.lv/lv/papildinajums/upk_b", offers)).toBeNull();
  });
});
