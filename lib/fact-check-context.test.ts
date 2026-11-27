/**
 * 27.11 (Nils, BMW WBANX71070CS69827): faktu pārbaude nedrīkst izraut noliegumu no konteksta.
 * Obligātā eļļas piebilde «Tas nenozīmē, ka eļļas maiņa nav veikta…» + 8 maiņas -> nav atraduma;
 * īsts noliegums «dīlera datos eļļas maiņa nav fiksēta» -> atradums paliek.
 */
import { describe, expect, it } from "vitest";
import { createDefaultSourceBlocks } from "@/lib/admin-source-blocks";
import { buildCanonicalFacts, type CanonicalFacts } from "@/lib/canonical-facts-sheet";
import { checkCommentContradictions } from "@/lib/comment-contradiction-check";
import { dropDealerRecommendationSentences, isDealerRecommendationSentence } from "@/lib/dealer-comments-review-core";
import {
  dropContextExemptFlags,
  FACT_CHECK_CONTEXT_DIRECTIVE,
  isFactCheckExemptSentence,
  isHypotheticalNegationSentence,
  isOilRequiredNoteSentence,
} from "@/lib/fact-check-context";
import { OIL_NOT_SKIPPED_NOTE, oilGenericRecordsNote, oilPossibleChangeNote } from "@/lib/oil-interval-dealer-notes";
import { parseAiFactCheck, UNIT_FACT_AI_SYSTEM } from "@/lib/unit-facts/ai-check";
import type { FactCheckFlag } from "@/lib/unit-facts/types";

const EIGHT = ["10.06.2011", "22.06.2012", "06.08.2013", "15.10.2014", "20.10.2015", "18.11.2016", "05.12.2017", "22.01.2018"];

function facts(over: Partial<CanonicalFacts> = {}): CanonicalFacts {
  return {
    ...buildCanonicalFacts({ sourceBlocks: createDefaultSourceBlocks() }),
    dealerComponentCounts: [{ label: "Dzinēja eļļas maiņas", dates: EIGHT }],
    ...over,
  };
}

const negated = (text: string, f = facts()) =>
  checkCommentContradictions({ text, field: "auto_records:oilChangeIntervalNotes", facts: f }).filter(
    (x) => x.kind === "negated_fact",
  );

/** BMW lauks no Nila ekrānuzņēmuma (anonimizēts: bez personas datiem, tikai dīlera fakti). */
const BMW_OIL_FIELD = [
  "Ražotāja intervāls: 30 000 km / 24 mēn. (M57 D30 (306D3), CBS Longlife-04).",
  "",
  "Eļļas maiņu regularitāte un intervāli",
  "Oficiālā dīlera datos fiksētas 8 dzinēja eļļas maiņas. Intervāli starp tām ir no 29 660 līdz 38 620 km un 10-17 mēneši. Seši no septiņiem intervāliem pārsniedz ražotāja 30 000 km robežu, lielākie no tiem: no 2012. gada jūnija līdz 2013. gada augustam fiksēts 38 620 km intervāls (14 mēneši).",
  "",
  `${OIL_NOT_SKIPPED_NOTE.lv} ${oilGenericRecordsNote("lv", ["24.10.2012", "04.04.2014"], 2)}`,
  "",
  "Pēdējais eļļas servisa ieraksts",
  "Pēdējā dzinēja eļļas maiņa dīlera reģistrā veikta 2018. gada 22. janvārī ar nobraukumu 263 166 km.",
].join("\n");

describe("BMW gadījums: obligātā piebilde nav pretruna", () => {
  it("piebilde + 8 maiņas -> nav negated_fact", () => {
    expect(negated(BMW_OIL_FIELD)).toEqual([]);
  });

  it("tikai piebilde (visas valodas, arī vecie formulējumi) -> nav atraduma", () => {
    for (const note of [
      ...Object.values(OIL_NOT_SKIPPED_NOTE),
      "Tas nenozīmē, ka eļļas maiņa nav veikta - tā var būt veikta neatkarīgā servisā, kas datus dīlera sistēmai nenodod.",
      "Šajos periodos ir arī dīlera ieraksti bez detalizēta darbu apraksta (24.10.2012, 04.04.2014) - tie teorētiski var liecināt par eļļas maiņu, bet to nevaram apliecināt.",
    ]) {
      expect(negated(note)).toEqual([]);
      expect(isOilRequiredNoteSentence(note)).toBe(true);
    }
  });

  it("visas 3 piebildes visās valodās ir izlaižamas", () => {
    for (const lang of ["lv", "en", "ru", "de"] as const) {
      expect(isOilRequiredNoteSentence(OIL_NOT_SKIPPED_NOTE[lang])).toBe(true);
      expect(isOilRequiredNoteSentence(oilGenericRecordsNote(lang, ["24.10.2012"], 1))).toBe(true);
      expect(isOilRequiredNoteSentence(oilGenericRecordsNote(lang, ["24.10.2012", "04.04.2014"], 2))).toBe(true);
      expect(isOilRequiredNoteSentence(oilPossibleChangeNote(lang, ["24.10.2012"], 1))).toBe(true);
    }
  });
});

describe("īsts noliegums paliek", () => {
  it("«dīlera datos eļļas maiņa nav fiksēta» ar 8 maiņām -> atradums", () => {
    expect(negated("Dīlera datos eļļas maiņa nav fiksēta.")).toHaveLength(1);
  });

  it("īsts noliegums blakus piebildei netiek palaists garām", () => {
    const text = `${OIL_NOT_SKIPPED_NOTE.lv} Dīlera datos dzinēja eļļas maiņas nav fiksētas.`;
    const hits = negated(text);
    expect(hits).toHaveLength(1);
    expect(hits[0]!.sentence).toBe("Dīlera datos dzinēja eļļas maiņas nav fiksētas.");
  });

  it("periods: «no 2019 līdz 2020 eļļas maiņa nav fiksēta» - patiess, ja maiņu tur nav", () => {
    const f = facts({ dealerComponentCounts: [{ label: "Dzinēja eļļas maiņas", dates: ["10.06.2011", "22.01.2018", "20.04.2022"] }] });
    expect(negated("No 2019. gada līdz 2020. gadam dzinēja eļļas maiņa dīlera datos nav fiksēta.", f)).toEqual([]);
    expect(negated("No 2017. gada līdz 2019. gadam dzinēja eļļas maiņa dīlera datos nav fiksēta.", f)).toHaveLength(1);
  });
});

describe("hipotētiski teikumi LV / EN / RU / DE", () => {
  it.each([
    "Nevar apgalvot, ka eļļas maiņa nav veikta.",
    "Ja eļļas maiņa nav veikta, dīlera datos tas nebūtu redzams.",
    "Tas teorētiski var liecināt par eļļas maiņu, bet to nevaram apliecināt.",
    "Tas nepierāda, ka eļļas maiņa nav veikta.",
  ])("LV: %s -> nav negated_fact", (s) => {
    expect(isHypotheticalNegationSentence(s)).toBe(true);
    expect(negated(s)).toEqual([]);
  });

  it.each([
    ["en", "This does not mean that no oil change was done."],
    ["en", "It cannot be claimed that the oil was not changed."],
    ["ru", "Это не означает, что замена масла не проводилась."],
    ["ru", "Нельзя утверждать, что масло не менялось."],
    ["de", "Das bedeutet nicht, dass kein Ölwechsel durchgeführt wurde."],
    ["de", "Es kann nicht behauptet werden, dass das Öl nicht gewechselt wurde."],
  ])("%s: %s", (_l, s) => {
    expect(isHypotheticalNegationSentence(s)).toBe(true);
  });

  it.each([
    "Dīlera datos eļļas maiņa nav fiksēta.",
    "No oil change is recorded in the dealer data.",
    "В данных дилера замена масла не зафиксирована.",
    "In den Händlerdaten ist kein Ölwechsel erfasst.",
  ])("īsts noliegums nav hipotēze: %s", (s) => {
    expect(isFactCheckExemptSentence(s)).toBe(false);
  });
});

describe("filtrs pēc AI / gala saraksta", () => {
  const flag = (sentence: string, kind: FactCheckFlag["kind"] = "contradiction"): FactCheckFlag => ({
    id: "x",
    level: "E",
    kind,
    message: "m",
    sentence,
  });

  it("atmet atradumus uz piebildēm un hipotēzēm, īstos patur", () => {
    const out = dropContextExemptFlags([
      flag(OIL_NOT_SKIPPED_NOTE.lv),
      flag(OIL_NOT_SKIPPED_NOTE.en, "unsourced_date"),
      flag("This does not mean that no oil change was done."),
      flag("No oil change is recorded in the dealer data."),
      flag("Dīlera datos eļļas maiņa nav fiksēta.", "negated_fact"),
    ]);
    expect(out.map((f) => f.sentence)).toEqual([
      "No oil change is recorded in the dealer data.",
      "Dīlera datos eļļas maiņa nav fiksēta.",
    ]);
  });

  it("AI atbilde ar piebildi tiek atmesta (deterministisks filtrs pēc AI)", () => {
    const fact = { id: "f1", statementLv: "fakts", sources: [] } as never;
    const text = `${OIL_NOT_SKIPPED_NOTE.lv} Dīlera datos eļļas maiņa nav fiksēta.`;
    const out = parseAiFactCheck(
      {
        contradictions: [
          { fact_id: "f1", sentence: OIL_NOT_SKIPPED_NOTE.lv, why: "izrauts" },
          { fact_id: "f1", sentence: "Dīlera datos eļļas maiņa nav fiksēta.", why: "īsts" },
        ],
      },
      text,
      [fact],
    );
    expect(out.map((f) => f.sentence)).toEqual(["Dīlera datos eļļas maiņa nav fiksēta."]);
  });

  it("AI prompts prasa kontekstu un aizliedz atzīmēt piebildes", () => {
    expect(FACT_CHECK_CONTEXT_DIRECTIVE).toMatch(/kontekst/i);
    expect(FACT_CHECK_CONTEXT_DIRECTIVE).toMatch(/NEKAD neatzīmē obligātās eļļas piebildes/);
    expect(UNIT_FACT_AI_SYSTEM).toContain(FACT_CHECK_CONTEXT_DIRECTIVE);
  });
});

describe("dīlera lauki bez ieteikumiem (#1118)", () => {
  it("BMW beigu teikums «Ieteicams pieprasīt pārdevējam…» tiek izmests, fakti paliek", () => {
    const text =
      "Jaunākais apstiprinātais nobraukums ir 438 611 km (29.06.2026, CSDD), tātad kopš pēdējās dīlera reģistrētās eļļas maiņas nobraukti 175 445 km bez ieraksta dīlera sistēmā. Ieteicams pieprasīt pārdevējam apkopju dokumentus par šo periodu un pārbaudīt CBS servisa datus servisā.";
    const out = dropDealerRecommendationSentences(text);
    expect(out).toContain("nobraukti 175 445 km bez ieraksta dīlera sistēmā.");
    expect(out).not.toMatch(/Ieteicams|pieprasīt/);
  });

  it.each([
    "We recommend asking the seller for service invoices.",
    "It is recommended to request the service records.",
    "Рекомендуется запросить у продавца сервисные документы.",
    "Wir empfehlen, die Wartungsnachweise beim Verkäufer anzufordern.",
    "Pārdevējam jālūdz servisa rēķini.",
  ])("ieteikums: %s", (s) => {
    expect(isDealerRecommendationSentence(s)).toBe(true);
  });

  it.each([
    "Manufacturer recommended interval: 30,000 km / 24 months.",
    OIL_NOT_SKIPPED_NOTE.en,
    oilGenericRecordsNote("en", ["24.10.2012"], 1),
    OIL_NOT_SKIPPED_NOTE.de,
    OIL_NOT_SKIPPED_NOTE.ru,
  ])("fakts / piebilde nav ieteikums: %s", (s) => {
    expect(isDealerRecommendationSentence(s)).toBe(false);
  });
});
