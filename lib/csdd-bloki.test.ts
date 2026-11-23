import { describe, expect, it } from "vitest";
import { emptyCsddFields, type CsddFormFields } from "@/lib/admin-source-blocks";
import {
  buildCsddBloki,
  buildCsddTaAnalysis,
  buildCsddTaRepeatSentence,
  buildCsddWarnings,
  csddDefectGroupKey,
  csddDefectNodeLabel,
  csddTaCodesLabel,
  csddTaInspectionsCount,
  parseCsddMeasurements,
  type CsddTaAnalysis,
} from "@/lib/csdd-bloki";
import type { CsddTechnicalInspectionRow } from "@/lib/csdd-extended-parse";
import fs from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AdminCsddBlokiPanel } from "@/components/admin/AdminCsddBlokiPanel";
import {
  ECSDD_NEW_FORMAT_DEREGISTERED,
  ECSDD_OLD_FORMAT_MEASUREMENTS,
  ECSDD_TADATI_TOYOTA_LAST_ONLY,
} from "@/lib/csdd-bloki.fixtures";
import { buildCsddRegistrySignalFactLines, parseCsddRegistrySignals } from "@/lib/csdd-registry-signals";
import { formatTadatiPanels } from "@/relay/provin-ecsdd/lib/ecsdd-page.mjs";
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
    expect(ta.repeated.map((r) => [r.key, r.yearCount])).toEqual([
      ["5.3:front", 5],
      ["8.4:oil", 4],
      ["1.4", 2],
    ]);
    expect(ta.repeated.map((r) => csddDefectNodeLabel(r.key, "lv"))).toEqual([
      "Priekšējā balstiekārta un tilts",
      "Eļļas noplūde (motors, transmisija)",
      "Stāvbremze",
    ]);
    expect(ta.repeated.map((r) => csddTaCodesLabel(r.codes, "lv"))).toEqual([
      "CSDD kodi 5.3.1, 5.3.4",
      "CSDD kods 8.4.1",
      "CSDD kodi 1.4.1, 1.4.2",
    ]);
    const susp = ta.repeated[0]!;
    expect(susp.codes).toEqual(["5.3.1", "5.3.4"]);
    expect(susp.byYear[2026]).toBe(2);
    expect(susp.byYear[2021]).toBe(0);
    expect(susp.latestDate).toBe("17.07.2026");
    // Vienāds piezīmes teksts - viena rinda, datumi hronoloģiski.
    expect(ta.notes).toHaveLength(1);
    expect(ta.notes[0]!.dates).toEqual(["04.03.2020", "08.04.2021", "12.04.2022"]);
    expect(buildCsddTaRepeatSentence(ta, "lv")).toBe(
      "Trīs defekti konstatēti vairāku gadu tehniskajās apskatēs: priekšējā balstiekārta un tilts - 5 gados, eļļas noplūde - 4 gados, stāvbremze - 2 gados.",
    );
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

function taRow(date: string, defects: [string, string, string][], notes = ""): CsddTechnicalInspectionRow {
  return {
    date,
    inspectionType: "pamatpārbaude",
    ratingLabel: "",
    notes,
    smokeCoefficient: "",
    defects: defects.map(([code, rating, description]) => ({ code, rating, description })),
  } as unknown as CsddTechnicalInspectionRow;
}

function taOf(rows: CsddTechnicalInspectionRow[]): CsddTaAnalysis {
  return buildCsddTaAnalysis({ technicalInspectionHistory: rows, prevInspectionBlock: null } as never);
}

describe("e.csdd bloki - TA defektu nosaukumi un teikums", () => {
  it("8.4.1 eļļa un dzesēšanas šķidrums - atsevišķas rindas", () => {
    expect(csddDefectGroupKey("8.4.1.", "Neveidojot piles, sūcas eļļa no motora (transmisijas).")).toBe("8.4:oil");
    expect(csddDefectGroupKey("8.4.1.", "Sūcas dzesēšanas šķidrums.")).toBe("8.4:coolant");
    expect(csddDefectGroupKey("5.3.4.", "Priekšējais tilts. Palielināta brīvkustība.")).toBe("5.3:front");
    expect(csddDefectGroupKey("1.4.2.", "Nav sasniegta efektivitāte.")).toBe("1.4");
    const ta = taOf([
      taRow("10.07.2025", [["8.4.1.", "1", "Sūcas eļļa no motora."], ["8.4.1.", "1", "Sūcas dzesēšanas šķidrums."]]),
      taRow("10.07.2024", [["8.4.1.", "1", "Sūcas eļļa no motora."], ["8.4.1.", "2", "Sūcas dzesēšanas šķidrums no radiatora."]]),
      taRow("10.07.2023", []),
    ]);
    expect(ta.repeated.map((r) => [r.key, r.yearCount, r.byYear[2024], r.byYear[2023]])).toEqual([
      ["8.4:coolant", 2, 2, 0],
      ["8.4:oil", 2, 1, 0],
    ]);
    expect(csddDefectNodeLabel("8.4:coolant", "lv")).toBe("Dzesēšanas šķidruma noplūde");
    expect(ta.repeated[0]!.latestText).toBe("Sūcas dzesēšanas šķidrums.");
    expect(buildCsddTaRepeatSentence(ta, "lv")).toBe(
      "Divi defekti konstatēti vairāku gadu tehniskajās apskatēs: dzesēšanas šķidruma noplūde - 2 gados, eļļas noplūde - 2 gados.",
    );
  });

  it("piezīmes: vienāds teksts apvienots, datumi hronoloģiski", () => {
    const ta = taOf([
      taRow("12.04.2022", [], "Stāvbremze  pietiekoša."),
      taRow("08.04.2021", [], "Cita piezīme."),
      taRow("04.03.2020", [], "Stāvbremze pietiekoša."),
    ]);
    expect(ta.notes).toEqual([
      { text: "Stāvbremze pietiekoša.", dates: ["04.03.2020", "12.04.2022"] },
      { text: "Cita piezīme.", dates: ["08.04.2021"] },
    ]);
  });

  it("teikuma locījumi: viens/divi defekti, 0 - teikuma nav; 4 valodas", () => {
    const one = taOf([taRow("01.01.2025", [["1.4.1.", "2", "Stāvbremze."]]), taRow("01.01.2024", [["1.4.1.", "2", "Stāvbremze."]])]);
    expect(buildCsddTaRepeatSentence(one, "lv")).toBe("Viens defekts konstatēts vairāku gadu tehniskajās apskatēs: stāvbremze - 2 gados.");
    expect(buildCsddTaRepeatSentence(one, "en")).toBe("One defect was recorded at technical inspections in several years: parking brake - 2 years.");
    expect(buildCsddTaRepeatSentence(one, "ru")).toBe("Один дефект выявлен на техосмотрах нескольких лет: стояночный тормоз - 2 года.");
    expect(buildCsddTaRepeatSentence(one, "de")).toBe("Ein Mangel wurde bei Hauptuntersuchungen in mehreren Jahren festgestellt: Feststellbremse - 2 Jahre.");
    expect(buildCsddTaRepeatSentence(taOf([taRow("01.01.2025", [["1.4.1.", "2", "x"]])]), "lv")).toBe("");
    const ml = buildCsddBloki(ML, "lv", NOW)!.ta;
    expect(buildCsddTaRepeatSentence(ml, "ru")).toMatch(/^Три дефекта выявлены .*передняя подвеска и мост - 5 лет/);
    expect(buildCsddTaRepeatSentence(ml, "en")).toMatch(/^Three defects were recorded .*front suspension and axle - 5 years, oil leak - 4 years/);
    expect(buildCsddTaRepeatSentence(ml, "de")).toMatch(/^Drei Mängel wurden .*Vorderachse und Radaufhängung - 5 Jahre/);
    expect([0, 1, 2, 11, 21].map((n) => csddTaInspectionsCount(n, "lv"))).toEqual([
      "0 apskates",
      "1 apskate",
      "2 apskates",
      "11 apskates",
      "21 apskate",
    ]);
    expect([1, 3, 5, 22].map((n) => csddTaInspectionsCount(n, "ru"))).toEqual(["1 техосмотр", "3 техосмотра", "5 техосмотров", "22 техосмотра"]);
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
    expect(html).not.toContain("Tehnisko apskašu defektu analīze");
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
    // Maketa tabula: kolonnas, kartītes, teikums, leģenda, piezīmes.
    const ta = html.slice(html.indexOf('data-csdd-bloks="ta"'));
    expect(ta).toContain("Tehnisko apskašu defektu analīze");
    expect(ta).toContain(">Vērtējums 2<");
    expect(ta).toContain(">6 apskates<");
    expect(ta).toContain(">0 apskates<");
    expect(ta).toContain("Gadi ar defektu");
    expect(ta).toContain("5 <span>no 8</span>");
    expect(ta).toContain("Priekšējā balstiekārta un tilts");
    expect(ta).toContain("CSDD kods 8.4.1");
    expect(ta).toContain("Pēdējo reizi 17.07.2026:");
    expect(ta).toContain("Trīs defekti konstatēti vairāku gadu tehniskajās apskatēs");
    expect(ta).toContain("bīstami defekti, braukt aizliegts");
    expect(ta).toContain("Tehniskās apskates piezīmes");
    expect(ta).toContain("04.03.2020, 08.04.2021, 12.04.2022</span> - Stāvbremzes");
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
    expect(html).toContain("Technical inspection defect analysis");
  });
});

describe("e.csdd bloki - tukša sadaļa neņem nākamās sadaļas tekstu (Toyota Auris 23.11.2026)", () => {
  const AURIS = form(ECSDD_TADATI_TOYOTA_LAST_ONLY);

  it("apdrošinātāju CSNg tukšs -> «nav pārbaudīts», nevis «Nobraukuma vēsture LV»; brīdinājuma «Ir CSNg» nav", () => {
    const b = buildCsddBloki(AURIS, "lv", NOW)!;
    const rows = Object.fromEntries(b.restrictions.rows.map((r) => [r.key, r]));
    expect(rows.csngInsurers).toEqual({ key: "csngInsurers", state: "not_checked", text: "" });
    expect(rows.csngPolice!.state).toBe("none");
    expect(rows.restrictions!.state).toBe("not_checked");
    expect(b.warnings.map((w) => w.id)).not.toContain("csng");
    // Reģistrācijas brīdinājums (atļauja beigusies) paliek.
    expect(b.warnings).toEqual([
      {
        id: "registration",
        tone: "alert",
        label: "Reģistrācija",
        value: "Atļauja beigusies 11.11.2026",
        note: "Noņemts no uzskaites, atļauts piedalīties ceļu satiksmē līdz 11.11.2026",
      },
    ]);
    const json = JSON.stringify(b);
    expect(json).not.toContain("Nobraukuma");
    expect(json).not.toContain("136423 136423");
    expect(json).not.toContain("**");
    // AI fakti lieto to pašu parseri.
    expect(buildCsddRegistrySignalFactLines(AURIS, NOW).join("\n")).not.toContain("Nobraukuma");
  });

  it("tikai pēdējā apskate ar «Novērtējums: **» -> «Latvijā TA vēl nav veikta», PDF TA bloka nav", () => {
    const b = buildCsddBloki(AURIS, "lv", NOW)!;
    expect(b.ta.inspectionCount).toBe(0);
    expect(b.taHistoryState).toBe("no_lv_rating");
    const parts = buildCsddBlokiPdfParts(AURIS, { csddPdfWarnings: true, csddPdfRestrictions: true, csddPdfMeasurements: true, csddPdfTaAnalysis: true }, "lv", NOW);
    expect(parts.beforeInspections).toBe("");
    expect(parts.afterTable).not.toContain("Nobraukuma");
    expect(parts.afterTable).toContain("92 g/km");
    expect(buildCsddWarningSummaryTiles(AURIS, "lv", NOW).map((t) => [t.id, t.value])).toEqual([
      ["csdd-registration", "Atļauja beigusies 11.11.2026"],
    ]);
  });

  it("pēdējā apskate ar vērtējumu, bez vēstures -> «TA vēsture nav ielādēta»", () => {
    const raw = ECSDD_TADATI_TOYOTA_LAST_ONLY.replace("Novērtējums:\t**", "Novērtējums:\t1 - Ar pieļaujamiem defektiem");
    const b = buildCsddBloki(form(raw), "lv", NOW)!;
    expect(b.taHistoryState).toBe("last_only");
    expect(buildCsddBloki(ML, "lv", NOW)!.taHistoryState).toBe("");
  });

  it("releja tadati fiksācija: pilns CSNg - abi «Nav»; bez vērtības vai sakļauts akordeons - «nav pārbaudīts»", () => {
    const snaps = JSON.parse(fs.readFileSync(path.join(__dirname, "__fixtures__", "relay-pages", "snapshots.json"), "utf8"));
    const { panels, footer } = snaps["ecsdd-tadati-result"].tadati as { panels: { title: string; rows: string[][] }[]; footer: string };
    const sig = (ps: typeof panels) => {
      const raw = formatTadatiPanels(ps, footer);
      return parseCsddRegistrySignals({ ...form(raw), rawUnprocessedData: raw }, NOW);
    };
    const full = sig(panels);
    expect([full.csngPolice.state, full.csngInsurers.state]).toEqual(["none", "none"]);

    const withCsng = (rows: string[][]) => panels.map((p) => (/CSNg/.test(p.title) ? { ...p, rows } : p));
    const emptyInsurer = sig(withCsng([["Informācija no policijas:"], ["Nav"], ["Informācija no apdrošinātājiem:"]]));
    expect(emptyInsurer.csngPolice.state).toBe("none");
    expect(emptyInsurer.csngInsurers).toEqual({ state: "not_checked", text: "" });

    const emptyPolice = sig(withCsng([["Informācija no policijas:"], ["Informācija no apdrošinātājiem:"], ["Nav"]]));
    expect(emptyPolice.csngPolice).toEqual({ state: "not_checked", text: "" });
    expect(emptyPolice.csngInsurers.state).toBe("none");

    const collapsed = sig(withCsng([]));
    expect([collapsed.csngPolice.state, collapsed.csngInsurers.state, collapsed.restrictions.state]).toEqual([
      "not_checked",
      "not_checked",
      "not_checked",
    ]);
  });

  it("īsta atzīme paliek atzīme; vērtība beidzas pie nākamās sadaļas virsraksta (arī aizliegumi)", () => {
    const raw =
      "Aizliegumi\nAizliegums atsavināt (tiesu izpildītājs) 01.02.2026\nNobraukuma vēsture LV\n03.11.2026\t1\t1\n" +
      "Būtiski bojājumi CSNg\nInformācija no policijas:\nNav\nInformācija no apdrošinātājiem:\nCSNg 12.03.2021\n\nBremžu vērtējums\nAss\tKreisais\tLabais\tBremžu tips\n1\t2.0\t2.0\tD\n";
    const s = parseCsddRegistrySignals({ ...emptyCsddFields(), rawUnprocessedData: raw }, NOW);
    expect(s.restrictions).toEqual({ state: "present", text: "Aizliegums atsavināt (tiesu izpildītājs) 01.02.2026" });
    expect(s.csngInsurers).toEqual({ state: "present", text: "CSNg 12.03.2021" });
    expect(s.csngPolice.state).toBe("none");
  });

  it("admin panelis: bez sarkanām fona joslām un bez pasvītrotiem virsrakstiem", () => {
    const html = renderToStaticMarkup(createElement(AdminCsddBlokiPanel, { value: AURIS }));
    expect(html).not.toContain("Ir CSNg atzīmes");
    expect(html).not.toContain("Nobraukuma");
    expect(html).toContain("Latvijā TA vēl nav veikta");
    expect(html).toContain("Atļauja beigusies 11.11.2026");
    // admin-ios-theme.css `.text-red-700` / `.text-red-600` = sarkans fons ar baltu tekstu.
    expect(html).not.toMatch(/text-red-(?:600|700)\b/);
    // admin-pro-order-theme.css: uppercase + tracking-wide + text-[10px]/[11px] virsrakstam liek pasvītrojumu.
    for (const m of html.matchAll(/<p class="([^"]*)"/g)) {
      const c = m[1]!.split(/\s+/);
      const underlined = c.includes("uppercase") && c.includes("tracking-wide") && (c.includes("text-[10px]") || c.includes("text-[11px]"));
      expect(underlined, m[1]).toBe(false);
    }
    const ml = renderToStaticMarkup(createElement(AdminCsddBlokiPanel, { value: ML }));
    expect(ml).not.toMatch(/text-red-(?:600|700)\b/);
    expect(ml).toContain("Nav spēkā esošas OCTA");
  });
});
