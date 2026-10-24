import { describe, expect, it } from "vitest";
import {
  irissAuctionListingFieldMap,
  isIrissAuctionListingPlatform,
  offerAprakstiSeedFromAuctionListing,
  type IrissAuctionListingFieldMap,
} from "@/lib/iriss-auction-listing-field-map";

describe("IRISS auction listing field map (j41 F1 - extensible structure)", () => {
  it("knows the three platforms the IRISS agent will send field maps for", () => {
    expect(isIrissAuctionListingPlatform("auto1")).toBe(true);
    expect(isIrissAuctionListingPlatform("openlane")).toBe(true);
    expect(isIrissAuctionListingPlatform("autobid")).toBe(true);
    expect(isIrissAuctionListingPlatform("ebay")).toBe(false);
    expect(irissAuctionListingFieldMap("ebay")).toBeNull();
  });

  it("stub platform maps return nothing yet - safe no-op until the agent sends real field names", async () => {
    const map = irissAuctionListingFieldMap("auto1")!;
    const out = await offerAprakstiSeedFromAuctionListing(map, { anything: "x" }, async (t) => t);
    expect(out).toEqual({});
  });

  it("applies structured fields directly and translates free text through the injected translator", async () => {
    const fakeMap: IrissAuctionListingFieldMap = {
      platform: "auto1",
      structured: (raw) => ({
        originCountry: String(raw.country ?? ""),
        keyCount: String(raw.keys ?? ""),
        equipmentHighlights: String(raw.equipment ?? ""),
      }),
      freeText: (raw) => ({
        damageText: String(raw.damageDe ?? ""),
        conditionText: String(raw.conditionDe ?? ""),
      }),
    };
    const translated = new Map([
      ["Unfallschaden hinten", "Bojājums aizmugurē"],
      ["Guter Zustand", "Labs stāvoklis"],
    ]);
    const out = await offerAprakstiSeedFromAuctionListing(
      fakeMap,
      { country: "DE", keys: "2", equipment: "Navi, LED", damageDe: "Unfallschaden hinten", conditionDe: "Guter Zustand" },
      async (raw) => translated.get(raw) ?? raw,
    );
    expect(out).toEqual({
      originCountry: "DE",
      keyCount: "2",
      equipmentHighlights: "Navi, LED",
      technicalAssessment: "Bojājums aizmugurē",
      visualAssessment: "Labs stāvoklis",
    });
  });

  it("skips empty free-text fields instead of calling the translator with nothing", async () => {
    let calls = 0;
    const fakeMap: IrissAuctionListingFieldMap = {
      platform: "openlane",
      structured: () => ({ originCountry: "NL" }),
      freeText: () => ({ damageText: "", conditionText: "" }),
    };
    const out = await offerAprakstiSeedFromAuctionListing(fakeMap, {}, async (t) => {
      calls += 1;
      return t;
    });
    expect(calls).toBe(0);
    expect(out).toEqual({ originCountry: "NL" });
  });
});
