import { describe, expect, it } from "vitest";
import { buildAuditSendMessage } from "@/lib/audits-send-message";
import { dealerDataOperatorMessageEmailHtml } from "@/lib/email/html-templates";

const VIN = "WAUZZZ4G7FN012345";
const LANGS = ["lv", "en", "ru", "de"] as const;
const ctx = (over: object = {}) => ({
  situation: "ready" as const,
  productKind: "audits" as const,
  vin: VIN,
  car: "Audi A6 Avant 3.0 TDI",
  facts: [{ value: "187 420 km", label: "Nobraukums" }],
  attachments: [{ filename: `PROVIN-${VIN}.pdf`, bytes: 2_400_000 }],
  ...over,
});

describe("AUDITS forma - B2B diskrētais e-pasts", () => {
  for (const lang of LANGS) {
    it(`${lang}: «Transportlīdzekļa pārbaude», tikai PROVIN, bez mārketinga, konsultācijas, pogām un rēķina`, () => {
      const msg = buildAuditSendMessage({ channel: "email", situation: "ready", b2b: true, vin: VIN, lang });
      // Pat ja adminā tekstā palikusi AUDITS saite vai atsauksmes rinda - diskrētajā režīmā pogu / zvaigžņu nav.
      const text = `${msg.text}\n\nPasūtīt: https://www.provin.lv/lv?plan=audits\n\nAtsauksme: https://g.page/r/x/review`;
      const html = dealerDataOperatorMessageEmailHtml({ text, b2bClient: true, lang, context: ctx({ discreet: true, consult: true }) });
      expect(html).toContain({ lv: "Transportlīdzekļa pārbaude", en: "Vehicle check", ru: "Проверка транспортного средства", de: "Fahrzeugprüfung" }[lang]);
      expect(html).not.toContain("PROVIN AUDITS");
      expect(html).not.toContain("PROVIN.LV");
      expect(html).not.toContain(">.LV<");
      expect(html).not.toMatch(/Uzdot jautājumu|Ask a question|Задать вопрос|Frage stellen|konsultāc/i);
      expect(html).not.toMatch(/Pasūtīt PROVIN AUDITU|star|Rēķins/i);
      expect(html).not.toContain("provin.lv · ");
      expect(html).toContain("187 420 km");
      expect(html).toContain(`>PROVIN</span>`);
    });
  }

  it("«Labota versija» statusa kartē", () => {
    const html = dealerDataOperatorMessageEmailHtml({ text: "Labdien!", b2bClient: true, context: ctx({ discreet: true, corrected: true }) });
    expect(html).toContain("Labota versija");
    expect(html).not.toContain("Atskaite gatava");
  });
});

describe("AUDITS forma - B2C e-pasts", () => {
  it("konsultācijas bloks pirms paraksta, jautājumu rinda netiek atkārtota, rēķina rindas nav", () => {
    const msg = buildAuditSendMessage({ channel: "email", situation: "ready", b2b: false, vin: VIN, car: "Audi A6", lang: "lv" });
    const html = dealerDataOperatorMessageEmailHtml({ text: msg.text, lang: "lv", context: ctx({ consult: true }) });
    expect(html).toContain("PROVIN AUDITS");
    expect(html).toContain("Vajag konsultāciju par šo auto?");
    expect(html.indexOf("Vajag konsultāciju")).toBeLessThan(html.indexOf("Ar cieņu,"));
    expect(html.split("Ja ir jautājumi, vienkārši atbildiet uz šo e-pastu.").length - 1).toBe(1);
    expect(html).not.toMatch(/Rēķins|PRV-20/);
  });

  it("bez konsultācijas ķekša - bloka nav, jautājumu rinda paliek", () => {
    const msg = buildAuditSendMessage({ channel: "email", situation: "ready", b2b: false, vin: VIN, lang: "en" });
    const html = dealerDataOperatorMessageEmailHtml({ text: msg.text, lang: "en", context: ctx() });
    expect(html).not.toContain("Need advice on this car?");
    expect(html).toContain("If you have any questions, simply reply to this email.");
  });
});
