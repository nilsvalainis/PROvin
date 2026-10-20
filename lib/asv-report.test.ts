import { describe, expect, it } from "vitest";
import { mergeSourceBlocksWithDefaults } from "@/lib/admin-source-blocks";
import { normalizeOrderWorkspacePersistBody } from "@/lib/admin-order-workspace-persist";
import {
  emptyAsvBlock,
  emptyAsvDamageRow,
  normalizeAsvBlock,
  asvBlockToPlainText,
} from "@/lib/asv-report";

const filledDamageUsd = {
  date: "12.04.2019",
  region: "Florida",
  amount: "2 400 USD",
  description: "Rear bumper",
};

const filledDamageEur = {
  ...filledDamageUsd,
  amount: "2 210 €",
};

describe("normalizeAsvBlock Fiksētie bojājumi", () => {
  it("pads an empty damages table with one draft row", () => {
    const b = normalizeAsvBlock({ comments: "x" });
    expect(b.damages).toEqual([emptyAsvDamageRow()]);
  });

  it("keeps trailing empty draft rows from admin + Rinda", () => {
    const b = normalizeAsvBlock({
      damages: [filledDamageUsd, emptyAsvDamageRow()],
    });
    expect(b.damages).toHaveLength(2);
    expect(b.damages[0]).toEqual(filledDamageEur);
    expect(b.damages[1]).toEqual(emptyAsvDamageRow());
  });

  it("keeps more than one trailing empty + Rinda row", () => {
    const b = normalizeAsvBlock({
      damages: [filledDamageUsd, emptyAsvDamageRow(), emptyAsvDamageRow()],
    });
    expect(b.damages).toHaveLength(3);
    expect(b.damages[2]).toEqual(emptyAsvDamageRow());
  });

  it("converts a stored USD amount to EUR on read", () => {
    const b = normalizeAsvBlock({ damages: [filledDamageUsd] });
    expect(b.damages[0]?.amount).toBe("2 210 €");
    expect(b.damages[0]?.amount).not.toMatch(/USD|ECB/);
  });

  it("drops empty rows that are not trailing", () => {
    const b = normalizeAsvBlock({
      damages: [emptyAsvDamageRow(), filledDamageUsd],
    });
    expect(b.damages).toEqual([filledDamageEur]);
  });

  it("omits empty draft rows from client plain text", () => {
    const b = normalizeAsvBlock({
      damages: [filledDamageUsd, emptyAsvDamageRow()],
    });
    const plain = asvBlockToPlainText(b);
    expect(plain).toContain("Rear bumper");
    expect(plain.split("\n").filter((line) => line.includes("\t"))).toHaveLength(1);
  });
});

describe("ASV persist keeps + Rinda draft", () => {
  it("survives mergeSourceBlocksWithDefaults and workspace persist normalize", () => {
    const asv = {
      ...emptyAsvBlock(),
      damages: [filledDamageUsd, emptyAsvDamageRow()],
    };
    const merged = mergeSourceBlocksWithDefaults({ asv });
    expect(merged.asv.damages).toHaveLength(2);
    expect(merged.asv.damages[1]).toEqual(emptyAsvDamageRow());

    const persisted = normalizeOrderWorkspacePersistBody({
      sourceBlocks: merged,
      iriss: "",
      apskatesPlāns: "",
      tehniskoRiskuAnalize: "",
      cenasAtbilstiba: "",
      previewConfirmed: false,
      vehicleAiExtraction: null,
      vehicleAiExtractionMeta: null,
    });
    expect(persisted.sourceBlocks.asv.damages).toHaveLength(2);
    expect(persisted.sourceBlocks.asv.damages[0]?.amount).toBe("2 210 €");
    expect(persisted.sourceBlocks.asv.damages[1]).toEqual(emptyAsvDamageRow());
  });
});
