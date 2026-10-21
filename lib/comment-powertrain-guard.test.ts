import { describe, expect, it } from "vitest";
import { createDefaultSourceBlocks, emptyCsddFields, mergeSourceBlocksWithDefaults } from "@/lib/admin-source-blocks";
import { emptyOutvinDealerReport } from "@/lib/outvin-dealer-types";
import {
  classifyFuelKind,
  commentContradictsPowertrain,
  commentsNeedPowertrainRegenerate,
  extractLoadedPowertrainIdentity,
  findPowertrainContradictions,
  generatedAgainstIsStale,
  powertrainIdentityKey,
} from "@/lib/comment-powertrain-guard";

const AUDI_VIN = "WAUZZZF59KA075097";

function audiLookupBlocks() {
  const blocks = mergeSourceBlocksWithDefaults({
    csdd: { ...emptyCsddFields(), makeModel: "Audi A5", fuelType: "Dīzeļdegviela" },
    auto_records: {
      ...createDefaultSourceBlocks().auto_records,
      outvinReport: {
        ...emptyOutvinDealerReport(),
        vehicleInfo: {
          ...emptyOutvinDealerReport().vehicleInfo,
          engineCode: "DLVB",
          fuel: "Petrol",
          model: "A5 35 TFSI",
        },
      },
      oneautoIngest: {
        vinOverride: "",
        lastFetchedVin: AUDI_VIN,
        fetchedAt: "2026-10-21T00:00:00.000Z",
        selectedProducts: ["oe_vin_lookup"],
        lastCostEur: "0.36",
        results: { oe_vin_lookup: { ok: true, payload: { engine: "DLVB", fuel: "Petrol" } } },
      },
    },
  });
  return blocks;
}

describe("comment powertrain guard", () => {
  it("klasificē benzīnu un dīzeli", () => {
    expect(classifyFuelKind("Benzin")).toBe("petrol");
    expect(classifyFuelKind("Petrol")).toBe("petrol");
    expect(classifyFuelKind("Dīzeļdegviela")).toBe("diesel");
  });

  it("OE VIN Lookup ir avots pret CSDD dīzeli (Audi A5 35 TFSI / DLVB)", () => {
    const identity = extractLoadedPowertrainIdentity(audiLookupBlocks(), { vin: AUDI_VIN });
    expect(identity.engineCode).toBe("DLVB");
    expect(identity.fuelKind).toBe("petrol");
    expect(identity.source).toBe("oe_vin_lookup");
    expect(powertrainIdentityKey(identity)).toBe("DLVB|petrol");
  });

  it("ķer dīzeļa komentāru pret benzīna laukiem", () => {
    const identity = extractLoadedPowertrainIdentity(audiLookupBlocks(), { vin: AUDI_VIN });
    const diesel = "Šis dīzelis ar DPF ir tipisks TDI.";
    expect(commentContradictsPowertrain(diesel, identity)).toBe(true);
    expect(findPowertrainContradictions(diesel, identity).some((h) => h.id === "powertrain_fuel")).toBe(
      true,
    );
    expect(commentContradictsPowertrain("35 TFSI benzīna motors DLVB bez DPF.", identity)).toBe(false);
  });

  it("atzīmē novecojušu komentāru, kad degviela mainās", () => {
    const blocks = audiLookupBlocks();
    expect(
      commentsNeedPowertrainRegenerate({
        sourceBlocks: blocks,
        commentTexts: ["Šis dīzelis ir kārtībā."],
        vin: AUDI_VIN,
      }),
    ).toBe(true);
    expect(
      generatedAgainstIsStale({ engineCode: "", fuelKind: "diesel" }, extractLoadedPowertrainIdentity(blocks)),
    ).toBe(true);
    expect(
      commentsNeedPowertrainRegenerate({
        sourceBlocks: blocks,
        commentTexts: [""],
        vin: AUDI_VIN,
      }),
    ).toBe(false);
  });
});
