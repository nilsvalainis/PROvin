import { describe, expect, it } from "vitest";
import { lintTechnicalRiskText } from "@/lib/admin-ai-technical-risk-lint";
import type { TechnicalRiskIdentification, TechnicalRiskMap } from "@/lib/admin-ai-technical-risk-map-types";

const id: TechnicalRiskIdentification = {
  engine: { value: "N47D20", confidence: "A", evidence: "Outvin", candidates: ["N47D20"] },
  gearbox: { value: "GA8HP45Z", confidence: "B", evidence: "modelis", candidates: [] },
  platform: { value: "E84", confidence: "B", evidence: "gads", candidates: ["E84"] },
};

function sampleMap(over: Partial<TechnicalRiskMap> = {}): TechnicalRiskMap {
  return {
    identification: id,
    risks: [
      {
        component: "sadales ķēde",
        failure_mode: "izstiepšanās",
        typical_km_range: [150000, 250000],
        this_car_position: "iekšā",
        already_done_evidence: null,
        probability: "medium",
        impact: "high",
        priority: 1,
        applies_to_this_car: true,
        confidence: "high",
        sources: [{ type: "specialist", ref: "KB:N47D20", accessed: "2026-10-17" }],
        cost_band_eur: null,
        inspection_hint: "aukstā palaišana",
      },
    ],
    damage_interpretation: [],
    recalls: [{ id_or_title: "nav atrasts", source: "meklēšana", status_known: false }],
    strengths: [],
    unknowns: [],
    ...over,
  };
}

const okText = `Sadales ķēde
N47D20 tipiski šajā posmā prasa klausīties auksto startu. Dīlera datos maiņa nav fiksēta.

Kārba
Automātiskā kārba paliek ierasta uzturēšanas izmaksa. Klātienē jāpārbauda pārslēgšanās.

EGR un ieplūde
Šim agregātam oglekļa nogulsnes ir tipiskas. Tas nav pirkuma šķērslis, ja diagnostika ir tīra.

Stiprās puses
Konstrukcija ir pazīstama servisiem. Uzturēšana joprojām ir jāpierāda ar dokumentiem.`;

describe("lintTechnicalRiskText", () => {
  it("accepts a clean comment", () => {
    const r = lintTechnicalRiskText({ text: okText, identification: id, map: sampleMap() });
    expect(r.ok).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it("L1 flags only praising intros, not factual equipment plus risk", () => {
    const praiseIntro = lintTechnicalRiskText({
      text: "Šī automašīna ir aprīkota ar uzticamo N47 dīzeli.\n\n" + okText,
      identification: id,
    });
    expect(praiseIntro.errors.some((e) => e.id === "L1")).toBe(true);
    const emptyIntro = lintTechnicalRiskText({
      text: "Šī automašīna ir aprīkota ar N47 dīzeli.\n\n" + okText,
      identification: id,
    });
    expect(emptyIntro.errors.some((e) => e.id === "L1")).toBe(true);
    const praise = lintTechnicalRiskText({
      text: `${okText}\n\nŠis ir viens no uzticamākajiem motoriem.`,
      identification: id,
    });
    expect(praise.errors.some((e) => e.id === "L1")).toBe(true);
    const factual = lintTechnicalRiskText({
      text: "Šī automašīna ir aprīkota ar N47, un ķēde šajā posmā ir galvenais risks.\n\n" + okText,
      identification: id,
    });
    expect(factual.errors.some((e) => e.id === "L1")).toBe(false);
  });

  it("L13 warns on obligatory tone and never treats N57 conrod bearing as a lint error", () => {
    const tone = lintTechnicalRiskText({
      text: `${okText}\n\nĶēde obligāti jāmaina. Pirkums netiek rekomendēts.`,
      identification: id,
    });
    expect(tone.warnings.some((w) => w.id === "L13")).toBe(true);
    const n57 = lintTechnicalRiskText({
      text: `Klaņa gultņi
N57 šajā posmā tipiska ir klaņa gultņu noberze. Tas ir verificēts agregāta risks, ne minējums.

Kārba
Automātiskā kārba paliek ierasta uzturēšanas izmaksa. Klātienē jāpārbauda pārslēgšanās.

EGR un ieplūde
Šim agregātam oglekļa nogulsnes ir tipiskas. Tas nav pirkuma šķērslis, ja diagnostika ir tīra.

Stiprās puses
Konstrukcija ir pazīstama servisiem. Uzturēšana joprojām ir jāpierāda ar dokumentiem.`,
      identification: {
        ...id,
        engine: { value: "N57D30", confidence: "A", evidence: "dīleris", candidates: ["N57D30"] },
      },
    });
    expect(n57.ok).toBe(true);
    expect(n57.errors).toHaveLength(0);
  });

  it("L2 flags invented experience", () => {
    const r = lintTechnicalRiskText({
      text: `${okText}\n\nManā praksē šādi motori bieži plīst.`,
      identification: id,
    });
    expect(r.errors.some((e) => e.id === "L2")).toBe(true);
  });

  it("L3 flags EUR while KB EUR bands are inactive", () => {
    const banned = lintTechnicalRiskText({
      text: `${okText}\n\nRemonts 800 EUR.`,
      identification: id,
      map: sampleMap(),
      allowCostBands: false,
    });
    expect(banned.errors.some((e) => e.id === "L3")).toBe(true);

    const mapWithCost = sampleMap({
      risks: [
        {
          ...sampleMap().risks[0]!,
          cost_band_eur: { min: 400, max: 800, source: "KB:N47", dated: "2026-09" },
        },
      ],
    });
    const evenWithKbShape = lintTechnicalRiskText({
      text: `${okText}\n\nOrientējoši 400-800 EUR.`,
      identification: id,
      map: mapWithCost,
      allowCostBands: true,
    });
    expect(evenWithKbShape.errors.some((e) => e.id === "L3")).toBe(true);

    const unpaid = lintTechnicalRiskText({
      text: `${okText}\n\nOrientējoši 400-800 EUR.`,
      identification: id,
      map: sampleMap({
        risks: [
          {
            ...sampleMap().risks[0]!,
            cost_band_eur: { min: 400, max: 800, source: "https://www.autodoc.de", dated: "2026-09" },
          },
        ],
      }),
      allowCostBands: true,
    });
    expect(unpaid.errors.some((e) => e.id === "L3")).toBe(true);

    const hidden = lintTechnicalRiskText({
      text: `${okText}\n\nOrientējoši 400-800 EUR.`,
      identification: id,
      map: { ...mapWithCost, hide_cost_bands: true },
      allowCostBands: true,
    });
    expect(hidden.errors.some((e) => e.id === "L3")).toBe(true);
  });

  it("L4 flags a foreign engine code", () => {
    const r = lintTechnicalRiskText({
      text: `${okText}\n\nB47D20 ķēde šeit neattiecas.`,
      identification: id,
    });
    expect(r.errors.some((e) => e.id === "L4")).toBe(true);
  });

  it("L5 flags chain and timing belt on the same engine", () => {
    const r = lintTechnicalRiskText({
      text: `${okText}\n\nSadales ķēde un zobsiksna šim motoram.`,
      identification: id,
    });
    expect(r.errors.some((e) => e.id === "L5")).toBe(true);
  });

  it("L6 flags markdown", () => {
    const r = lintTechnicalRiskText({
      text: `**Sadales ķēde**\n\n${okText}`,
      identification: id,
    });
    expect(r.errors.some((e) => e.id === "L6")).toBe(true);
  });

  it("L16 warns on internal terms Riska kartē and Dzinēja identifikācija", () => {
    const r = lintTechnicalRiskText({
      text: `${okText}\n\nRiska kartē ķēde ir iekšā. Dzinēja identifikācija paliek iekšēja.`,
      identification: id,
    });
    expect(r.warnings.some((w) => w.id === "L16")).toBe(true);
  });

  it("L11 warns when confidence C has no marking caveat", () => {
    const cId: TechnicalRiskIdentification = {
      ...id,
      engine: { value: "", confidence: "C", evidence: "neskaidrs", candidates: ["N47D20", "B47D20"] },
    };
    const r = lintTechnicalRiskText({ text: okText, identification: cId });
    expect(r.warnings.some((w) => w.id === "L11")).toBe(true);
  });
});
