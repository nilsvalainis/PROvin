import { describe, expect, it } from "vitest";
import { createDefaultSourceBlocks } from "@/lib/admin-source-blocks";
import { buildCanonicalFacts } from "@/lib/canonical-facts-sheet";
import {
  checkCommentContradictions,
  extractCanonicalFactsFromPrompt,
  extractOdometerReadingKms,
  mergeFactCheckFlags,
} from "@/lib/comment-contradiction-check";

function rollbackFacts() {
  const blocks = createDefaultSourceBlocks();
  blocks.csdd = {
    ...blocks.csdd,
    makeModel: "VW Passat",
    firstRegistration: "01.03.2015",
    previousRegistrationCountry: "Vācija",
    ownerCountLatvia: "4",
    mileageHistory: [
      { date: "01.01.2019", odometer: "210000", country: "Vācija" },
      { date: "01.08.2019", odometer: "120000", country: "Latvija" },
    ],
  };
  blocks.carvertical = {
    ...blocks.carvertical,
    comments: "Mileage discrepancy flagged in CarVertical odometer journal.",
  };
  return buildCanonicalFacts({ sourceBlocks: blocks, notes: "serviss 12.05.2018" });
}

describe("comment contradiction check", () => {
  it("flags omitted rollback in mileage-related comments and minimising words on a large drop", () => {
    const facts = rollbackFacts();
    const omitted = checkCommentContradictions({
      text: "Nobraukuma līkne izskatās lineāra un ticama.",
      field: "mileage",
      facts,
    });
    expect(omitted.some((f) => f.kind === "rollback_omitted" && f.level === "E")).toBe(true);

    const minimised = checkCommentContradictions({
      text: "Odometra žurnālā ir nelielas nobīdes pret citiem avotiem.",
      field: "carvertical",
      facts,
    });
    expect(minimised.some((f) => f.kind === "rollback_minimised")).toBe(true);
  });

  it("flags owner-count vs change-count mismatches and DE vs LV first registration", () => {
    const facts = rollbackFacts();
    expect(facts.owners.totalCount).toBe(4);
    expect(facts.owners.changeCount).toBe(3);
    const owners = checkCommentContradictions({
      text: "Latvijā fiksēti 4 īpašnieki un 4 īpašnieku maiņas. Pirmā reģistrācija Latvijā.",
      field: "source",
      facts,
    });
    expect(owners.some((f) => f.kind === "owner_changes")).toBe(true);
    expect(owners.some((f) => f.kind === "first_reg_country")).toBe(true);

    const lvOrigin = buildCanonicalFacts({
      sourceBlocks: {
        ...createDefaultSourceBlocks(),
        csdd: {
          ...createDefaultSourceBlocks().csdd,
          firstRegistration: "10.03.2018",
          previousRegistrationCountry: "",
          ownerCountLatvia: "2",
        },
      },
    });
    const deClaim = checkCommentContradictions({
      text: "Pirmā reģistrācija Vācijā 2018. gadā.",
      field: "csdd",
      facts: lvOrigin,
    });
    expect(deClaim.some((f) => f.kind === "first_reg_country")).toBe(true);
  });

  it("flags leak phrases, unsourced atsavināšanai and invented dates", () => {
    const facts = rollbackFacts();
    const leaks = checkCommentContradictions({
      text: "Pēc operatora norādes šajā auditā auto gatavota atsavināšanai 03.11.2021. Skat. 1. Tehnisko risku analīzē jau.",
      field: "summary",
      facts,
    });
    expect(leaks.some((f) => f.kind === "leak_phrase")).toBe(true);
    expect(leaks.some((f) => f.kind === "atsavinasanai")).toBe(true);
    expect(leaks.some((f) => f.kind === "unsourced_date" && f.message.includes("03.11.2021"))).toBe(true);
  });

  it("does not flag a date that is in source notes", () => {
    const facts = rollbackFacts();
    const ok = checkCommentContradictions({
      text: "Serviss fiksēts 12.05.2018. Odometra kritums pret 210000 km ir jāmin.",
      field: "mileage",
      facts,
    });
    expect(ok.some((f) => f.kind === "unsourced_date")).toBe(false);
  });

  it("parses KANONISKIE FAKTI from a user prompt for post-generation check", () => {
    const facts = rollbackFacts();
    const parsed = extractCanonicalFactsFromPrompt(`cits teksts\n${facts.sheet}\n`);
    expect(parsed).not.toBeNull();
    expect(parsed?.owners.totalCount).toBe(facts.owners.totalCount);
    expect(parsed?.owners.changeCount).toBe(facts.owners.changeCount);
    expect(parsed?.rollbacks.length).toBeGreaterThan(0);
  });

  it("does not treat interval / range / pēc / vairāk nekā km as odometer readings", () => {
    const facts = rollbackFacts();
    expect(facts.latestKm).toBeGreaterThan(100000);
    const sentences = [
      "intervals līdz 30 000 km",
      "intervali no 26 500 līdz 31 425 km",
      "apkope veikta pēc 31 443 km",
      "veikti vairāk nekā 71 000 km",
    ];
    for (const sentence of sentences) {
      expect(extractOdometerReadingKms(sentence)).toEqual([]);
      const flags = checkCommentContradictions({
        text: sentence,
        field: "mileage",
        facts,
      });
      expect(flags.filter((f) => f.id === "km_mismatch")).toEqual([]);
    }
  });

  it("still compares pie / nobraukums / dated km against the latest page reading", () => {
    const facts = rollbackFacts();
    expect(extractOdometerReadingKms("Serviss pie 146 068 km.")).toEqual([146068]);
    expect(extractOdometerReadingKms("Aktuālais nobraukums 80 000 km.")).toEqual([80000]);
    expect(extractOdometerReadingKms("01.06.2024 80 000 km CSDD.")).toEqual([80000]);
    const far = checkCommentContradictions({
      text: "Aktuālais nobraukums 80 000 km.",
      field: "summary",
      facts,
    });
    expect(far.some((f) => f.id === "km_mismatch")).toBe(true);
    const close = checkCommentContradictions({
      text: `Pie ${facts.latestKm} km auto ir CSDD.`,
      field: "summary",
      facts,
    });
    expect(close.some((f) => f.id === "km_mismatch")).toBe(false);
  });

  it("merges unit-fact flags with sheet flags without duplicating the same sentence", () => {
    const facts = rollbackFacts();
    const extra = checkCommentContradictions({
      text: "Nobraukums izskatās kārtībā.",
      field: "mileage",
      facts,
    });
    const merged = mergeFactCheckFlags(extra, extra);
    expect(merged.length).toBe(extra.length);
  });
});
