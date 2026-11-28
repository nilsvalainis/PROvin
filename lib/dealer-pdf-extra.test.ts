import { describe, expect, it } from "vitest";
import {
  buildClientReportDocumentHtml,
  buildReportPreviewDocumentHtml,
  dealerExtraAvailability,
  genericizeSectionHead,
  type ClientReportPayload,
} from "@/lib/client-report-html";
import {
  createDefaultSourceBlocks,
  emptyCsddFields,
  SOURCE_BLOCK_LABELS,
  type ClientManualVendorBlockPdf,
} from "@/lib/admin-source-blocks";
import {
  dealerExtraCombinedVisibility,
  normalizeDealerExtra,
  DEALER_EXTRA_SECTION_TITLE,
} from "@/lib/dealer-pdf-extra";
import { DEALER_ONLY_PDF_VISIBILITY } from "@/lib/pdf-visibility";

function vendor(title: string, km: string, date: string, loss = ""): ClientManualVendorBlockPdf {
  return {
    title,
    mileageRows: [{ date, odometer: km, country: "Igaunija" } as never],
    incidentRows: loss ? [{ incidentNo: "1", csngDate: date, lossAmount: loss }] : [],
    comments: `${title} komentārs`,
    statusRecords: `${title} statuss`,
  };
}

function payload(overrides: Partial<ClientReportPayload> = {}): ClientReportPayload {
  const csdd = emptyCsddFields();
  csdd.makeModel = "BMW 530d";
  csdd.firstRegistration = "12.05.2017";
  csdd.mileageHistory = [{ date: "28.10.2025", odometer: "143850", country: "Latvija" } as never];
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
      serviceWorks: [{ date: "01.12.2023", odometer: "47521", location: "BMW Bonn", works: "Eļļas maiņa" }],
    },
    manualVendorBlocks: [
      vendor(SOURCE_BLOCK_LABELS.autodna, "99000", "01.01.2022", "1200"),
      vendor(SOURCE_BLOCK_LABELS.carvertical, "98000", "01.02.2022", "900"),
      vendor(SOURCE_BLOCK_LABELS.mnt_ee, "120000", "01.06.2024"),
    ],
    manualLtabBlock: { rows: [{ incidentNo: "L1", csngDate: "02.08.2023", lossAmount: "1500" }], comments: "LTAB teksts" },
    internalComment: "Admin negadījumu komentārs ar AutoDNA",
    mileageComment: "Admin nobraukuma komentārs",
    ...overrides,
  } as ClientReportPayload;
}

const docOf = (p: ClientReportPayload, lang: "lv" | "en" = "lv") =>
  buildClientReportDocumentHtml({
    payload: p,
    lang,
    portfolio: [],
    pdfInsights: [],
    dateFmt: new Intl.DateTimeFormat("lv-LV"),
    formatBytes: () => "0 B",
  });

/** Bez <style>/<script> (CSS klašu nosaukumos ir avotu vārdi). */
function bodyOf(html: string): string {
  return html.replace(/<style[\s\S]*?<\/style>/g, "").replace(/<script[\s\S]*?<\/script>/g, "");
}

function extraPart(html: string): string {
  return html.match(/<div class="pdf-dealer-extra"[\s\S]*$/)?.[0] ?? "";
}

describe("dīlera PDF EXTRA", () => {
  it("bez izvēles - nekādas EXTRA sadaļas (kā līdz šim)", () => {
    const html = docOf(payload());
    expect(html).not.toContain("pdf-dealer-extra");
    expect(html).not.toContain("Citi avoti");
    expect(html).not.toContain("NOBRAUKUMA VĒSTURE");
    expect(html).not.toContain("MNT.EE");
    expect(html).toContain("OFICIĀLĀ DĪLERA DATI");
  });

  it("ieslēdz tikai izvēlētās sadaļas", () => {
    const html = docOf(payload({ dealerExtra: ["mnt_ee"] }));
    const extra = extraPart(html);
    expect(extra).toContain("Citi avoti");
    expect(extra).toContain("Igaunijas reģistrs");
    expect(extra).toContain("statuss");
    // Neizvēlētie: nav CSDD kartītes, LTAB, kopējo tabulu
    expect(extra).not.toContain("LTAB teksts");
    expect(extra).not.toContain('class="pdf-csdd');
    expect(extra).not.toContain("NOBRAUKUMA VĒSTURE");
    expect(extra).not.toContain("NEGADĪJUMU VĒSTURE");
    // Kājene paliek dīlera
    expect(html).not.toContain("PROVIN_BUSINESS");
  });

  it("virsrakstos nav avotu logo un piegādātāju nosaukumu", () => {
    const extra = extraPart(docOf(payload({ dealerExtra: ["mnt_ee", "csdd", "ltab"] })));
    const heads = extra.match(/<h2 class="pdf-sec pdf-sec--nobar">[^<]*<\/h2>/g) ?? [];
    expect(heads.length).toBeGreaterThan(1);
    for (const h of heads) expect(h).not.toMatch(/MNT\.EE|LTAB|AutoDNA|CarVertical/i);
    expect(extra).not.toContain("pdf-sec-brand-mark");
  });

  it("maksas avoti nekad - arī kopējās tabulās", () => {
    const html = docOf(
      payload({
        dealerExtra: ["unifiedMileage", "unifiedIncidents", "csdd", "ltab", "mnt_ee", "autodna", "carvertical", "carfax"] as never,
      }),
    );
    const extra = extraPart(html);
    expect(extra).toContain("NOBRAUKUMA VĒSTURE");
    expect(extra).toContain("143");
    expect(extra).toContain("120");
    const body = bodyOf(html);
    const hits = body.match(/.{0,80}(AutoDNA|CarVertical|CARFAX).{0,40}/gi);
    expect(hits).toBeNull();
    expect(html).not.toContain("99 000");
    expect(html).not.toContain("98 000");
    expect(html).not.toContain("Admin negadījumu komentārs");
    expect(html).not.toContain("Admin nobraukuma komentārs");
  });

  it("kopējā nobraukuma tabula ņem tikai izvēlētos avotus + dīleri", () => {
    const extra = extraPart(docOf(payload({ dealerExtra: ["unifiedMileage"] })));
    expect(extra).toContain("NOBRAUKUMA VĒSTURE");
    expect(extra).toContain("47");
    expect(extra).not.toContain("143");
    expect(extra).not.toContain("120 000");
  });

  it("EN virsraksts", () => {
    const html = docOf(payload({ dealerExtra: ["mnt_ee"] }), "en");
    expect(html).toContain(DEALER_EXTRA_SECTION_TITLE.en);
    expect(html).toContain("Estonian registry");
  });

  it("pieejamība: tikai sadaļas ar datiem, bez maksas avotiem", () => {
    const av = dealerExtraAvailability(payload());
    const keys = av.map((a) => a.key);
    expect(keys).toContain("csdd");
    expect(keys).toContain("ltab");
    expect(keys).toContain("mnt_ee");
    expect(keys).toContain("unifiedMileage");
    expect(keys).not.toContain("cc_vin");
    expect(keys).not.toContain("tjekbil");
    expect(keys as string[]).not.toContain("autodna");
    expect(keys as string[]).not.toContain("carvertical");
    expect(av.find((a) => a.key === "mnt_ee")?.count).toBe(1);
  });

  it("normalize - tikai zināmās atslēgas", () => {
    expect(normalizeDealerExtra(["autodna", "csdd", "csdd", "x", "unifiedMileage"])).toEqual(["unifiedMileage", "csdd"]);
    const v = dealerExtraCombinedVisibility(DEALER_ONLY_PDF_VISIBILITY, ["csdd"]);
    expect(v.autodna).toBe(false);
    expect(v.carvertical).toBe(false);
    expect(v.carfax).toBe(false);
    expect(v.csdd).toBe(true);
    expect(v.auto_records).toBe(true);
  });

  it("genericizeSectionHead aizstāj logo un nosaukumu", () => {
    const out = genericizeSectionHead(
      '<div class="pdf-sec-head pdf-sec-head--brand"><span class="pdf-sec-brand-mark" aria-hidden="true"><img class="pdf-ico--brand-logo"/></span><h2 class="pdf-sec pdf-sec--nobar">MNT.EE</h2><span class="b">1</span></div>',
      "<svg></svg>",
      "Igaunijas reģistrs",
    );
    expect(out).not.toContain("MNT.EE");
    expect(out).not.toContain("brand-logo");
    expect(out).toContain("Igaunijas reģistrs");
    expect(out).toContain('<span class="b">1</span>');
  });
});

describe("priekšskats", () => {
  const body = (h: string) => h.slice(h.indexOf("<body"));

  it("dīlera pasūtījums bez «+ Extra» - rāda visus datus, nevis «Nav datu» (Nils 27.11)", () => {
    const p = payload();
    const all = buildReportPreviewDocumentHtml(p, "all");
    expect(body(all)).not.toContain("pdf-preview-empty");
    expect(all).toContain("NOBRAUKUMA VĒSTURE");
    expect(all).toContain("NEGADĪJUMU VĒSTURE");
    expect(all).toContain("WBAJL71000BX48215");
    const mileage = buildReportPreviewDocumentHtml(p, "mileage");
    // CSDD, dīleris un visi avoti vienā tabulā.
    for (const km of ["143", "47", "99", "98", "120"]) expect(body(mileage)).toMatch(new RegExp(`${km}[\\s\u00a0 ]?\\d{3}`));
    expect(mileage).not.toContain("NEGADĪJUMU VĒSTURE");
    const inc = buildReportPreviewDocumentHtml(p, "incidents");
    expect(inc).toContain("NEGADĪJUMU VĒSTURE");
    expect(inc).not.toContain("NOBRAUKUMA VĒSTURE");
    expect(body(inc)).toContain("02.08.2023");
  });

  it("paslēptie avoti un sadaļas priekšskatā redzami (visi dati)", () => {
    const p = payload({
      pdfReportKind: "full",
      pdfVisibility: { ...DEALER_ONLY_PDF_VISIBILITY, mnt_ee: false, ltab: false, mileageComment: false },
    });
    const mileage = buildReportPreviewDocumentHtml(p, "mileage");
    expect(body(mileage)).toMatch(/120[\s\u00a0 ]?000/);
    expect(mileage).toContain("Admin nobraukuma komentārs");
    expect(body(buildReportPreviewDocumentHtml(p, "incidents"))).toContain("02.08.2023");
  });

  it("tiešām nav datu - «Nav datu»", () => {
    const csdd = emptyCsddFields();
    const p = payload({
      csddForm: csdd,
      autoRecordsBlock: createDefaultSourceBlocks().auto_records,
      manualVendorBlocks: [],
      manualLtabBlock: null,
      internalComment: "",
      mileageComment: "",
    });
    expect(buildReportPreviewDocumentHtml(p, "mileage")).toContain("Nav datu");
    expect(buildReportPreviewDocumentHtml(p, "incidents")).toContain("Nav datu");
  });

  it("«Viss» = pilnās atskaites dokuments ar PDF CSS", () => {
    const html = buildReportPreviewDocumentHtml(payload({ pdfReportKind: "full", pdfVisibility: null }), "all");
    expect(html).toContain(".pdf-sec{");
    expect(html).toContain("Admin nobraukuma komentārs");
  });
});
