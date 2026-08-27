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
  formatOwnerCountCountryStats,
  formatOwnerCountTileFacts,
  inferOwnerCountry,
  synthesizeOwnerCountsFromBlocks,
  synthesizeOwnerCountsFromPdfInput,
} from "@/lib/owner-count-synthesis";

describe("extractExplicitOwnerCount", () => {
  it("reads N īpašnieki and ignores owner-change wording", () => {
    expect(extractExplicitOwnerCount("6 īpašnieki")).toBe(6);
    expect(extractExplicitOwnerCount("Aplēstais īpašnieku skaits: 2")).toBe(2);
    expect(extractExplicitOwnerCount("Īpašnieku skaits: 4")).toBe(4);
    expect(extractExplicitOwnerCount("Dānijas īpašnieku skaits: 2 (līzings + privāta reģistrācija Dānijā, ne pēc OCTA).")).toBe(2);
    expect(extractExplicitOwnerCount("04.09.2023 īpašnieka maiņa: AutoEtt\n12.10.2023 īpašnieka maiņa: X")).toBeNull();
    expect(extractExplicitOwnerCount("2 īpašnieku maiņas")).toBeNull();
  });
});

describe("inferOwnerCountry", () => {
  it("maps registry names and country words", () => {
    expect(inferOwnerCountry("", SOURCE_BLOCK_LABELS.carinfo)).toBe("sweden");
    expect(inferOwnerCountry("6 īpašnieki Zviedrijā")).toBe("sweden");
    expect(inferOwnerCountry("", SOURCE_BLOCK_LABELS.tjekbil)).toBe("denmark");
    expect(inferOwnerCountry("", "Dānijas reģistrs")).toBe("denmark");
    expect(inferOwnerCountry("pirms importa Latvijā. 5 īpašnieki Vācijā")).toBe("germany");
    expect(inferOwnerCountry("vēl nav reģistrēta Latvijā. 2 īpašnieki")).toBe("other");
    expect(inferOwnerCountry("ss.lv sludinājums. 3 īpašnieki")).toBe("other");
    expect(
      inferOwnerCountry(
        "Pārbaudītās valstis: Zviedrija, Vācija, Itālija.\nPirms importa Latvijā. 2 īpašnieki",
      ),
    ).toBe("other");
  });
});

describe("synthesizeOwnerCountsFromBlocks", () => {
  it("joins Latvia CSDD with Sweden car.info and does not add vendor totals", () => {
    const blocks = createDefaultSourceBlocks();
    blocks.csdd.ownerCountLatvia = "2";
    blocks.csdd.registrationStatus = "Uzskaitē";
    blocks.carinfo = { ...emptyVinRegistryBlock(), ownersSummary: "6 īpašnieki\n04.09.2023 īpašnieka maiņa: AutoEtt" };
    blocks.carvertical = { ...emptyVendorAvotuBlock(), comments: "3 īpašnieki Zviedrijā" };
    blocks.autodna = { ...emptyVendorAvotuBlock(), comments: "2 īpašnieku maiņas" };
    const syn = synthesizeOwnerCountsFromBlocks(blocks);
    expect(syn.noteLine).toBe("Latvijā: 2 | Zviedrijā: 6");
    expect(syn.totalCount).toBe(8);
    expect(syn.chosen.sweden?.count).toBe(6);
    expect(syn.chosen.other).toBeUndefined();
  });

  it("takes Danish owner count from DĀNIJAS REĢISTRI lease + private phases", () => {
    const blocks = createDefaultSourceBlocks();
    blocks.tjekbil = {
      ...emptyVinRegistryBlock(),
      ownersSummary:
        "Dānijas īpašnieku skaits: 2 (līzings + privāta reģistrācija Dānijā, ne pēc OCTA). DMR publiski neraāda īpašnieku sarakstu.\nPirmā reģistrācija: 18.12.2013 (ārpus Dānijas — nav Dānijas īpašnieks)",
    };
    const syn = synthesizeOwnerCountsFromBlocks(blocks);
    expect(syn.chosen.denmark?.count).toBe(2);
    expect(syn.noteLine).toMatch(/Dānijā: 2/);
    expect(syn.chosen.germany).toBeUndefined();
  });

  it("does not sum AutoDNA and CarVertical for the same unspecified market", () => {
    const blocks = createDefaultSourceBlocks();
    blocks.carvertical = { ...emptyVendorAvotuBlock(), comments: "3 īpašnieki" };
    blocks.autodna = { ...emptyVendorAvotuBlock(), comments: "2 īpašnieki" };
    const syn = synthesizeOwnerCountsFromBlocks(blocks);
    expect(syn.noteLine).toBe("ārvalstīs: 3");
    expect(syn.totalCount).toBe(3);
    expect(syn.noteLine).not.toMatch(/5/);
  });

  it("does not treat an unregistered Latvian listing as Latvian owners", () => {
    const blocks = createDefaultSourceBlocks();
    blocks.csdd.comments = "Dati nav pieejami.";
    blocks.csdd.ownerCountLatvia = "2";
    blocks.autodna = {
      ...emptyVendorAvotuBlock(),
      comments:
        "Datu sakritība ar CarVertical apstiprina incidentu regularitāti pirms importa Latvijā. 2 īpašnieki.",
    };
    blocks.carvertical = {
      ...emptyVendorAvotuBlock(),
      comments: "Automašīna vēl nav reģistrēta Latvijā. 5 īpašnieki Vācijā.",
    };
    const syn = synthesizeOwnerCountsFromBlocks(blocks);
    expect(syn.chosen.latvia).toBeUndefined();
    expect(syn.noteLine).not.toMatch(/Latvijā/);
    expect(syn.chosen.germany?.count).toBe(5);
  });

  it("does not treat CarVertical country-check lists as Swedish owners", () => {
    const blocks = createDefaultSourceBlocks();
    blocks.carinfo = {
      ...emptyVinRegistryBlock(),
      rawUnprocessedData: "Number of owners: 2\nSweden checked",
      aiContextRaw: "ZVIEDRIJAS REĢISTRI\n2 īpašnieki",
    };
    blocks.carvertical = {
      ...emptyVendorAvotuBlock(),
      comments:
        "Pārbaudītās valstis: Zviedrija, Vācija, Itālija. Pirms importa Latvijā. 2 īpašnieki",
      mileagePasteRaw: "Sweden\nNumber of owners: 2",
    };
    const syn = synthesizeOwnerCountsFromBlocks(blocks);
    expect(syn.chosen.sweden).toBeUndefined();
    expect(syn.chosen.latvia).toBeUndefined();
    expect(syn.noteLine).toBe("ārvalstīs: 2");
  });
});

describe("synthesizeOwnerCountsFromPdfInput", () => {
  it("builds the owner-count tile note from CSDD + ZVIEDRIJAS REĢISTRI", () => {
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
    expect(formatOwnerCountBannerNote(syn.chosen)).toBe("Latvijā: 2 | Zviedrijā: 6");
    expect(syn.totalCount).toBe(8);
    expect(formatOwnerCountCountryStats(syn.chosen)).toEqual([
      { iso: "LV", name: "Latvijā", count: 2 },
      { iso: "SE", name: "Zviedrijā", count: 6 },
    ]);
    expect(formatOwnerCountTileFacts(syn.chosen)).toEqual({
      value: "Latvijā 2",
      note: "Zviedrijā 6",
    });
  });

  it("does not print Latvijā when CSDD has no Latvian registration", () => {
    const syn = synthesizeOwnerCountsFromPdfInput({
      csddForm: { ...createDefaultSourceBlocks().csdd, comments: "Dati nav pieejami.", ownerCountLatvia: "2" },
      ccVinBlock: emptyCcVinBlock(),
      manualVendorBlocks: [
        {
          title: SOURCE_BLOCK_LABELS.autodna,
          mileageRows: [],
          incidentRows: [],
          comments: "Pirms importa Latvijā. 2 īpašnieki",
        },
      ],
    });
    expect(syn.chosen.latvia).toBeUndefined();
    expect(formatOwnerCountTileFacts(syn.chosen).value).not.toMatch(/Latvijā/);
  });

  it("does not print Zviedrijā from a vendor report that merely lists Sweden", () => {
    const syn = synthesizeOwnerCountsFromPdfInput({
      csddForm: { ...createDefaultSourceBlocks().csdd, comments: "Dati nav pieejami." },
      ccVinBlock: emptyCcVinBlock(),
      manualVendorBlocks: [
        {
          title: SOURCE_BLOCK_LABELS.carvertical,
          mileageRows: [],
          incidentRows: [],
          comments: "Pirms importa Latvijā. 2 īpašnieki",
          sourceRaw: "Countries checked: Sweden, Germany, Italy.\nNumber of owners: 2",
        },
      ],
    });
    expect(syn.chosen.sweden).toBeUndefined();
    expect(formatOwnerCountTileFacts(syn.chosen).value).toBe("ārvalstīs 2");
  });
});
