import { describe, expect, it } from "vitest";
import { CLIENT_REPORT_LANGS, type ClientReportLang } from "@/lib/client-report-i18n";
import { buildDealerSendMessage, type DealerSendSituation } from "@/lib/dealer-send-message";
import { buildAuctionArchiveSendMessage } from "@/lib/auction-archive-report";
import { buildReportReadyPlainText, buildReportReadySubject, type ReportReadyProductKind } from "@/lib/email/report-ready-copy";
import { dealerRefundEmailCopy, paymentConfirmationCopy } from "@/lib/email/client-lang-email-copy";
import { dealerDataOperatorMessageEmailHtml } from "@/lib/email/html-templates";
import { applyB2bSignature, LOCALIZED_TEMPLATES } from "@/lib/messages/localized-templates";
import { renderTemplateById } from "@/lib/messages/render-template-id";
import { messageTemplatesDocFromOverrides } from "@/lib/messages/shared-block-vars";
import { templateSampleVars, getMessageTemplateDef } from "@/lib/messages/registry";

/**
 * Nils 25.11: vācu klientam aizgāja e-pasts ar vācu galveni un latviešu pamattekstu.
 * Heiristika: ne-LV tekstā nedrīkst būt latviešu diakritikas un tipisku LV vārdu.
 */
const LV_MARKERS = /[āēīūčšžģķļņĀĒĪŪČŠŽĢĶĻŅ]|\b(Labdien|Jūsu|Ar cieņu|Sveiki|Paldies|Pielikumā|Pasūtīt|Apmaksāt)\b/u;
const FOREIGN: ClientReportLang[] = ["en", "ru", "de"];
const VIN = "WAUZZZ4M4MD007799";
const SITUATIONS: DealerSendSituation[] = ["ready", "no_data", "cancelled"];
const OFFER = { url: "https://www.provin.lv/de/papildinajums/x", priorCents: 2499, chargeCents: 7500, targetCents: 9999 };

function lvLeak(text: string): string | null {
  const m = LV_MARKERS.exec(text);
  return m ? m[0] : null;
}

describe("dīlera dati «Sūtīt klientam» - visas valodas", () => {
  for (const lang of FOREIGN) {
    for (const situation of SITUATIONS) {
      for (const channel of ["email", "whatsapp"] as const) {
        for (const b2b of [false, true]) {
          it(`${lang} ${channel} ${situation} ${b2b ? "B2B" : "B2C"} - bez latviešu teksta`, () => {
            const m = buildDealerSendMessage({
              channel,
              situation,
              b2b,
              vin: VIN,
              refundCents: 2499,
              offer: situation === "ready" ? OFFER : null,
              review: situation === "ready" && !b2b,
              lang,
            });
            expect(lvLeak(m.text)).toBeNull();
            if (channel === "email") {
              expect(m.subject).toBeTruthy();
              expect(lvLeak(m.subject ?? "")).toBeNull();
              expect(m.subject).toContain(VIN);
            }
            expect(m.text).toContain(VIN);
            expect(m.text).toContain(b2b ? "PROVIN" : "PROVIN.LV");
          });
        }
      }
    }
  }

  it("DE «Dati gatavi» - Sie-forma, PDF pielikumā, paraksts", () => {
    const m = buildDealerSendMessage({ channel: "email", situation: "ready", b2b: false, vin: VIN, lang: "de" });
    expect(m.subject).toBe(`PROVIN · Bericht fertig · Offizielle Händlerdaten · ${VIN}`);
    expect(m.text).toContain("die von Ihnen bestellten offiziellen Händlerdaten");
    expect(m.text).toContain("Bei Fragen antworten Sie einfach auf diese E-Mail");
    expect(m.text.endsWith("Mit freundlichen Grüßen\nNils\nPROVIN.LV")).toBe(true);
  });

  it("RU uzruna «Вы»", () => {
    const m = buildDealerSendMessage({ channel: "email", situation: "ready", b2b: false, vin: VIN, lang: "ru" });
    expect(m.text).toContain("Заказанные Вами");
    expect(m.text).not.toMatch(/\bвы\b/);
  });

  it("LV paliek kā līdz šim (šablons no reģistra)", () => {
    const m = buildDealerSendMessage({ channel: "email", situation: "ready", b2b: false, vin: VIN, lang: "lv" });
    expect(m.text).toContain("Labdien!");
    expect(m.text).toContain("Ar cieņu,\nNils\nPROVIN.LV");
  });

  it("LV admina pārraksts ne-LV klientam netiek lietots", () => {
    const doc = messageTemplatesDocFromOverrides({ "email.dealer_send.ready": { subject: "LV temats", body: "Labdien! Jūsu dati." } });
    const lv = buildDealerSendMessage({ channel: "email", situation: "ready", b2b: false, vin: VIN, doc, lang: "lv" });
    const de = buildDealerSendMessage({ channel: "email", situation: "ready", b2b: false, vin: VIN, doc, lang: "de" });
    expect(lv.text).toContain("Jūsu dati");
    expect(lvLeak(de.text)).toBeNull();
  });
});

describe("B2B paraksts - tikai «PROVIN» (bez Nils, bez IRISS)", () => {
  for (const lang of CLIENT_REPORT_LANGS) {
    for (const situation of SITUATIONS) {
      for (const channel of ["email", "whatsapp"] as const) {
        it(`dīlera dati ${lang} ${channel} ${situation}`, () => {
          const m = buildDealerSendMessage({ channel, situation, b2b: true, vin: VIN, refundCents: 2499, lang });
          expect(m.text).not.toMatch(/\bNils\b/);
          expect(m.text).not.toMatch(/IRISS/i);
          expect(m.text).not.toMatch(/PROVIN\.LV/);
          expect(m.text.trim().split("\n").pop()).toBe("PROVIN");
        });
      }
    }
  }

  for (const situation of SITUATIONS) {
    for (const channel of ["email", "whatsapp"] as const) {
      it(`izsoļu arhīvs ${channel} ${situation}`, () => {
        const m = buildAuctionArchiveSendMessage({ channel, situation, b2b: true, vin: VIN, refundCents: 2499 });
        expect(m.text).not.toMatch(/\bNils\b/);
        expect(m.text).not.toMatch(/IRISS/i);
      });
    }
  }

  for (const lang of CLIENT_REPORT_LANGS) {
    for (const kind of ["dealer", "mini", "audits"] as ReportReadyProductKind[]) {
      it(`atskaite gatava ${kind} ${lang}`, () => {
        const t = buildReportReadyPlainText({ kind, vin: VIN, attachmentLines: [], b2bClient: true, lang });
        expect(t).not.toMatch(/\bNils\b/);
        expect(t).not.toMatch(/IRISS/i);
        expect(t.trim().split("\n").pop()).toBe("PROVIN");
      });
    }
  }

  it("applyB2bSignature: admina pārraksts ar «Nils» un WhatsApp «Nils, PROVIN.LV»", () => {
    expect(applyB2bSignature("Teksts\n\nAr cieņu,\nNils\nPROVIN.LV")).toBe("Teksts\n\nAr cieņu,\nPROVIN");
    expect(applyB2bSignature("Teksts\nNils, PROVIN.LV")).toBe("Teksts\nPROVIN");
    expect(applyB2bSignature("Ar cieņu,\nNils Valainis\nIRISS")).toBe("Ar cieņu,\nPROVIN");
    expect(applyB2bSignature("info@provin.lv")).toBe("info@provin.lv");
  });
});

describe("pārējie klientu e-pasti - ne-LV bez latviešu teksta", () => {
  for (const lang of FOREIGN) {
    for (const kind of ["dealer", "mini", "audits"] as ReportReadyProductKind[]) {
      for (const b2bClient of [false, true]) {
        it(`atskaite gatava ${kind} ${lang} ${b2bClient ? "B2B" : "B2C"}`, () => {
          const t = buildReportReadyPlainText({ kind, vin: VIN, attachmentLines: ["X.pdf"], includeGoogleReview: true, b2bClient, lang });
          expect(lvLeak(t)).toBeNull();
          expect(lvLeak(buildReportReadySubject(kind, VIN, lang))).toBeNull();
        });
      }
    }
    it(`maksājuma apstiprinājums ${lang}`, () => {
      const c = paymentConfirmationCopy(lang as "en", { amountLine: "24,99 €", vin: VIN, invoiceUrl: "https://www.provin.lv/x" });
      expect(lvLeak(`${c.subject}\n${c.text}`)).toBeNull();
    });
    for (const cancelled of [false, true]) {
      it(`dīlera atmaksa ${lang} ${cancelled ? "atcelts" : "datu nav"}`, () => {
        const c = dealerRefundEmailCopy(lang as "en", { cancelled, amount: "24,99 €", vin: VIN });
        expect(lvLeak(`${c.subject}\n${c.text}`)).toBeNull();
      });
    }
  }

  it("katram tulkotajam šablonam ir visas 3 valodas un tie paši mainīgie", () => {
    for (const [id, byLang] of Object.entries(LOCALIZED_TEMPLATES)) {
      const def = getMessageTemplateDef(id);
      expect(def, id).toBeTruthy();
      // Paraugi «Jāni» (LV vokatīvs) un LV «apraksts» ne-LV klientam reālajā plūsmā aizstāj ar valodas vērtībām.
      const vars = { ...templateSampleVars(def!), vards: "Anna", apraksts: "In the archive: 1 auction." };
      for (const lang of FOREIGN) {
        const r = renderTemplateById(id, vars, null, { lang });
        expect(byLang[lang as "en"], `${id} ${lang}`).toBeTruthy();
        expect(lvLeak(`${r?.subject ?? ""}\n${r?.text ?? ""}`.replace(/Ar cieņu,\nNils\nPROVIN\.LV/, "")), `${id} ${lang}`).toBeNull();
        if (def!.subject) expect(r?.subject, `${id} ${lang}`).toBeTruthy();
      }
    }
  });
});

describe("dīlera e-pasta HTML (galvene + pamatteksts + kājene vienā valodā)", () => {
  for (const lang of FOREIGN) {
    it(`${lang}: HTML bez latviešu teksta`, () => {
      const m = buildDealerSendMessage({ channel: "email", situation: "ready", b2b: false, vin: VIN, offer: OFFER, lang });
      const html = dealerDataOperatorMessageEmailHtml({
        text: m.text,
        lang,
        context: {
          situation: "ready",
          productKind: "dealer",
          vin: VIN,
          facts: [],
          attachments: [{ filename: "OFFIZIELLE_HAENDLERDATEN_X_DE.pdf", bytes: 120_000 }],
        },
      });
      const visible = html.replace(/<style[\s\S]*?<\/style>/g, "").replace(/<[^>]+>/g, " ");
      expect(lvLeak(visible)).toBeNull();
    });
  }
});
