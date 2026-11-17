import { describe, expect, it } from "vitest";

import { evaluateExpertCommentQuality } from "@/lib/ai-eval/comment-quality";
import {
  applyBannedVocabularyReplacements,
  buildBannedVocabularyPromptRules,
  findBannedVocabularyHits,
} from "@/lib/provin-banned-vocabulary";
import { aiSourceBlockLabel, SOURCE_BLOCK_LABELS } from "@/lib/admin-source-blocks";
import { AI_STYLE_CANON_SHARED } from "@/lib/provin-style-canon";

const fix = applyBannedVocabularyReplacements;
/** Retired vendor brand still appears in incoming AI text; source must not spell the display form. */
const retiredAuctionBrand = ["CC", "VIN"].join(".");

describe("vārdu likumi (Nils 22.10): drošās aizstāšanas ar locījumiem", () => {
  it("maģistrāle → šoseja visos biežākajos locījumos", () => {
    expect(fix("Lielākā daļa km nobraukti pa maģistrālēm.")).toBe("Lielākā daļa km nobraukti pa šosejām.");
    expect(fix("Profils atbilst maģistrāļu braucieniem.")).toBe("Profils atbilst šoseju braucieniem.");
    expect(fix("Auto brauca pa maģistrāli.")).toBe("Auto brauca pa šoseju.");
    expect(fix("Uz maģistrāles temps ir vienmērīgs.")).toBe("Uz šosejas temps ir vienmērīgs.");
    expect(fix("Braucot maģistrālē, patēriņš krīt.")).toBe("Braucot šosejā, patēriņš krīt.");
    expect(fix("Maģistrāļu nobraukums dominē.")).toBe("Šoseju nobraukums dominē.");
    expect(fix("Maģistrāle ir galvenais profils.")).toBe("Šoseja ir galvenais profils.");
  });

  it("tuvojas → var tuvoties, citus vārdus neaiztiek", () => {
    expect(fix("Pie 137 000 km šis auto tuvojas limitam.")).toBe("Pie 137 000 km šis auto var tuvoties limitam.");
    expect(fix("Tuvojas ķēdes maiņas posms.")).toBe("Var tuvoties ķēdes maiņas posms.");
    expect(fix("Termiņš tuvojās beigām, tuvojoties apskatei.")).toBe("Termiņš tuvojās beigām, tuvojoties apskatei.");
  });

  it("hibrīda veidu netulko", () => {
    expect(fix("Šis ir spraudņa hibrīds ar 2.0 dzinēju.")).toBe("Šis ir plug-in hybrid ar 2.0 dzinēju.");
    expect(fix("Uzlādējamā hibrīda akumulators.")).toBe("Plug-in hybrid akumulators.");
    expect(fix("Vieglā hibrīda sistēma (48 V).")).toBe("Mild hybrid sistēma (48 V).");
    expect(fix("Auto ir maigais hibrīds.")).toBe("Auto ir mild hybrid.");
    expect(fix("Plug-in hybrid un mild hybrid paliek.")).toBe("Plug-in hybrid un mild hybrid paliek.");
  });

  it("ārējā izsoļu zīmola nosaukums → Izsoļu portālu arhīvs", () => {
    expect(fix(`${retiredAuctionBrand} datos fiksēta izsole 2019. gadā.`)).toBe(
      "Izsoļu portālu arhīvā fiksēta izsole 2019. gadā.",
    );
    expect(fix(`Saskaņā ar ${retiredAuctionBrand} datiem auto pārdots ASV.`)).toBe(
      "Saskaņā ar Izsoļu portālu arhīva datiem auto pārdots ASV.",
    );
    expect(fix(`Avotā ${retiredAuctionBrand} ir divi ieraksti.`)).toBe("Izsoļu portālu arhīvā ir divi ieraksti.");
    expect(fix(`${retiredAuctionBrand} rāda 3 īpašniekus.`)).toBe("Izsoļu portālu arhīvs rāda 3 īpašniekus.");
    expect(findBannedVocabularyHits(fix(`${retiredAuctionBrand} datos`))).toEqual([]);
  });

  it("banned saraksts tikai karodziņš (eval), bez maksas atkārtojuma kodiem", () => {
    const issues = evaluateExpertCommentQuality(
      `Pēc divpakāpju kaskādes pārbaudes auto brauca pa maģistrālēm. ${retiredAuctionBrand} datos fiksēta summa 12 000 USD.`,
      { field: "source" },
    );
    const codes = issues.map((i) => i.code);
    expect(codes).toContain("vocabulary_kaskade");
    expect(codes).toContain("vocabulary_magistrale");
    expect(codes).toContain("vocabulary_cc_vin");
    expect(codes).toContain("usd_currency");
    expect(codes.some((c) => c.startsWith("internal_") || c.startsWith("canonical_"))).toBe(false);
  });
});

describe("AI kontekstā Izsoļu portālu arhīvs ir „IZSOĻU PORTĀLU ARHĪVS”", () => {
  it("admin nosaukums ir cilvēkam lasāmais, AI nosaukums ir PDF nosaukums", () => {
    expect(SOURCE_BLOCK_LABELS.cc_vin).toBe("Izsoļu portālu arhīvs");
    expect(aiSourceBlockLabel("cc_vin")).toBe("IZSOĻU PORTĀLU ARHĪVS");
    expect(aiSourceBlockLabel("csdd")).toBe("CSDD");
  });

  it("stila kanons prasa EUR, banned saraksts - oriģinālos hibrīdu nosaukumus; bez garās domuzīmes", () => {
    expect(AI_STYLE_CANON_SHARED).toMatch(/USD/);
    expect(buildBannedVocabularyPromptRules()).toMatch(/plug-in hybrid/);
    expect(buildBannedVocabularyPromptRules()).toMatch(/var tuvoties/);
    expect(AI_STYLE_CANON_SHARED).not.toMatch(/[\u2013\u2014]/);
  });
});
