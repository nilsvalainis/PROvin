import { describe, expect, it } from "vitest";

import { golfBlocks, golfFixture, golfIncidentsTile, golfTraficomText } from "@/lib/ai-eval/golf-gte-fixture";
import { createDefaultSourceBlocks } from "@/lib/admin-source-blocks";
import { buildCanonicalFacts } from "@/lib/canonical-facts-sheet";
import { checkCommentContradictions } from "@/lib/comment-contradiction-check";
import { orderHasIncidentDataForAi } from "@/lib/admin-ai-data-availability";
import { golfComment } from "@/lib/ai-eval/golf-gte-fixture";
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

describe("Golf GTE - PR1 bojājumu pierādījumi (1, 10)", () => {
  const b = golfBlocks();
  const facts = buildCanonicalFacts({ vin: golfFixture.vin, sourceBlocks: b });

  it("faktu lapā sadaļa „Bojājumi (visi avoti)” ar izsoli un FIN izņemšanu; PDF tabula nemainās", () => {
    expect(facts.incidents).toHaveLength(0);
    expect(facts.damageEvidence.total).toBeGreaterThanOrEqual(2);
    expect(facts.sheet).toMatch(/Bojājumi \(visi avoti, arī bez summas\): \d+/);
    expect(facts.sheet).toMatch(/02\.04\.2024 \| .+ \| summa nav \| CC\.VIN/);
    expect(facts.sheet).toMatch(/18\.03\.2024 \| Noņemts no reģistra bojājuma dēļ \| summa nav/);
  });

  it("AI datu pieejamība: ir negadījumu dati (traficom_fi + izsole)", () => {
    expect(orderHasIncidentDataForAi(b)).toBe(true);
  });

  it("kartīte: „Bojājumi: N”, dzeltena, nevis „Nav ierakstu”", () => {
    const tile = golfIncidentsTile(b);
    expect(tile?.value).toMatch(/^Bojājumi: \d+$/);
    expect(tile?.note).toBe("Izsoļu / reģistru bojājumi bez summas");
    expect(tile?.tone).toBe("warn");
  });

  it("validators: „nav bojājumu/atlīdzību” -> no_damage_claim, arī ar „neizslēdz”", () => {
    const flags = checkCommentContradictions({ text: golfComment("incidents-no-damage").text, field: "incidents", facts });
    expect(flags.some((f) => f.kind === "no_damage_claim" && f.level === "E")).toBe(true);
  });

  it("validators: pareizi teikumi netiek atzīmēti", () => {
    for (const text of [
      "Izsolē 02.04.2024 fiksēti bojājumi (priekšpuse, sāns), zaudējumu summa nav norādīta.",
      "Somijas reģistrā auto noņemts no reģistra bojājuma dēļ 18.03.2024; LTAB atlīdzības ieraksta nav.",
      "Nav zināms, vai bojājumi ir kvalitatīvi novērsti.",
    ]) {
      const flags = checkCommentContradictions({ text, field: "incidents", facts });
      expect(flags.filter((f) => f.kind === "no_damage_claim"), text).toEqual([]);
    }
  });

  it("bez bojājumiem validators klusē", () => {
    const empty = buildCanonicalFacts({ sourceBlocks: createDefaultSourceBlocks() });
    const flags = checkCommentContradictions({ text: "Avotos nav fiksētu bojājumu.", field: "incidents", facts: empty });
    expect(flags.some((f) => f.kind === "no_damage_claim")).toBe(false);
  });
});

/**
 * „Pirms” stāvoklis (main @ j26 sākums). Katrs PR, kas labo kļūdu, pārvērš atbilstošo
 * pārbaudi par „pēc” pārbaudi augstāk.
 */
describe("Golf GTE - pirms stāvoklis (j26 kļūdas)", () => {
  const b = golfBlocks();
  const facts = buildCanonicalFacts({ vin: golfFixture.vin, sourceBlocks: b });

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
