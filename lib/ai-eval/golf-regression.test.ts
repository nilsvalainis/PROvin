import { describe, expect, it } from "vitest";

import { golfBlocks, golfFixture, golfIncidentsTile, golfTraficomText } from "@/lib/ai-eval/golf-gte-fixture";
import { buildCanonicalFacts } from "@/lib/canonical-facts-sheet";
import { parseTraficomReport } from "@/lib/traficom-report-parse";

/**
 * j26 PR0: Golf GTE regresijas fikstūra. Testi apraksta uzvedību; katrs nākamais PR
 * (PR1-PR6) šeit pievieno savas pārbaudes.
 */
describe("VW Golf GTE regresija (j26)", () => {
  it("fikstūra ir anonimizēta (VIN maskēts, sintētiski dati)", () => {
    expect(golfFixture.vin).toMatch(/\*/);
    expect(golfTraficomText).not.toMatch(/WVWZZZAUZJW8\d{5}/);
  });

  it("fikstūra ielādējas: Traficom parsēts, izsoles bojājums bez summas, > 12 dīlera rindas", () => {
    const b = golfBlocks();
    expect(parseTraficomReport(golfTraficomText)).not.toBeNull();
    expect(b.traficom_fi.incidents.length).toBeGreaterThan(0);
    expect(b.cc_vin.damages[0]?.amount).toBe("");
    expect(b.auto_records.serviceWorks.length).toBeGreaterThan(12);
  });

  it("faktu lapa uzbūvējas bez kļūdām", () => {
    const facts = buildCanonicalFacts({ vin: golfFixture.vin, sourceBlocks: golfBlocks() });
    expect(facts.sheet.length).toBeGreaterThan(200);
  });
});

/**
 * „Pirms” stāvoklis (main @ j26 sākums). Katrs PR, kas labo kļūdu, pārvērš atbilstošo
 * pārbaudi par „pēc” pārbaudi augstāk.
 */
describe("Golf GTE - pirms stāvoklis (j26 kļūdas)", () => {
  const b = golfBlocks();
  const facts = buildCanonicalFacts({ vin: golfFixture.vin, sourceBlocks: b });

  it("1/10: faktu lapā 0 negadījumu, kartīte „Nav ierakstu” (labo PR1)", () => {
    expect(facts.sheet).toMatch(/Negadījumi \/ zaudējumi: 0 rindas/);
    expect(golfIncidentsTile(b)?.value).toBe("Nav ierakstu");
  });

  it("3: dīlera rindas nogrieztas līdz 12 - jaunākās eļļas maiņas nav redzamas (labo PR2)", () => {
    expect(facts.sheet).not.toMatch(/08\.01\.2024/);
  });

  it("7/12: Traficom ierobežojumi zem „Nodokļu statuss”, sadalīta rinda (labo PR4)", () => {
    expect(b.traficom_fi.statusRecords).toMatch(/Nodokļu statuss: RestrictionsPeriodic/);
    expect(b.traficom_fi.statusRecords).toMatch(/Nodokļu statuss: damage\)/);
  });

  it("9: „Nodošana ekspluatācijā” ar Somiju (labo PR4)", () => {
    expect(b.traficom_fi.timeline.find((r) => r.event === "Nodošana ekspluatācijā")?.country).toBe("Somija");
  });
});
