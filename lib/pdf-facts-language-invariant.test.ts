/**
 * 25.11.2026 (PR #1233 tests): EN PDF 1. lapas kartītē «Īpašnieki» rādīja «abroad 1», LV - 3.
 * Cēlonis: īpašnieku skaits u.c. fakti tika lasīti no avotu teksta (`ownersSummary`, komentāri)
 * PĒC tam, kad AI to bija iztulkojis (latviešu regex vairs neatrada «N īpašnieki»).
 * Sargtests: tas pats payload LV/EN/RU/DE -> identiski skaitļi 6a kartītēs un kopsavilkumā.
 * Tikai izdomāti dati (repo ir publisks).
 */
import { describe, expect, it } from "vitest";
import {
  SOURCE_BLOCK_LABELS,
  emptyAutoRecordsBlock,
  emptyCsddFields,
} from "@/lib/admin-source-blocks";
import { emptyCcVinBlock } from "@/lib/cc-vin-report";
import { buildClientReportDocumentHtml, type ClientReportPayload } from "@/lib/client-report-html";
import type { ClientReportLang } from "@/lib/client-report-i18n";
import {
  applyClientReportTranslatedTexts,
  collectClientReportTranslatableTexts,
} from "@/lib/client-report-translatable-fields";

function factsPayload(): ClientReportPayload {
  const csdd = emptyCsddFields();
  csdd.vin = "WBA00000000000001";
  csdd.registrationNumber = "XX0000";
  csdd.firstRegistration = "2016-03-10";
  csdd.firstRegistrationLatvia = "2020-05-14";
  csdd.ownerCountLatvia = "2";
  csdd.ownerRegistrationEvents = [
    { date: "14.05.2020", label: "Pirmā reģistrācija Latvijā" },
    { date: "02.03.2023", label: "Īpašnieka maiņa" },
  ];
  csdd.comments = "Latvijā 2 īpašnieki, tehniskā apskate bez būtiskiem trūkumiem.";

  const ar = emptyAutoRecordsBlock();
  ar.serviceHistory = [
    { date: "12.04.2017", odometer: "30000", country: "DE" },
    { date: "20.05.2019", odometer: "61000", country: "DE" },
  ];
  ar.comments = "Divas apkopes pie dīlera.";

  const cc = emptyCcVinBlock();
  cc.comments = "Pārdots izsolē Vācijā, 2 īpašnieki pirms ievešanas.";
  cc.sales = [
    { date: "11.02.2020", venue: "Testa izsole", odometer: "87900", price: "9 900 €", status: "Pārdots" },
    { date: "20.01.2020", venue: "Testa izsole", odometer: "87500", price: "", status: "Nav pārdots" },
  ];

  return {
    sessionId: "cs_test_valodas",
    isDemo: false,
    vin: "WBA00000000000001",
    created: Date.UTC(2026, 10, 25) / 1000,
    amountTotal: null,
    currency: "eur",
    paymentStatus: "paid",
    listingUrl: null,
    customerEmail: null,
    customerPhone: null,
    customerName: null,
    contactMethod: null,
    notes: null,
    csdd: "",
    csddForm: csdd,
    ltab: "",
    tirgus: "",
    citi: "",
    iriss: "",
    apskatesPlāns: "",
    tehniskoRiskuAnalize: "Auto kopumā labā stāvoklī.",
    cenasAtbilstiba: "",
    autoRecordsBlock: ar,
    ccVinBlock: cc,
    manualVendorBlocks: [
      {
        title: SOURCE_BLOCK_LABELS.carvertical,
        mileageRows: [
          { date: "10.03.2016", odometer: "10", country: "DE" },
          { date: "01.02.2018", odometer: "45200", country: "DE" },
          { date: "01.04.2020", odometer: "88400", country: "DE" },
        ],
        incidentRows: [{ incidentNo: "1", csngDate: "15.08.2018", lossAmount: "" }],
        comments: "Vācijā 3 īpašnieki. Negadījums 2018. gadā.",
        ownersSummary: "Īpašnieku skaits: 3 (Vācijā)",
      },
      {
        title: SOURCE_BLOCK_LABELS.autodna,
        mileageRows: [],
        incidentRows: [],
        comments: "3 īpašnieki Vācijā.",
        ownersSummary: "3 īpašnieki",
      },
    ],
  } as ClientReportPayload;
}

/** Reālās plūsmas imitācija: AI iztulko avotu brīvo tekstu (sk. translateClientReportPayloadForPrint). */
const FAKE_AI: Record<Exclude<ClientReportLang, "lv">, (s: string) => string> = {
  en: (s) =>
    s
      .replace(/Īpašnieku skaits/g, "Number of owners")
      .replace(/īpašnieki/g, "owners")
      .replace(/Vācijā/g, "in Germany")
      .replace(/Latvijā/g, "in Latvia")
      .replace(/[āčēģīķļņšūž]/gi, "e"),
  ru: (s) => s.replace(/Īpašnieku skaits/g, "Количество владельцев").replace(/īpašnieki/g, "владельца").replace(/Vācijā/g, "в Германии").replace(/[a-zāčēģīķļņšūž]+/gi, "текст"),
  de: (s) => s.replace(/Īpašnieku skaits/g, "Anzahl der Halter").replace(/īpašnieki/g, "Halter").replace(/Vācijā/g, "in Deutschland").replace(/[āčēģīķļņšūž]/gi, "e"),
};

function render(p: ClientReportPayload, lang: ClientReportLang): string {
  let payload = p;
  if (lang !== "lv") {
    const texts = collectClientReportTranslatableTexts(p);
    for (const k of Object.keys(texts)) texts[k] = FAKE_AI[lang](texts[k]!);
    payload = applyClientReportTranslatedTexts(p, texts);
  }
  return buildClientReportDocumentHtml({
    payload,
    portfolio: [],
    pdfInsights: [],
    dateFmt: new Intl.DateTimeFormat("lv-LV"),
    formatBytes: () => "0 B",
    lang,
  });
}

function textOf(fragment: string): string {
  return fragment.replace(/<[^>]+>/g, " ").replace(/&nbsp;| /g, " ").replace(/\s+/g, " ").trim();
}

/** Visi skaitļi katrā 1. lapas kartītē (pēc id) + odometrs un vecums. */
function topNumbers(html: string): Record<string, string[]> {
  const top = html.match(/<section class="pdf-top6"[\s\S]*?<\/section>/)?.[0] ?? "";
  const out: Record<string, string[]> = {};
  const cardRe = /<div class="pdf-top6-card pdf-top6-card--([a-z0-9-]+)"[^>]*>([\s\S]*?)<\/div>/g;
  for (const m of top.matchAll(cardRe)) {
    out[m[1]!] = textOf(m[2]!).match(/\d+/g) ?? [];
  }
  const odo = top.match(/<div class="pdf-top6__odo">([\s\S]*?)<\/div>/)?.[1] ?? "";
  out.odometer = textOf(odo).match(/\d+/g) ?? [];
  const pair = top.match(/<div class="pdf-top6__pair">([\s\S]*?)<\/div><\/div>/)?.[1] ?? "";
  out.ageAndFirstReg = textOf(pair).match(/\d+/g) ?? [];
  return out;
}

describe("PDF fakti nav atkarīgi no valodas (LV/EN/RU/DE)", () => {
  const lv = topNumbers(render(factsPayload(), "lv"));

  it("LV bāze: īpašnieki Latvijā 2 + Vācijā 3, kartītes ir", () => {
    expect(lv.owners).toEqual(["2", "3"]);
    expect(Object.keys(lv)).toEqual(
      expect.arrayContaining(["owners", "incidents", "service", "auctions", "odometer", "ageAndFirstReg"]),
    );
    expect(lv.ageAndFirstReg.length).toBeGreaterThan(0);
  });

  for (const lang of ["en", "ru", "de"] as const) {
    it(`${lang}: identiski skaitļi visās kartītēs`, () => {
      expect(topNumbers(render(factsPayload(), lang))).toEqual(lv);
    });
  }

  it("tulkotajā payload fakti nāk no oriģināla, ne no AI teksta", () => {
    const p = factsPayload();
    const texts = collectClientReportTranslatableTexts(p);
    for (const k of Object.keys(texts)) texts[k] = "Translated text.";
    const translated = applyClientReportTranslatedTexts(p, texts);
    expect(translated.manualVendorBlocks?.[0]?.ownersSummary).toBe("Translated text.");
    const en = topNumbers(
      buildClientReportDocumentHtml({
        payload: translated,
        portfolio: [],
        pdfInsights: [],
        dateFmt: new Intl.DateTimeFormat("lv-LV"),
        formatBytes: () => "0 B",
        lang: "en",
      }),
    );
    expect(en).toEqual(lv);
  });
});
