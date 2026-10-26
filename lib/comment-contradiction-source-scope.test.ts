import { describe, expect, it } from "vitest";
import { createDefaultSourceBlocks } from "@/lib/admin-source-blocks";
import { buildCanonicalFacts, type CanonicalFacts } from "@/lib/canonical-facts-sheet";
import { checkCommentContradictions } from "@/lib/comment-contradiction-check";

/** FABLE F2 C (BMW 330i US→LT→DE→LV): visi negadījumi ārvalstīs, CSDD/LTAB tīrs; 11 īpašnieki, LV 4. */
function foreignOnlyFacts(extraLocal = false): CanonicalFacts {
  const base = buildCanonicalFacts({ sourceBlocks: createDefaultSourceBlocks() });
  const row = (sourceLabel: string, country: string, i: number) => ({
    date: `0${i}.2021`,
    lossAmount: "3 000 EUR",
    country,
    sortableTime: i,
    sourceOrder: i,
    sourceLabel,
  });
  const incidents = [row("CarVertical", "Kanāda", 1), row("AutoDNA", "Lietuva", 2), row("AutoDNA", "Vācija", 3)];
  if (extraLocal) incidents.push(row("LTAB", "Latvija", 4));
  return {
    ...base,
    incidents,
    damageEvidence: {
      rows: incidents.map((r) => ({ date: r.date, descriptionLv: "Bojājuma ieraksts", amount: r.lossAmount, sourceLabel: r.sourceLabel })),
      total: incidents.length,
      withoutAmountCount: 0,
      hasDealerBodyOrGlassWork: false,
    },
    owners: { ...base.owners, totalCount: 11, changeCount: 10, latviaOwners: 4, latviaChanges: 3 },
  };
}

const kinds = (text: string, facts: CanonicalFacts, field = "csdd") =>
  checkCommentContradictions({ text, field, facts }).map((f) => f.kind);

describe("faktu pārbaude - avota teikumi nav viltus kļūdas", () => {
  it("«CSDD vietēju negadījumu nav» nav kļūda, ja visi ieraksti ārvalstīs", () => {
    const k = kinds("Aizliegumu vai vietējo apdrošinātāju un policijas CSNg ierakstu nav.", foreignOnlyFacts());
    expect(k).not.toContain("no_accidents_claim");
    expect(k).not.toContain("no_damage_claim");
    const summary = kinds(
      "CSDD reģistrā vietēju negadījumu ierakstu nav, un tehniskā apskate pašlaik ir derīga ar novērtējumu 0.",
      foreignOnlyFacts(),
      "summary",
    );
    expect(summary).not.toContain("no_accidents_claim");
    expect(summary).not.toContain("no_damage_claim");
  });

  it("tas pats teikums IR kļūda, ja LTAB ierakstā ir Latvijas negadījums", () => {
    const k = kinds("Vietējo apdrošinātāju un policijas CSNg ierakstu nav.", foreignOnlyFacts(true));
    expect(k).toContain("no_damage_claim");
  });

  it("vispārīgs «negadījumu nav» joprojām ir kļūda", () => {
    const k = kinds("Negadījumu nav fiksētu.", foreignOnlyFacts(), "summary");
    expect(k).toContain("no_accidents_claim");
    const all = kinds("CSDD un visos avotos negadījumu nav.", foreignOnlyFacts(), "summary");
    expect(all).toContain("no_accidents_claim");
  });

  it("«7 īpašnieki ārvalstu posmā» (11 - LV 4) nav kļūda, bet «7 īpašnieki» bez konteksta ir", () => {
    const facts = foreignOnlyFacts();
    expect(
      kinds("Avots kopējā 11 īpašnieku vēsturē atsevišķi fiksē 7 īpašniekus ārvalstu posmā.", facts, "carvertical"),
    ).not.toContain("owner_count");
    expect(kinds("Automašīnai bijuši 7 īpašnieki.", facts, "carvertical")).toContain("owner_count");
  });
});
