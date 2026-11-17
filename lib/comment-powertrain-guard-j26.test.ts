import { describe, expect, it } from "vitest";

import { createDefaultSourceBlocks } from "@/lib/admin-source-blocks";
import {
  commentsNeedPowertrainRegenerate,
  findPowertrainContradictions,
  stampDealerCommentBlock,
  stampGeneratedAgainstOnBlocks,
  type LoadedPowertrainIdentity,
} from "@/lib/comment-powertrain-guard";
import { parseOneautoIngestRaw } from "@/lib/oneauto-to-auto-records";

const GOLF: LoadedPowertrainIdentity = { engineCode: "CUKB", fuelKind: "petrol", fuelRaw: "Benzīns", source: "dealer" };

describe("j26 PR6 - dzinēja/degvielas paziņojums", () => {
  it("kārbas un platformas kodi (DQ400E, EA211, MQB) nav cits dzinēja kods", () => {
    const text =
      "Dzinējs CUKB (EA211 saime) strādā kopā ar DQ400E kārbu. MQB platformas dzinēja nodalījumā jāpārbauda dzesēšana.";
    expect(findPowertrainContradictions(text, GOLF)).toEqual([]);
  });

  it("cits dzinēja kods teikumā par dzinēju joprojām ir kļūda", () => {
    const hits = findPowertrainContradictions("Dzinējs OM651 šim auto ir jutīgs pret eļļas patēriņu.", GOLF);
    expect(hits.map((h) => h.id)).toEqual(["powertrain_engine"]);
  });

  it("kods teikumā bez dzinēja vārda netiek salīdzināts", () => {
    expect(findPowertrainContradictions("Kārba DQ400E prasa eļļas maiņu ik 60 000 km.", GOLF)).toEqual([]);
  });

  it("zīmogs katram laukam: paziņojums pazūd tikai, kad visi 3 lauki ģenerēti pret pašreizējo identitāti", () => {
    let blocks = createDefaultSourceBlocks();
    blocks.auto_records = {
      ...blocks.auto_records,
      oneautoIngest: { ...parseOneautoIngestRaw({}), generatedAgainst: { engineCode: "", fuelKind: "diesel" } },
    };
    blocks.csdd = { ...blocks.csdd, fuelType: "Benzīns" };
    const comments = [
      { field: "technical_risks" as const, text: "Teksts A." },
      { field: "summary" as const, text: "Teksts B." },
      { field: "dealer_comment" as const, text: "Teksts C." },
    ];
    expect(commentsNeedPowertrainRegenerate({ sourceBlocks: blocks, comments })).toBe(true);
    blocks = stampGeneratedAgainstOnBlocks(blocks, null, "technical_risks");
    blocks = stampGeneratedAgainstOnBlocks(blocks, null, "summary");
    expect(commentsNeedPowertrainRegenerate({ sourceBlocks: blocks, comments })).toBe(true);
    blocks = {
      ...blocks,
      auto_records: stampDealerCommentBlock("auto_records", "comments", blocks.auto_records, blocks, null),
    };
    expect(commentsNeedPowertrainRegenerate({ sourceBlocks: blocks, comments })).toBe(false);
  });

  it("zīmogi pa laukiem saglabājas pēc parsēšanas (draft JSON)", () => {
    const blocks = stampGeneratedAgainstOnBlocks(createDefaultSourceBlocks(), null, "summary");
    const parsed = parseOneautoIngestRaw(JSON.parse(JSON.stringify(blocks.auto_records.oneautoIngest)));
    expect(parsed.generatedAgainstByField?.summary).toBeDefined();
  });

  it("citu bloku ✨ nezīmogo dīlera komentāru", () => {
    const b = createDefaultSourceBlocks();
    expect(stampDealerCommentBlock("autodna", "comments", b.autodna, b, null)).toBe(b.autodna);
    expect(stampDealerCommentBlock("auto_records", "serviceHistoryNotes", b.auto_records, b, null)).toBe(b.auto_records);
  });
});
