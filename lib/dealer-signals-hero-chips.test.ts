import { describe, expect, it } from "vitest";
import {
  buildClientReportDocumentHtml,
  buildDealerSignalsHeroChipsHtml,
  buildDealerSignalsSectionHtml,
  type ClientReportPayload,
} from "@/lib/client-report-html";
import { createDefaultSourceBlocks, emptyCsddFields } from "@/lib/admin-source-blocks";
import { DEALER_ONLY_PDF_VISIBILITY } from "@/lib/pdf-visibility";
import { emptyOutvinDealerReport } from "@/lib/outvin-dealer-types";
import { DEALER_SIGNALS_AUDIT_INFO, DEALER_SIGNALS_HERO_MORE, DEALER_SIGNALS_SECTION_TITLE, type DealerSignalsState } from "@/lib/dealer-signals";

/** Kā maketā B: īpašs statuss (sarkans), negadījumi, ASV vēsture, izsoļu foto. */
const FOUR: DealerSignalsState = {
  enabled: true,
  items: [
    { kind: "special_status", checked: true },
    { kind: "incidents", checked: true },
    { kind: "us_history", checked: true },
    { kind: "auction_photos", checked: true },
  ],
};

function payload(overrides: Partial<ClientReportPayload> = {}): ClientReportPayload {
  const csdd = emptyCsddFields();
  csdd.makeModel = "BMW 530d";
  return {
    sessionId: "cs_test",
    vin: "WBAJL71000BX48215",
    created: Date.now(),
    amountTotal: 2499,
    currency: "eur",
    paymentStatus: "paid",
    listingUrl: null,
    customerEmail: null,
    customerPhone: null,
    customerName: null,
    contactMethod: null,
    notes: null,
    csdd: "",
    ltab: "",
    tirgus: "",
    citi: "",
    iriss: "",
    apskatesPlāns: "",
    tehniskoRiskuAnalize: "",
    cenasAtbilstiba: "",
    pdfReportKind: "dealer",
    pdfVisibility: DEALER_ONLY_PDF_VISIBILITY,
    csddForm: csdd,
    autoRecordsBlock: {
      ...createDefaultSourceBlocks().auto_records,
      outvinReport: {
        ...emptyOutvinDealerReport(),
        vehicleInfo: { ...emptyOutvinDealerReport().vehicleInfo, model: "BMW 530d xDrive", vinCode: "WBAJL71000BX48215", power: "195 kW" },
      },
      serviceWorks: [
        { date: "01.12.2021", odometer: "31200", location: "BMW Bonn", works: "Eļļas maiņa" },
        { date: "01.12.2023", odometer: "47521", location: "BMW Bonn", works: "Eļļas maiņa" },
      ],
    },
    dealerSignals: FOUR,
    dealerSignalsAuditLink: { url: "https://www.provin.lv/lv/papildinajums/abc" },
    ...overrides,
  } as ClientReportPayload;
}

const docOf = (p: ClientReportPayload, lang: "lv" | "en" | "ru" | "de" = "lv") =>
  buildClientReportDocumentHtml({
    payload: p,
    lang,
    portfolio: [],
    pdfInsights: [],
    dateFmt: new Intl.DateTimeFormat("lv-LV"),
    formatBytes: () => "0 B",
  });

const bodyOf = (html: string) => html.replace(/<style[\s\S]*?<\/style>/g, "").replace(/<script[\s\S]*?<\/script>/g, "");

describe("dīlera PDF signālu žetoni 1. lapā (makets B)", () => {
  it("žetoni ir dīlera vāka kartītē zem VIN rindas, pirms nobraukuma un pilnās sadaļas", () => {
    const html = bodyOf(docOf(payload()));
    const cover = html.match(/<div class="pdf-dealer-cover">[\s\S]*?<\/div>\s*<\/div>/)?.[0] ?? "";
    expect(cover).toContain('class="pdf-dealer-chips"');
    const iMeta = html.indexOf("pdf-dealer-cover__meta");
    const iChips = html.indexOf('class="pdf-dealer-chips"');
    const iFull = html.indexOf('id="dealer-signals"');
    expect(iMeta).toBeGreaterThan(-1);
    expect(iChips).toBeGreaterThan(iMeta);
    expect(iFull).toBeGreaterThan(iChips);
    const iLbl = html.indexOf("pdf-dealer-cover__lbl");
    if (iLbl > -1) expect(iChips).toBeLessThan(iLbl);
    expect(html.match(/class="pdf-dealer-chip[ "]/g)).toHaveLength(4);
    // Pilnā tabula paliek savā vietā.
    expect(html.match(/<tr class="pdf-dealer-signal-row/g)).toHaveLength(4);
  });

  it("sarkanais signāls - sarkanais žetons; pārējie bez krāsas klases", () => {
    const html = buildDealerSignalsHeroChipsHtml(payload(), "lv");
    expect(html).toMatch(/class="pdf-dealer-chip pdf-dealer-chip--red" data-signal="special_status"/);
    expect(html).toMatch(/class="pdf-dealer-chip" data-signal="incidents"/);
    expect(html.match(/pdf-dealer-chip--red/g)).toHaveLength(1);
    expect(html).toContain("Īpašs statuss");
    expect(html).toContain("ASV vēsture");
    expect(html).toContain('href="#dealer-signals"');
    // Makets B (28.11): 1. lapā audita saites nav.
    expect(html).not.toContain("papildinajums");
    expect(html).not.toContain("PROVIN AUDIT");
    expect(html).not.toMatch(/[–—]/);
    expect(html.replace(/<[^>]*>/g, " ")).not.toMatch(/\d/);
  });

  it("oranžais tonis un ikonas pēc tipa", () => {
    const html = buildDealerSignalsHeroChipsHtml(
      payload({ dealerSignals: { enabled: true, items: [{ kind: "archive_photos", checked: true }, { kind: "extra_history", checked: true }] } }),
      "lv",
    );
    expect(html).toMatch(/pdf-dealer-chip--orange" data-signal="archive_photos"/);
    expect(html.match(/<svg /g)).toHaveLength(2);
  });

  it("bez signāliem vai ne-dīlera PDF - bloka nav", () => {
    expect(buildDealerSignalsHeroChipsHtml(payload({ dealerSignals: null }), "lv")).toBe("");
    expect(buildDealerSignalsHeroChipsHtml(payload({ dealerSignals: { ...FOUR, enabled: false } }), "lv")).toBe("");
    expect(buildDealerSignalsHeroChipsHtml(payload({ pdfReportKind: "full" }), "lv")).toBe("");
    expect(bodyOf(docOf(payload({ dealerSignals: null })))).not.toContain("pdf-dealer-chips");
  });

  it("pilnās sadaļas apakšā pelēka info rinda; saite tikai uz «pasūtīt», bez cenas; bez https - nav", () => {
    const withPrice = payload({ dealerSignalsAuditLink: { url: "https://www.provin.lv/lv/papildinajums/abc", priceLabel: "79,99 €" } });
    const sec = buildDealerSignalsSectionHtml(withPrice, "lv");
    expect(sec).toContain('<a href="https://www.provin.lv/lv/papildinajums/abc">pasūtīt</a> ↗');
    expect(sec.match(/<a /g)).toHaveLength(1);
    expect(sec).not.toContain("79,99");
    expect(sec).not.toContain("pdf-dealer-signals-cta");
    const noHttps = payload({ dealerSignalsAuditLink: { url: "http://x.lv" } });
    expect(buildDealerSignalsSectionHtml(noHttps, "lv")).not.toContain("pdf-dealer-signals-info");
    expect(buildDealerSignalsHeroChipsHtml(noHttps, "lv")).toContain(DEALER_SIGNALS_HERO_MORE.lv);
    for (const lang of ["en", "ru", "de"] as const) {
      const html = buildDealerSignalsSectionHtml(withPrice, lang);
      expect(html).toContain(`${DEALER_SIGNALS_AUDIT_INFO[lang].lead}<a href="https://www.provin.lv/lv/papildinajums/abc">${DEALER_SIGNALS_AUDIT_INFO[lang].link}</a>`);
      expect(html).not.toContain(DEALER_SIGNALS_AUDIT_INFO.lv.link);
    }
  });

  it("EN/RU/DE virsraksti un norāde tulkoti", () => {
    for (const lang of ["en", "ru", "de"] as const) {
      const html = buildDealerSignalsHeroChipsHtml(payload(), lang);
      expect(html).toContain(`<p class="pdf-dealer-chips__lbl">${DEALER_SIGNALS_SECTION_TITLE[lang]}</p>`);
      expect(html).toContain(DEALER_SIGNALS_HERO_MORE[lang]);
      expect(html).not.toContain(DEALER_SIGNALS_SECTION_TITLE.lv);
    }
    expect(buildDealerSignalsHeroChipsHtml(payload(), "en")).toContain("Special status");
    expect(buildDealerSignalsHeroChipsHtml(payload(), "de")).toContain("Sonderstatus");
  });
});
