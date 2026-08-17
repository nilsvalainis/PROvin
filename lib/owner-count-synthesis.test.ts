import { describe, expect, it } from "vitest";
import {
  createDefaultSourceBlocks,
  emptyVendorAvotuBlock,
  emptyVinRegistryBlock,
  SOURCE_BLOCK_LABELS,
} from "@/lib/admin-source-blocks";
import { emptyCcVinBlock } from "@/lib/cc-vin-report";
import {
  extractExplicitOwnerCount,
  formatOwnerCountBannerNote,
  inferOwnerCountry,
  synthesizeOwnerCountsFromBlocks,
  synthesizeOwnerCountsFromPdfInput,
} from "@/lib/owner-count-synthesis";

describe("extractExplicitOwnerCount", () => {
  it("reads N īpašnieki and ignores owner-change wording", () => {
    expect(extractExplicitOwnerCount("6 īpašnieki")).toBe(6);
    expect(extractExplicitOwnerCount("Aplēstais īpašnieku skaits: 2")).toBe(2);
    expect(extractExplicitOwnerCount("Īpašnieku skaits: 4")).toBe(4);
    expect(extractExplicitOwnerCount("2 īpašnieki (pēc OCTA polišu maiņām)")).toBe(2);
    expect(extractExplicitOwnerCount("04.09.2023 īpašnieka maiņa: AutoEtt\n12.10.2023 īpašnieka maiņa: X")).toBeNull();
    expect(extractExplicitOwnerCount("2 īpašnieku maiņas")).toBeNull();
  });
});

describe("inferOwnerCountry", () => {
  it("maps registry names and country words", () => {
    expect(inferOwnerCountry("", SOURCE_BLOCK_LABELS.carinfo)).toBe("sweden");
    expect(inferOwnerCountry("Exported from Sweden")).toBe("sweden");
    expect(inferOwnerCountry("Dānijas reģistrs")).toBe("denmark");
  });
});

describe("synthesizeOwnerCountsFromBlocks", () => {
  it("joins Latvia CSDD with Sweden car.info and does not add vendor totals", () => {
    const blocks = createDefaultSourceBlocks();
    blocks.csdd.ownerCountLatvia = "2";
    blocks.carinfo = { ...emptyVinRegistryBlock(), ownersSummary: "6 īpašnieki\n04.09.2023 īpašnieka maiņa: AutoEtt" };
    blocks.carvertical = { ...emptyVendorAvotuBlock(), comments: "3 īpašnieki Zviedrijā" };
    blocks.autodna = { ...emptyVendorAvotuBlock(), comments: "2 īpašnieku maiņas" };
    const syn = synthesizeOwnerCountsFromBlocks(blocks);
    expect(syn.noteLine).toBe("Īpašnieki Latvijā: 2 + Īpašnieki Zviedrijā: 6");
    expect(syn.chosen.sweden?.count).toBe(6);
    expect(syn.chosen.other).toBeUndefined();
  });

  it("does not sum AutoDNA and CarVertical for the same unspecified market", () => {
    const blocks = createDefaultSourceBlocks();
    blocks.carvertical = { ...emptyVendorAvotuBlock(), comments: "3 īpašnieki" };
    blocks.autodna = { ...emptyVendorAvotuBlock(), comments: "2 īpašnieki" };
    const syn = synthesizeOwnerCountsFromBlocks(blocks);
    expect(syn.noteLine).toBe("Īpašnieki ārvalstīs: 3");
    expect(syn.noteLine).not.toMatch(/5/);
  });
});

describe("synthesizeOwnerCountsFromPdfInput", () => {
  it("builds the registration-tile note from CSDD + ZVIEDRIJAS REĢISTRI", () => {
    const syn = synthesizeOwnerCountsFromPdfInput({
      csddForm: { ...createDefaultSourceBlocks().csdd, ownerCountLatvia: "2", registrationStatus: "Uzskaitē" },
      ccVinBlock: emptyCcVinBlock(),
      manualVendorBlocks: [
        {
          title: SOURCE_BLOCK_LABELS.carinfo,
          mileageRows: [],
          incidentRows: [],
          comments: "",
          ownersSummary: "6 īpašnieki",
        },
        {
          title: SOURCE_BLOCK_LABELS.carvertical,
          mileageRows: [],
          incidentRows: [],
          comments: "3 īpašnieki",
        },
      ],
    });
    expect(formatOwnerCountBannerNote(syn.chosen)).toBe("Īpašnieki Latvijā: 2 + Īpašnieki Zviedrijā: 6");
  });
});
