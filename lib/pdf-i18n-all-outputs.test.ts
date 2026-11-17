import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { emptyAutoRecordsBlock, emptyCsddFields } from "@/lib/admin-source-blocks";
import { emptyAsvBlock } from "@/lib/asv-report";
import { buildB2bDemoOfferPrintHtml, buildB2bDemoOrderPrintHtml } from "@/lib/b2b-demo-order-pdf-html";
import { emptyB2bDemoSettings } from "@/lib/b2b-demo-settings";
import { createB2bDemoOrder, emptyB2bDemoOffer, newB2bDemoOfferId } from "@/lib/b2b-demo-orders";
import { emptyCcVinBlock } from "@/lib/cc-vin-report";
import {
  buildClientReportDocumentHtml,
  type ClientReportLang,
  type ClientReportPayload,
} from "@/lib/client-report-html";
import { CLIENT_REPORT_LANGS, clientReportDateLocale } from "@/lib/client-report-i18n";
import { buildInvoiceHtml, toInvoiceOrderPayload } from "@/lib/generate-invoice-html";
import { buildIrissOfferPrintHtml, buildIrissPasutijumsPrintHtml } from "@/lib/iriss-pasutijums-pdf-html";
import { emptyIrissOfferRecord, emptyIrissPasutijums } from "@/lib/iriss-pasutijumi-types";
import { emptyOutvinDealerReport, emptyOutvinVehicleInfo } from "@/lib/outvin-dealer-types";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildDealerVisitSummaryHtml } from "@/lib/pdf-dealer-timeline";

const LONG_DASHES = /[\u2013\u2014]/;
const LV_DIACRITIC = /[āčēģīķļņšūžĀČĒĢĪĶĻŅŠŪŽ]/;
const DE_UMLAUT = /[äöüÄÖÜß]/;
const CYRILLIC = /[\u0400-\u04FF]/;

const LANG_MARKERS: Record<ClientReportLang, { must: string[]; mustNot: string[] }> = {
  lv: {
    must: [
      "content:\"Lapa \" counter(page)",
      "Sagatavots klientam:",
      "Transportlīdzekļa informācija",
      "Modelis",
      "Jauda",
      "Degviela",
      "Automātiskā",
      "Benzīns",
      "Somija",
    ],
    mustNot: [
      "content:\"Page \" counter(page)",
      "content:\"Страница \" counter(page)",
      "content:\"Seite \" counter(page)",
      "Prepared for:",
      "Подготовлено для:",
      "Erstellt für:",
      "Vehicle information",
      "Информация об автомобиле",
      "Fahrzeuginformationen",
    ],
  },
  en: {
    must: [
      "content:\"Page \" counter(page)",
      "Prepared for:",
      "Vehicle information",
      "Major work",
      "Automatic",
      "Petrol",
    ],
    mustNot: [
      "content:\"Lapa \" counter(page)",
      "content:\"Страница \" counter(page)",
      "content:\"Seite \" counter(page)",
      "Sagatavots klientam:",
      "Transportlīdzekļa informācija",
      "Lielie darbi",
      ">Modelis<",
      ">Jauda<",
      ">Degviela<",
      "Информация об автомобиле",
      "Fahrzeuginformationen",
    ],
  },
  ru: {
    must: [
      "content:\"Страница \" counter(page)",
      "Подготовлено для:",
      "Информация об автомобиле",
      "Мощность",
      "Топливо",
      "Автоматическая",
      "Бензин",
    ],
    mustNot: [
      "content:\"Lapa \" counter(page)",
      "content:\"Page \" counter(page)",
      "content:\"Seite \" counter(page)",
      "Sagatavots klientam:",
      "Prepared for:",
      "Transportlīdzekļa informācija",
      ">Modelis<",
      ">Jauda<",
      ">Degviela<",
      "Lielie darbi",
      "Vehicle information",
      "Fahrzeuginformationen",
    ],
  },
  de: {
    must: [
      "content:\"Seite \" counter(page)",
      "Erstellt für:",
      "Fahrzeuginformationen",
      "Leistung",
      "Kraftstoff",
      "Automatik",
      "Benzin",
    ],
    mustNot: [
      "content:\"Lapa \" counter(page)",
      "content:\"Page \" counter(page)",
      "content:\"Страница \" counter(page)",
      "Sagatavots klientam:",
      "Prepared for:",
      "Подготовлено для:",
      "Transportlīdzekļa informācija",
      ">Modelis<",
      ">Jauda<",
      ">Degviela<",
      "Lielie darbi",
      "Vehicle information",
      "Информация об автомобиле",
    ],
  },
};

function dealerVehicle() {
  return {
    ...emptyOutvinVehicleInfo(),
    model: "BMW 650i",
    vinCode: "WBAJB11080B123456",
    transmission: "automatic",
    body: "coupe",
    drive: "rear-wheel drive",
    fuel: "petrol",
    power: "250 kW / 340 hp",
    countryRegion: "Finland",
    color: "Black metallic",
    interior: "Leather Black",
    steeringSide: "left-hand drive",
  };
}

function dealerPayload(kind: ClientReportPayload["pdfReportKind"] = "dealer"): ClientReportPayload {
  const csdd = emptyCsddFields();
  csdd.makeModel = "BMW 650i";
  return {
    sessionId: "cs_i18n",
    vin: "WBAJB11080B123456",
    created: 1_700_000_000,
    amountTotal: 9999,
    currency: "eur",
    paymentStatus: "paid",
    listingUrl: null,
    customerEmail: "klients@example.com",
    customerPhone: null,
    customerName: "Kristaps Vītoliņš",
    contactMethod: null,
    notes: null,
    csdd: "",
    ltab: "",
    tirgus: "",
    citi: "",
    iriss: "Auto ir pārbaudīts.",
    apskatesPlāns: "Pārbaudīt krāsas biezumu.",
    tehniskoRiskuAnalize: "Tehnisko risku analīze ir īsa.",
    cenasAtbilstiba: "",
    pdfReportKind: kind,
    csddForm: csdd,
    autoRecordsBlock: {
      ...emptyAutoRecordsBlock(),
      outvinReport: {
        ...emptyOutvinDealerReport(),
        vehicleInfo: dealerVehicle(),
      },
      serviceWorks: [
        {
          date: "01.06.2018",
          odometer: "40000",
          location: "BMW Helsinki, FI-00100",
          works: "Regulārā apkope: eļļas maiņa",
        },
        {
          date: "01.08.2021",
          odometer: "95000",
          location: "BMW Helsinki, FI-00100",
          works: "Sadales ķēdes komplekta maiņa",
        },
      ],
    },
  } as ClientReportPayload;
}

function renderReport(kind: ClientReportPayload["pdfReportKind"], lang: ClientReportLang): string {
  return buildClientReportDocumentHtml({
    payload: dealerPayload(kind),
    portfolio: [],
    pdfInsights: [],
    dateFmt: new Intl.DateTimeFormat(clientReportDateLocale(lang), {
      dateStyle: "long",
      timeStyle: "short",
    }),
    formatBytes: () => "0 B",
    lang,
  });
}

function asvPayload(): ClientReportPayload {
  const asv = emptyAsvBlock();
  asv.damages = [{ date: "12.04.2019", region: "Florida", amount: "2400", description: "Rear bumper" }];
  return {
    ...dealerPayload("asv"),
    asvBlock: asv,
    autoRecordsBlock: undefined,
  } as ClientReportPayload;
}

function auctionPayload(): ClientReportPayload {
  const cc = emptyCcVinBlock();
  cc.damages = [{ date: "03.03.2018", region: "Texas", amount: "1800", description: "Front" }];
  return {
    ...dealerPayload(undefined),
    pdfReportKind: undefined,
    ccVinBlock: cc,
  } as ClientReportPayload;
}

describe("client report PDF language consistency", () => {
  const kinds = [undefined, "dealer", "business", "asv"] as const;

  for (const kind of kinds) {
    for (const lang of CLIENT_REPORT_LANGS) {
      it(`renders ${kind ?? "audits"} PDF in ${lang} without other-language labels`, () => {
        const html =
          kind === "asv"
            ? buildClientReportDocumentHtml({
                payload: asvPayload(),
                portfolio: [],
                pdfInsights: [],
                dateFmt: new Intl.DateTimeFormat(clientReportDateLocale(lang), { dateStyle: "long" }),
                formatBytes: () => "0 B",
                lang,
              })
            : renderReport(kind, lang);
        expect(html).toContain(`<html lang="${lang}"`);
        expect(html).toContain('charset="utf-8"');
        expect(LONG_DASHES.test(html), html.slice(0, 200)).toBe(false);
        const markers = LANG_MARKERS[lang];
        if (kind === "dealer" || kind === undefined) {
          for (const needle of markers.must) {
            expect(html, needle).toContain(needle);
          }
          for (const needle of markers.mustNot) {
            expect(html, needle).not.toContain(needle);
          }
        } else {
          expect(html).toContain(
            lang === "lv"
              ? "content:\"Lapa \""
              : lang === "en"
                ? "content:\"Page \""
                : lang === "ru"
                  ? "content:\"Страница \""
                  : "content:\"Seite \"",
          );
          expect(html).not.toContain(
            lang === "lv" ? "content:\"Page \"" : "content:\"Lapa \"",
          );
        }
        if (lang === "lv") expect(html).toMatch(LV_DIACRITIC);
        if (lang === "de") expect(html).toMatch(DE_UMLAUT);
        if (lang === "ru") expect(html).toMatch(CYRILLIC);
      });
    }
  }

  it("keeps addresses and VIN intact in every language", () => {
    for (const lang of CLIENT_REPORT_LANGS) {
      const html = renderReport("dealer", lang);
      expect(html).toContain("WBAJB11080B123456");
      expect(html).toContain("BMW Helsinki, FI-00100");
      expect(html).toContain("BMW 650i");
    }
  });

  it("renders auction / Izsoļu portālu arhīvs section titles in the report language", () => {
    for (const lang of CLIENT_REPORT_LANGS) {
      const html = buildClientReportDocumentHtml({
        payload: auctionPayload(),
        portfolio: [],
        pdfInsights: [],
        dateFmt: new Intl.DateTimeFormat(clientReportDateLocale(lang), { dateStyle: "long" }),
        formatBytes: () => "0 B",
        lang,
      });
      if (lang === "en") expect(html).toContain("AUCTION PLATFORM ARCHIVE");
      if (lang === "ru") expect(html).toContain("АРХИВ АУКЦИОННЫХ ПЛОЩАДОК");
      if (lang === "de") expect(html).toContain("AUKTIONSARCHIV");
      if (lang === "lv") expect(html).toContain("IZSOĻU PORTĀLU ARHĪVS");
    }
  });
});

describe("dealer summary yes/no is rendered, not swept globally", () => {
  const rows = [
    {
      date: "01.01.2018",
      odometer: "40000",
      location: "BMW Bonn",
      works: "Technische Aktion 001234 software update",
    },
    {
      date: "01.08.2021",
      odometer: "95000",
      location: "BMW Bonn",
      works: "Eļļas maiņa",
    },
  ];

  it("uses Ja/Yes/Да/Jā only in the campaign cell", () => {
    expect(buildDealerVisitSummaryHtml(rows, null, "lv")).toContain(">Jā<");
    expect(buildDealerVisitSummaryHtml(rows, null, "en")).toContain(">Yes<");
    expect(buildDealerVisitSummaryHtml(rows, null, "ru")).toContain(">Да<");
    expect(buildDealerVisitSummaryHtml(rows, null, "de")).toContain(">Ja<");
    expect(buildDealerVisitSummaryHtml(rows, null, "en")).not.toContain(">Jā<");
    expect(buildDealerVisitSummaryHtml(rows, null, "ru")).not.toContain("Vizītes");
  });
});

function assertLvOnlyPdf(html: string, uniqueLv: string[]) {
  expect(html).toContain('lang="lv"');
  expect(html).toContain("charset=\"utf-8\"");
  expect(LONG_DASHES.test(html)).toBe(false);
  expect(html).toMatch(LV_DIACRITIC);
  expect(html).not.toContain("Sub Total");
  expect(html).not.toContain("content:\"Page \"");
  expect(html).not.toContain("Prepared for:");
  expect(html).not.toContain("Подготовлено для:");
  expect(html).not.toContain("Erstellt für:");
  for (const needle of uniqueLv) expect(html).toContain(needle);
}

describe("LV-only generated PDFs stay Latvian", () => {
  it("invoice HTML", () => {
    const html = buildInvoiceHtml(
      toInvoiceOrderPayload(
        {
          id: "cs_test_i18n",
          created: 1_700_000_000,
          amountTotal: 7999,
          currency: "EUR",
          customerEmail: "demo@provin.lv",
          customerDetailsEmail: "demo@provin.lv",
          vin: "WVWZZZ3CZWE123456",
          customerName: "Jānis Bērziņš",
        },
        "PRV-2026-0008",
      ),
    );
    assertLvOnlyPdf(html, ["Rēķins", "Starpsumma", "Kopā", "Pakalpojuma sniedzējs"]);
    expect(html).not.toContain(">Total<");
    const invoicePdfSrc = readFileSync(join(process.cwd(), "lib/invoice-pdf.ts"), "utf8");
    expect(invoicePdfSrc).toContain("Starpsumma");
    expect(invoicePdfSrc).toContain("Kopā");
    expect(invoicePdfSrc).not.toContain("Sub Total");
  });

  it("IRISS offer and order contracts", () => {
    const rec = emptyIrissPasutijums("pdf-i18n-order", "2026-04-15T10:00:00.000Z");
    rec.clientFirstName = "Jānis";
    rec.clientLastName = "Bērziņš";
    rec.phone = "+37120000000";
    rec.email = "klients@example.com";
    rec.brandModel = "BMW 320d";
    rec.engineType = "Dīzelis";
    rec.notes = "Piezīme ar āēīū";
    const offer = emptyIrissOfferRecord("off-i18n", "2026-04-15T10:00:00.000Z", "BMW 320d");
    offer.brandModel = "BMW 320d";
    offer.summary = "Kopsavilkums";
    offer.visualAssessment = "Labs stāvoklis";
    const offerHtml = buildIrissOfferPrintHtml(rec, offer, "2026. gada 15. aprīlis", null);
    const orderHtml = buildIrissPasutijumsPrintHtml(rec, "2026. gada 15. aprīlis", null);
    assertLvOnlyPdf(offerHtml, ["Klienta dati", "Kopsavilkums"]);
    assertLvOnlyPdf(orderHtml, ["Klienta dati", "Dīzelis"]);
  });

  it("B2B / IRISS partner order and offer", () => {
    const settings = emptyB2bDemoSettings("tnt_pdfi18n");
    settings.companyName = "Auto Sala";
    settings.pdfFooterText = "Auto Sala kājene";
    const order = createB2bDemoOrder("tnt_pdfi18n", {
      clientFirstName: "Jānis",
      clientLastName: "Kalniņš",
      brandModel: "Volvo XC60",
      transmission: "Automātiskā",
    });
    const offer = emptyB2bDemoOffer(newB2bDemoOfferId(), order.createdAt, "Piedāvājums 1");
    offer.carPrice = "18000";
    order.offers = [offer];
    const orderHtml = buildB2bDemoOrderPrintHtml(order, settings, {
      tenantName: "Auto Sala",
      generatedAt: "2026. gada 16. oktobris",
    });
    const offerHtml = buildB2bDemoOfferPrintHtml(order, offer, settings, {
      tenantName: "Auto Sala",
      generatedAt: "2026. gada 16. oktobris",
    });
    assertLvOnlyPdf(orderHtml, ["Klients", "Volvo XC60"]);
    assertLvOnlyPdf(offerHtml, ["Klients", "Volvo XC60"]);
  });
});
