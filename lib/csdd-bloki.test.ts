import { describe, expect, it } from "vitest";
import { emptyCsddFields, type CsddFormFields } from "@/lib/admin-source-blocks";
import { buildCsddBloki, buildCsddWarnings, parseCsddMeasurements } from "@/lib/csdd-bloki";
import { ECSDD_NEW_FORMAT_DEREGISTERED, ECSDD_OLD_FORMAT_MEASUREMENTS } from "@/lib/csdd-bloki.fixtures";
import { buildCsddBlokiPdfParts, buildCsddWarningSummaryTiles } from "@/lib/csdd-bloki-pdf-html";
import { applyCsddPasteToForm, parseCsddPaste } from "@/lib/csdd-paste-parse";
import { buildClientReportDocumentHtml, type ClientReportPayload } from "@/lib/client-report-html";
import type { ClientReportLang } from "@/lib/client-report-i18n";
import {
  CSDD_PDF_BLOKI_OFF,
  DEFAULT_PDF_VISIBILITY,
  MINI_DEFAULT_PDF_VISIBILITY,
  mergePdfVisibility,
} from "@/lib/pdf-visibility";

const NOW = Date.UTC(2026, 10, 23);

function form(raw: string): CsddFormFields {
  return applyCsddPasteToForm({ ...emptyCsddFields(), rawUnprocessedData: raw }, raw, parseCsddPaste(raw));
}

const ML = form(ECSDD_NEW_FORMAT_DEREGISTERED);
const TOYOTA = form(ECSDD_OLD_FORMAT_MEASUREMENTS);

describe("e.csdd bloki - parsēšana", () => {
  it("jaunais formāts: brīdinājumi sarkani pirmie, pilnvara dzeltena, avota datums", () => {
    const b = buildCsddBloki(ML, "lv", NOW)!;
    expect(b.infoDate).toBe("19.11.2026");
    expect(b.warnings.map((w) => [w.id, w.tone])).toEqual([
      ["registration", "alert"],
      ["octa", "alert"],
      ["roadTax", "alert"],
      ["powerOfAttorney", "warn"],
    ]);
    const reg = b.warnings[0]!;
    expect(reg.value).toBe("Noņemts no uzskaites");
    expect(reg.note).toBe("Atļaujas termiņš e.csdd nav norādīts");
    expect(b.warnings[1]!.value).toBe("Nav spēkā esošas OCTA");
    expect(b.warnings[2]!.value).toBe("Par 2026 nav samaksāts");
    expect(b.warnings[2]!.note).toBe("Gada likme 213,00 €");
    expect(b.warnings[3]!.note).toBe("Atsavināt TL citai personai, 29.01.2020");
  });

  it("aizliegumi un CSNg: «Nav» jaunajā formātā, «nav pārbaudīts» vecajā", () => {
    expect(buildCsddBloki(ML, "lv", NOW)!.restrictions.rows.map((r) => r.state)).toEqual(["none", "none", "none"]);
    const old = buildCsddBloki(TOYOTA, "lv", NOW)!.restrictions;
    expect(old.allMissing).toBe(true);
    expect(old.rows.every((r) => r.state === "not_checked")).toBe(true);
  });

  it("TA defektu analīze: skaitļi un atkārtotie mezgli pa gadiem", () => {
    const ta = buildCsddBloki(ML, "lv", NOW)!.ta;
    expect(ta.inspectionCount).toBe(14);
    expect(ta.rating2Count).toBe(6);
    expect(ta.rating3Count).toBe(0);
    expect(ta.reinspectionCount).toBe(4);
    expect(ta.years[0]).toBe(2019);
    expect(ta.years[ta.years.length - 1]).toBe(2026);
    expect(ta.repeated.map((r) => [r.node, r.yearCount])).toEqual([
      ["5.3", 5],
      ["8.4", 4],
      ["1.4", 2],
    ]);
    const susp = ta.repeated[0]!;
    expect(susp.codes).toEqual(["5.3.1", "5.3.4"]);
    expect(susp.byYear[2026]).toBe(2);
    expect(susp.byYear[2021]).toBe(0);
    expect(susp.latestDate).toBe("17.07.2026");
    expect(ta.notes[0]!.dates).toEqual(["12.04.2022", "08.04.2021", "04.03.2020"]);
  });

  it("vecais formāts: mērījumi un bremzes no e.csdd teksta", () => {
    const m = parseCsddMeasurements(TOYOTA);
    expect(m).toMatchObject({
      taDate: "27.08.2025",
      co2: "135",
      co2Cycle: "WLTP",
      consumption: "5.9",
      consumptionCycle: "WLTP",
      consumptionCity: "7.0",
      euro: "Euro 6 AP",
      co: "0.02",
      coHigh: "0.03",
      hc: "5",
      lambda: "1",
    });
    expect(m.brakes.map((r) => [r.axle, r.diffPct, r.type])).toEqual([
      ["1", 2, "D"],
      ["2", 0, "D"],
      ["2", 24, "S"],
    ]);
    const ta = buildCsddBloki(TOYOTA, "lv", NOW)!.ta;
    expect(ta.notes.map((n) => n.text)).toEqual(["Nevar pieslēgties OBD, jo nesavienojas ar sistēmu."]);
    expect(buildCsddWarnings(TOYOTA, "lv", NOW)).toEqual([]);
  });

  it("īsa OCTA, tirdzniecības reģistrs - dzelteni; bez RAW nekā nav", () => {
    const raw = ECSDD_NEW_FORMAT_DEREGISTERED.replace("Statuss Noņemts no uzskaites", "Statuss Uzskaitē")
      .replace("Maksājums par tekošo gadu nav veikts", "Par tekošo gadu samaksāti 213 Euro")
      .replace(/PilnvaraAtsavin[^\n]*\n/, "Tirdzniecības reģistra statuss: Ir ievietots\n")
      .replace("Civiltiesiskā apdrošināšana\nNav", "Civiltiesiskā apdrošināšana\nPolise XX000002\nSpēkā stāšanās datums 06.11.2026\nBeigu datums 06.12.2026");
    const ws = buildCsddWarnings(form(raw), "lv", NOW);
    expect(ws.map((w) => [w.id, w.tone, w.value])).toEqual([
      ["octa", "warn", "Polise 31 dienas"],
      ["tradeRegister", "warn", "Ievietots tirdzniecības reģistrā"],
    ]);
    expect(buildCsddBloki(emptyCsddFields(), "lv", NOW)).toBeNull();
  });

  it("teksti 4 valodās, bez garajām domuzīmēm un ieteikumiem", () => {
    for (const lang of ["lv", "en", "ru", "de"] as ClientReportLang[]) {
      const tiles = buildCsddWarningSummaryTiles(ML, lang, NOW);
      expect(tiles).toHaveLength(4);
      expect(tiles[0]!.noteSegments).toContain("e.csdd, 19.11.2026");
      const all = buildCsddBlokiPdfParts(
        ML,
        { csddPdfWarnings: true, csddPdfRestrictions: true, csddPdfMeasurements: true, csddPdfTaAnalysis: true },
        lang,
        NOW,
      );
      const txt = JSON.stringify(tiles) + all.afterTable + all.beforeInspections;
      expect(txt).not.toMatch(/[—–]/);
      expect(txt).not.toMatch(/iesak|ieteik|eksperts|recommend/i);
    }
    expect(buildCsddWarningSummaryTiles(ML, "en", NOW)[1]!.value).toBe("No valid policy");
    expect(buildCsddWarningSummaryTiles(ML, "de", NOW)[0]!.label).toBe("Zulassung");
  });
});

describe("e.csdd bloki - PDF karogi", () => {
  it("noklusējums izslēgts visos režīmos; saglabātais true paliek", () => {
    for (const v of [DEFAULT_PDF_VISIBILITY, MINI_DEFAULT_PDF_VISIBILITY, mergePdfVisibility(undefined), mergePdfVisibility({})]) {
      expect({
        csddPdfWarnings: v.csddPdfWarnings,
        csddPdfRestrictions: v.csddPdfRestrictions,
        csddPdfMeasurements: v.csddPdfMeasurements,
        csddPdfTaAnalysis: v.csddPdfTaAnalysis,
      }).toEqual(CSDD_PDF_BLOKI_OFF);
    }
    const on = mergePdfVisibility({ csddPdfWarnings: true, csddPdfTaAnalysis: true, csddPdfRestrictions: "jā" });
    expect(on.csddPdfWarnings).toBe(true);
    expect(on.csddPdfTaAnalysis).toBe(true);
    expect(on.csddPdfRestrictions).toBe(false);
  });
});

function payload(csdd: CsddFormFields, vis: Record<string, boolean> = {}): ClientReportPayload {
  return {
    sessionId: "cs_test",
    vin: "WDC00000000000002",
    created: NOW,
    amountTotal: 9999,
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
    csddForm: csdd,
    pdfVisibility: mergePdfVisibility(vis),
  } as unknown as ClientReportPayload;
}

function doc(p: ClientReportPayload, lang: ClientReportLang = "lv"): string {
  return buildClientReportDocumentHtml({
    payload: p,
    portfolio: [],
    pdfInsights: [],
    dateFmt: new Intl.DateTimeFormat("lv-LV"),
    formatBytes: () => "0 B",
    lang,
  });
}

describe("e.csdd bloki - klienta PDF", () => {
  it("bez ķekša PDF jauno bloku nav (esošais PDF nemainās)", () => {
    const html = doc(payload(ML));
    expect(html).not.toContain("data-csdd-bloks=");
    expect(html).not.toContain("Nav spēkā esošas OCTA");
    expect(html).not.toContain("TA defektu analīze");
  });

  it("ar ķekšiem: kartītes kopsavilkumā pirmās, bloki CSDD sadaļā", () => {
    const html = doc(
      payload(ML, { csddPdfWarnings: true, csddPdfRestrictions: true, csddPdfMeasurements: true, csddPdfTaAnalysis: true }),
    );
    const summary = html.slice(html.indexOf("pdf-report-summary"));
    const firstTile = summary.slice(summary.indexOf("pdf-summary-tile__label"), summary.indexOf("pdf-summary-tile__label") + 80);
    expect(firstTile).toContain("Reģistrācija");
    expect(html).toContain("pdf-summary-tile--alert");
    expect(html).toContain('data-csdd-bloks="restrictions"');
    // Jaunajā formātā mērījumu (izņemot dūmainību, kas jau tabulā) nav - bloks neparādās.
    expect(html).not.toContain('data-csdd-bloks="measurements"');
    expect(html).toContain('data-csdd-bloks="ta"');
    expect(html).toContain("e.csdd, 19.11.2026");
    // Analīze pirms esošās TA vēstures tabulas.
    expect(html.indexOf('data-csdd-bloks="ta"')).toBeLessThan(html.indexOf("Tehnisko apskašu vēsture"));
  });

  it("tikai brīdinājumi - CSDD sadaļā jaunu bloku nav", () => {
    const html = doc(payload(ML, { csddPdfWarnings: true }));
    expect(html).toContain("Nav spēkā esošas OCTA");
    expect(html).not.toContain("data-csdd-bloks=");
  });

  it("vecais formāts: mērījumu bloks ar bremzēm", () => {
    const html = doc(payload(TOYOTA, { csddPdfMeasurements: true }));
    expect(html).toContain('data-csdd-bloks="measurements"');
    expect(html).toContain("135 g/km");
    expect(html).toContain("Bremžu mērījumi");
  });

  it("EN PDF: bloku teksti angliski", () => {
    const html = doc(payload(ML, { csddPdfWarnings: true, csddPdfTaAnalysis: true }), "en");
    expect(html).toContain("No valid policy");
    expect(html).toContain("Inspection defect analysis");
  });
});
