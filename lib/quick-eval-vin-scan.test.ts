import { describe, expect, it } from "vitest";

import { defaultVinScanSourceIds, VIN_SCAN_SOURCE_IDS, vinScanFastSourceIds, vinScanPipelineSourceIds } from "@/lib/vin-scan/catalog";
import { freeVinScanSourceIds } from "@/lib/vin-scan/free-sources";
import {
  quickEvalNordicSearchLinks,
  quickEvalVinScanInput,
  quickEvalVinScanPlatesFromCsdd,
  quickEvalVinScanSourceIds,
} from "@/lib/quick-eval-vin-scan";

const VOLVO_SE = "YV1DZ5251B2146640";

describe("Ātrie vērtējumi VIN SCAN cauruļvads", () => {
  it("lieto tikai bezmaksas VIN SCAN avotus (bez JoJ / Speckr)", () => {
    const ids = quickEvalVinScanSourceIds();
    expect(ids).toEqual(freeVinScanSourceIds());
    expect(ids).toEqual(vinScanPipelineSourceIds());
    expect(ids).toEqual(vinScanFastSourceIds());
    expect(ids).not.toContain("joj_copart_iaai");
    expect(ids).not.toContain("speckr");
    expect(defaultVinScanSourceIds()).not.toContain("joj_copart_iaai");
    expect(defaultVinScanSourceIds()).not.toContain("speckr");
    expect(ids[0]).toBe("vin_decode");
    expect(ids).toContain("biluppgifter");
    expect(ids).toContain("carinfo");
    expect(ids).toContain("listing_history");
    expect(ids).toContain("nhtsa_recalls");
    expect(ids).toContain("rdw");
    expect(ids.length).toBe(VIN_SCAN_SOURCE_IDS.length - 2);
  });

  it("nodod sludinājuma saiti un CSDD numuru VIN SCAN zondēm", () => {
    const input = quickEvalVinScanInput({
      vin: VOLVO_SE,
      listingUrl: "https://www.ss.lv/msg/lv/transport/cars/volvo/xc60/cgxhip.html",
      registrationNumber: "KWW569",
    });
    expect(input.sourceIds).toEqual(quickEvalVinScanSourceIds());
    expect(input.listingUrl).toContain("ss.lv");
    expect(input.plates.lv).toBe("KWW569");
  });

  it("Ziemeļvalstu VIN dod biluppgifter.se un car.info saites", () => {
    const links = quickEvalNordicSearchLinks(VOLVO_SE);
    expect(links.map((l) => l.id)).toEqual(["biluppgifter", "carinfo"]);
    expect(links[0]?.href).toContain("biluppgifter.se");
    expect(links[1]?.href).toContain("car.info");
    expect(quickEvalNordicSearchLinks("WBA5R1C0XLFH42873")).toEqual([]);
  });

  it("CSDD numurs paliek VIN SCAN plates.lv", () => {
    expect(quickEvalVinScanPlatesFromCsdd(" AB-1234 ").lv).toBe("AB1234");
    expect(quickEvalVinScanPlatesFromCsdd(null).lv).toBe("");
  });
});
