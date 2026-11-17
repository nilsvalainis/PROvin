import { describe, expect, it } from "vitest";
import {
  irissAuctionListingFieldMap,
  isIrissAuctionListingPlatform,
  offerAprakstiSeedFromAuctionListing,
  type IrissAuctionListingFieldMap,
} from "@/lib/iriss-auction-listing-field-map";

describe("IRISS auction listing field map (j41 F1 karkass, j41b - AUTO1/OPENLANE sarakstā jau esošie lauki)", () => {
  it("knows the platforms, using the same 'openline' code as iriss-listings-types.ts", () => {
    expect(isIrissAuctionListingPlatform("auto1")).toBe(true);
    expect(isIrissAuctionListingPlatform("openline")).toBe(true);
    expect(isIrissAuctionListingPlatform("autobid")).toBe(true);
    expect(isIrissAuctionListingPlatform("openlane")).toBe(false);
    expect(isIrissAuctionListingPlatform("ebay")).toBe(false);
    expect(irissAuctionListingFieldMap("ebay")).toBeNull();
  });

  it("AUTO1/OPENLINE read what the listing sync already stores (sourceCountry/countryCode, damageRaw)", async () => {
    const auto1 = irissAuctionListingFieldMap("auto1")!;
    const out = await offerAprakstiSeedFromAuctionListing(
      auto1,
      { sourceCountry: "DE", countryCode: "LV", damageRaw: "Rear bumper scratched" },
      async (raw) => `LV:${raw}`,
    );
    expect(out).toEqual({ originCountry: "DE", damageGrade: "LV:Rear bumper scratched", visualAssessment: "LV:Rear bumper scratched" });
  });

  it("falls back to countryCode when sourceCountry is missing (Openlane)", async () => {
    const openline = irissAuctionListingFieldMap("openline")!;
    const out = await offerAprakstiSeedFromAuctionListing(openline, { countryCode: "NL" }, async (t) => t);
    expect(out).toEqual({ originCountry: "NL" });
  });

  it("AUTOBID map is still a stub - safe no-op until the agent sends real field names", async () => {
    const map = irissAuctionListingFieldMap("autobid")!;
    const out = await offerAprakstiSeedFromAuctionListing(map, { damageRaw: "ignored", sourceCountry: "DE" }, async (t) => t);
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
        visualDamageText: String(raw.damageDe ?? ""),
        technicalIssueText: String(raw.conditionDe ?? ""),
      }),
    };
    const translated = new Map([
      ["Unfallschaden hinten", "Bojājums aizmugurē"],
      ["Kontrolllampe an", "Deg kontrollampa"],
    ]);
    const out = await offerAprakstiSeedFromAuctionListing(
      fakeMap,
      { country: "DE", keys: "2", equipment: "Navi, LED", damageDe: "Unfallschaden hinten", conditionDe: "Kontrolllampe an" },
      async (raw) => translated.get(raw) ?? raw,
    );
    expect(out).toEqual({
      originCountry: "DE",
      keyCount: "2",
      equipmentHighlights: "Navi, LED",
      damageGrade: "Bojājums aizmugurē",
      visualAssessment: "Bojājums aizmugurē",
      technicalAssessment: "Deg kontrollampa",
    });
  });

  it("skips empty free-text fields instead of calling the translator with nothing", async () => {
    let calls = 0;
    const fakeMap: IrissAuctionListingFieldMap = {
      platform: "openline",
      structured: () => ({ originCountry: "NL" }),
      freeText: () => ({ visualDamageText: "", technicalIssueText: "" }),
    };
    const out = await offerAprakstiSeedFromAuctionListing(fakeMap, {}, async (t) => {
      calls += 1;
      return t;
    });
    expect(calls).toBe(0);
    expect(out).toEqual({ originCountry: "NL" });
  });
});
