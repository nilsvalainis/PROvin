import { describe, expect, it } from "vitest";
import { emptyCsddFields, mergeSourceBlocksWithDefaults } from "@/lib/admin-source-blocks";
import {
  csddFieldsFromStructuredAiPayload,
  mergeCsddTaAiIntoFields,
} from "@/lib/csdd-ai-structured-map";
import {
  formatParticleNumber,
  parseDetailedRatingBlockFromRaw,
  parseTechnicalInspectionHistory,
  resolveInspectionEmissions,
  type CsddTechnicalInspectionRow,
} from "@/lib/csdd-extended-parse";
import {
  buildPreviousInspectionBlockHtml,
  buildTechnicalInspectionHistoryTableHtml,
} from "@/lib/csdd-inspection-history-html";
import { buildCsddAvotuZoneHtml } from "@/lib/client-report-html";
import { applyClientReportStaticTranslations } from "@/lib/client-report-i18n";

const SMOKE_LABEL = "Dūmainības koeficients (m⁻¹):";
const PARTICLE_LABEL = "Atgāzu cietās daļiņas (cm⁻³):";

const PAID_PDF_TA_RAW = `Tehnisko apskašu vēsture
Apskates datums 19.05.2026
Apskates tips pamatpārbaude
Novērtējums 1 - Ar pieļaujamiem defektiem
Atgāzu cietās daļiņas (cm-3): 344900
 Kods Novērtējums Trūkumi vai bojājumi
5.3.4. 1 Priekšējais tilts. Palielināta brīvkustība.
Apskates datums 12.05.2025
Apskates tips pamatpārbaude
Novērtējums 1 - Ar pieļaujamiem defektiem
Dūmainības koeficients (m-1): 0.35
 Kods Novērtējums Trūkumi vai bojājumi
3.2. 1 Redzamību vai izturību būtiski neietekmējoši stiklojuma bojājumi.
Informācija sagatavota elektroniski 31.05.2026 11:56:58.`;

function taRow(over: Partial<CsddTechnicalInspectionRow>): CsddTechnicalInspectionRow {
  return {
    date: "19.05.2026",
    inspectionType: "pamatpārbaude",
    ratingLabel: "1",
    ratingLevel: 1,
    maxDefectLevel: null,
    smokeCoefficient: "",
    notes: "",
    defects: [],
    ...over,
  };
}

function emissionLineValue(html: string, label: string): string | null {
  const idx = html.indexOf(`${label}</span>`);
  if (idx < 0) return null;
  const rest = html.slice(idx + label.length + "</span>".length);
  return rest.slice(0, rest.indexOf("</p>")).trim();
}

describe("CSDD particle number vs smoke opacity - parse", () => {
  it("keeps particle count out of the smoke field in paid PDF year rows", () => {
    const rows = parseTechnicalInspectionHistory(PAID_PDF_TA_RAW);
    const newest = rows.find((r) => r.date === "19.05.2026");
    const older = rows.find((r) => r.date === "12.05.2025");
    expect(newest?.smokeCoefficient).toBe("");
    expect(newest?.particleNumber).toBe("344900");
    expect(older?.smokeCoefficient).toBe("0.35");
    expect(older?.particleNumber).toBeUndefined();
  });

  it("does not glue the next line digits into the particle count", () => {
    const raw = `Tehnisko apskašu vēsture
Apskates datums 19.05.2026
Apskates tips pamatpārbaude
Atgāzu cietās daļiņas (cm-3): 500
5.3.4. 1 Priekšējais tilts.
Informācija sagatavota elektroniski 31.05.2026 11:56:58.`;
    const row = parseTechnicalInspectionHistory(raw).find((r) => r.date === "19.05.2026");
    expect(row?.particleNumber).toBe("500");
    expect(row?.smokeCoefficient).toBe("");
  });

  it("Detalizētais vērtējums block stores particles separately from smoke", () => {
    const raw = `Tehniskie dati
Pārbaudes veids:\tPamatpārbaude
Odometra rādījums:\t220831
Novērtējums:\t1 - Ar pieļaujamiem defektiem
Atgāzu cietās daļiņas (cm-3):\t344900

Detalizētais vērtējums
Kods\tNovērtējums:\tTrūkumi vai bojājumi
3.2.\t1\tRedzamību vai izturību būtiski neietekmējoši stiklojuma bojājumi.
`;
    const block = parseDetailedRatingBlockFromRaw(raw);
    expect(block.smokeCoefficient).toBe("");
    expect(block.particleNumber).toBe("344900");
  });
});

describe("CSDD particle number vs smoke opacity - AI structured map", () => {
  it("maps atgazuCietasDalinas to particleNumber and keeps opacity empty", () => {
    const fields = csddFieldsFromStructuredAiPayload(
      {
        pamataDati: { markaModelis: "VW Amarok", registracijasNumurs: "AB123" },
        nobraukumaVesture: [],
        tehniskoApskasuVesture: [
          { datums: "19.05.2026", atgazuCietasDalinas: "344 900", truukumi: [] },
          { datums: "12.05.2025", dumannibasKoeficients: "0.35", truukumi: [] },
        ],
      },
      "",
    );
    const newest = fields.technicalInspectionHistory.find((r) => r.date === "19.05.2026");
    expect(newest?.particleNumber).toBe("344900");
    expect(newest?.smokeCoefficient).toBe("");
    expect(fields.opacityCoefficient).toBe("");
    expect(fields.particulateMatter).toBe("344900");
    const older = fields.technicalInspectionHistory.find((r) => r.date === "12.05.2025");
    expect(older?.smokeCoefficient).toBe("0.35");
  });

  it("moves a particle count the model put into dumannibasKoeficients", () => {
    const fields = csddFieldsFromStructuredAiPayload(
      {
        pamataDati: { markaModelis: "MB GLE", registracijasNumurs: "AB124" },
        nobraukumaVesture: [],
        tehniskoApskasuVesture: [{ datums: "19.05.2026", dumannibasKoeficients: "500", truukumi: [] }],
        ieprieksejasApskatesDati: { datums: "19.05.2026", parbaudesVeids: "Pamatpārbaude", dumannibasKoeficients: "500" },
      },
      "",
    );
    expect(fields.technicalInspectionHistory[0]?.smokeCoefficient).toBe("");
    expect(fields.technicalInspectionHistory[0]?.particleNumber).toBe("500");
    expect(fields.prevInspectionBlock.smokeCoefficient).toBe("");
    expect(fields.prevInspectionBlock.particleNumber).toBe("500");
    expect(fields.opacityCoefficient).toBe("");
  });

  it("keeps a real smoke opacity as opacityCoefficient", () => {
    const fields = csddFieldsFromStructuredAiPayload(
      {
        pamataDati: { markaModelis: "VW Golf", registracijasNumurs: "AB125" },
        nobraukumaVesture: [],
        tehniskoApskasuVesture: [{ datums: "19.05.2026", dumannibasKoeficients: "0.01", truukumi: [] }],
      },
      "",
    );
    expect(fields.opacityCoefficient).toBe("0.01");
    expect(fields.technicalInspectionHistory[0]?.particleNumber).toBeUndefined();
  });

  it("TA-only merge does not copy a particle count into opacity", () => {
    const merged = mergeCsddTaAiIntoFields(emptyCsddFields(), {
      tehniskoApskasuVesture: [
        { datums: "19.05.2026", dumannibasKoeficients: "344900", truukumi: [{ kods: "3.2.", vertesanas: 1, apraksts: "x" }] },
      ],
    });
    expect(merged.opacityCoefficient).toBe("");
    expect(merged.particulateMatter).toBe("344900");
    expect(merged.technicalInspectionHistory[0]?.particleNumber).toBe("344900");
  });

  it("TA-only merge drops a legacy particle count already stored as opacity", () => {
    const merged = mergeCsddTaAiIntoFields(
      { ...emptyCsddFields(), opacityCoefficient: "500" },
      {
        tehniskoApskasuVesture: [
          { datums: "19.05.2026", dumannibasKoeficients: "0.35", truukumi: [{ kods: "3.2.", vertesanas: 1, apraksts: "x" }] },
        ],
      },
    );
    expect(merged.opacityCoefficient).toBe("0.35");
  });
});

describe("CSDD particle number vs smoke opacity - render", () => {
  it("prints particle number with its own label and grouped thousands", () => {
    const html = buildTechnicalInspectionHistoryTableHtml([taRow({ particleNumber: "344900" })]);
    expect(emissionLineValue(html, PARTICLE_LABEL)).toBe("344 900");
    expect(html).not.toContain(SMOKE_LABEL);
  });

  it.each([
    ["500", "500"],
    ["344900", "344 900"],
  ])("legacy draft with %s in the smoke field renders as particle number", (stored, shown) => {
    const row = taRow({ smokeCoefficient: stored });
    const html = buildTechnicalInspectionHistoryTableHtml([row]);
    expect(html).not.toContain(SMOKE_LABEL);
    expect(emissionLineValue(html, PARTICLE_LABEL)).toBe(shown);
    expect(row.smokeCoefficient).toBe(stored);
    expect(row.particleNumber).toBeUndefined();
  });

  it.each(["0.01", "0.35"])("real smoke opacity %s still renders as smoke", (stored) => {
    const html = buildTechnicalInspectionHistoryTableHtml([taRow({ smokeCoefficient: stored })]);
    expect(emissionLineValue(html, SMOKE_LABEL)).toBe(stored);
    expect(html).not.toContain(PARTICLE_LABEL);
  });

  it("previous inspection block renders particles under the particle label", () => {
    const html = buildPreviousInspectionBlockHtml(
      {
        inspectionType: "Pamatpārbaude",
        inspectionDateText: "19.05.2026",
        nextInspectionDateText: "",
        odometer: "220831",
        ratingLabel: "1",
        ratingLevel: 1,
        smokeCoefficient: "500",
        notes: "",
        defects: [{ code: "3.2.", rating: "1", description: "Stikls" }],
      },
      "19.05.2026",
    );
    expect(html).not.toContain(SMOKE_LABEL);
    expect(emissionLineValue(html, PARTICLE_LABEL)).toBe("500");
  });

  it("client report CSDD zone shows a legacy opacity particle count as particles", () => {
    const html = buildCsddAvotuZoneHtml({
      ...emptyCsddFields(),
      makeModel: "MB GLE",
      opacityCoefficient: "344900",
    });
    expect(html).not.toContain(SMOKE_LABEL);
    expect(html).toContain("Atgāzu cietās daļiņas:");
    expect(html).toContain("344900");
  });

  it("client report CSDD zone keeps a real smoke opacity", () => {
    const html = buildCsddAvotuZoneHtml({
      ...emptyCsddFields(),
      makeModel: "VW Golf",
      opacityCoefficient: "0.35",
    });
    expect(html).toContain(SMOKE_LABEL);
    expect(html).toContain("0.35");
  });

  it("translates the particle label for EN/RU/DE reports", () => {
    const html = buildTechnicalInspectionHistoryTableHtml([taRow({ particleNumber: "344900" })]);
    expect(applyClientReportStaticTranslations(html, "en")).toContain("Exhaust particle count (cm⁻³):");
    expect(applyClientReportStaticTranslations(html, "de")).toContain("Partikel im Abgas (cm⁻³):");
    expect(applyClientReportStaticTranslations(html, "ru")).toContain("(см⁻³):");
  });
});

describe("CSDD particle number helpers and storage", () => {
  it("resolveInspectionEmissions splits legacy values without touching real smoke", () => {
    expect(resolveInspectionEmissions({ smokeCoefficient: "500" })).toEqual({
      smokeCoefficient: "",
      particleNumber: "500",
    });
    expect(resolveInspectionEmissions({ smokeCoefficient: "344900" })).toEqual({
      smokeCoefficient: "",
      particleNumber: "344900",
    });
    expect(resolveInspectionEmissions({ smokeCoefficient: "0.01" })).toEqual({
      smokeCoefficient: "0.01",
      particleNumber: "",
    });
    expect(resolveInspectionEmissions({ smokeCoefficient: "0,35" })).toEqual({
      smokeCoefficient: "0,35",
      particleNumber: "",
    });
  });

  it("formatParticleNumber groups thousands with a space", () => {
    expect(formatParticleNumber("344900")).toBe("344 900");
    expect(formatParticleNumber("1 234 567")).toBe("1 234 567");
    expect(formatParticleNumber("500")).toBe("500");
    expect(formatParticleNumber("n/a")).toBe("n/a");
  });

  it("stored workspace keeps particleNumber and legacy rows without it", () => {
    const blocks = mergeSourceBlocksWithDefaults({
      csdd: {
        makeModel: "VW Amarok",
        technicalInspectionHistory: [
          taRow({ date: "19.05.2026", particleNumber: "344900" }),
          taRow({ date: "12.05.2025", smokeCoefficient: "500" }),
        ],
      },
    });
    const rows = blocks.csdd.technicalInspectionHistory;
    expect(rows.find((r) => r.date === "19.05.2026")?.particleNumber).toBe("344900");
    const legacy = rows.find((r) => r.date === "12.05.2025");
    expect(legacy?.smokeCoefficient).toBe("500");
    expect(legacy?.particleNumber).toBeUndefined();
  });
});
