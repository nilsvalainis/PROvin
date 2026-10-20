import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { emptyIrissScanRecord, type IrissScanRecord } from "@/lib/iriss-scan-types";
import {
  applyOpenEndedEngineBounds,
  irissScanApifyPlatforms,
  irissScanMarketplaceOwnerId,
  MARKETPLACE_RADAR_EXTRA_RANGE_MESSAGE,
  marketplaceQueryFromScan,
  marketplaceRadarExtraRangeMissing,
  marketplaceRadarMissingFields,
  marketplaceRadarTooBroadSkipReason,
  marketplaceScanHasFetchBounds,
} from "@/lib/marketplace/query-from-scan";
import { marketplaceActorSearchInput, buildAutoscout24SearchUrl, buildMobileDeSearchUrl } from "@/lib/marketplace/search-urls";
import { emptyMarketplaceQuery } from "@/lib/marketplace/types";

function sprinterRadar(): IrissScanRecord {
  const raw = JSON.parse(
    readFileSync(path.join(process.cwd(), "lib/__fixtures__/iriss-scan/sprinter-h2l4.json"), "utf8"),
  ) as { record: Partial<IrissScanRecord> };
  return {
    ...emptyIrissScanRecord("11111111-1111-4111-8111-111111111111", "2026-10-20T00:00:00.000Z"),
    ...raw.record,
    vehicleCategory: "van",
    apifyMobiledeEnabled: true,
    apifyAutoscout24Enabled: true,
  };
}

describe("marketplaceQueryFromScan", () => {
  it("maps the Sprinter H2L4 radar to van filters, km-only ranges and AC", () => {
    const rec = sprinterRadar();
    const q = marketplaceQueryFromScan(rec);
    expect(q.make.toLowerCase()).toMatch(/mercedes/);
    expect(q.model.toLowerCase()).toContain("sprinter");
    expect(q.yearFrom).toBe(2020);
    expect(q.yearTo).toBe(2026);
    expect(q.fuel).toMatch(/diesel|dīzel/i);
    expect(q.gearbox).toMatch(/manual|manu/i);
    expect(q.powerFromKw).toBe(110);
    expect(q.powerToKw).toBeNull();
    expect(q.displacementFromCc).toBeNull();
    expect(q.displacementToCc).toBe(2000);
    expect(q.vehicleCategory).toBe("van");
    expect(q.features).toContain("air_conditioning");
    expect(q.mileageFrom).toBeNull();
    expect(q.mileageTo).toBeNull();
    expect(marketplaceScanHasFetchBounds(rec)).toBe(true);
    expect(marketplaceRadarMissingFields(rec)).toEqual([]);
    expect(marketplaceRadarExtraRangeMissing(rec)).toBe(false);
    expect(irissScanApifyPlatforms(rec)).toEqual(["mobilede", "autoscout24"]);
    expect(irissScanMarketplaceOwnerId(rec.id)).toBe(`scan:${rec.id}`);
  });

  it("builds mobile.de Van + AutoScout24 atype=X search params from the Sprinter radar", () => {
    const q = marketplaceQueryFromScan(sprinterRadar());
    const mobile = new URL(buildMobileDeSearchUrl(q, true));
    expect(mobile.searchParams.get("s")).toBe("Van");
    expect(mobile.searchParams.get("vc")).toBe("Van");
    expect(mobile.searchParams.get("ms")).toBe("17200");
    expect(mobile.searchParams.get("fr")).toMatch(/2020:2026|2020%3A2026/);
    expect(mobile.searchParams.get("ft")).toBe("DIESEL");
    expect(mobile.searchParams.get("tr")).toBe("MANUAL_GEAR");
    expect(mobile.searchParams.get("pw")).toBe("110:");
    expect(mobile.searchParams.get("cc")).toBe(":2000");
    expect(mobile.searchParams.get("fe")).toBe("AIR_CONDITIONING");
    expect(mobile.searchParams.get("ml")).toBeNull();
    expect(mobile.toString()).not.toMatch(/mile/i);
    const as24 = new URL(buildAutoscout24SearchUrl(q, true));
    expect(as24.searchParams.get("atype")).toBe("X");
    expect(as24.pathname).toBe("/lst/mercedes-benz/sprinter");
    expect(as24.searchParams.get("fregfrom")).toBe("2020");
    expect(as24.searchParams.get("fuel")).toBe("D");
    expect(as24.searchParams.get("gear")).toBe("M");
    expect(as24.searchParams.get("powerfrom")).toBe("110");
    expect(as24.searchParams.get("powertype")).toBe("kw");
    expect(as24.searchParams.get("ccto")).toBe("2000");
    expect(as24.searchParams.get("eq")).toBe("5");
    expect(as24.searchParams.has("kmfrom")).toBe(false);
    expect(as24.searchParams.has("milefrom")).toBe(false);
    const actor = marketplaceActorSearchInput("mobilede", q, { maxItems: 40 });
    expect(actor.category).toBe("VAN");
    expect(actor.make).toBe("Mercedes-Benz");
    expect(actor.model).toBe("Sprinter");
    expect(actor).not.toHaveProperty("bodyType");
    expect(actor.features).toEqual(["AIR_CONDITIONING"]);
  });

  it("does not wire Apify HTTP from the radar query helper", () => {
    const src = readFileSync(path.join(process.cwd(), "lib/marketplace/query-from-scan.ts"), "utf8");
    expect(src).not.toMatch(/apify-client|runMarketplaceApifyActor|api\.apify\.com/);
  });

  it("opens power-from and cc-to from Latvian engine text", () => {
    const q = emptyMarketplaceQuery();
    applyOpenEndedEngineBounds(q, "Dīzelis līdz 2.0 (1950 cm3), no 110 kW / 150 ZS");
    expect(q.powerFromKw).toBe(110);
    expect(q.powerToKw).toBeNull();
    expect(q.displacementToCc).toBe(2000);
    expect(q.displacementFromCc).toBeNull();
  });

  it("does not require price; power-from or cc-to or km-to is enough extra range", () => {
    const base = {
      ...emptyIrissScanRecord("11111111-1111-4111-8111-111111111111", "2026-10-20T00:00:00.000Z"),
      brandModel: "Mercedes-Benz Sprinter",
      productionYears: "2020-2026",
      vehicleCategory: "van" as const,
    };
    expect(marketplaceQueryFromScan(base).priceFrom).toBeNull();
    expect(marketplaceQueryFromScan(base).priceTo).toBeNull();
    expect(marketplaceScanHasFetchBounds(base)).toBe(false);
    expect(marketplaceRadarTooBroadSkipReason(base)).toContain(MARKETPLACE_RADAR_EXTRA_RANGE_MESSAGE);
    expect(MARKETPLACE_RADAR_EXTRA_RANGE_MESSAGE).toContain("(km)");
    expect(marketplaceScanHasFetchBounds({ ...base, engineType: "no 110 kW" })).toBe(true);
    expect(marketplaceRadarExtraRangeMissing({ ...base, engineType: "no 110 kW" })).toBe(false);
    expect(marketplaceScanHasFetchBounds({ ...base, engineType: "līdz 2.0" })).toBe(true);
    const kmRec = {
      ...base,
      listingLinkMobile: ["https://suchen.mobile.de/fahrzeuge/search.html?ml=%3A180000"],
    };
    expect(marketplaceScanHasFetchBounds(kmRec)).toBe(true);
    expect(marketplaceQueryFromScan(kmRec).mileageTo).toBe(180000);
    expect(marketplaceQueryFromScan(kmRec).mileageFrom).toBeNull();
  });

  it("infers van from Sprinter / furgons when Tips is automatic", () => {
    const rec = {
      ...emptyIrissScanRecord("11111111-1111-4111-8111-111111111111", "2026-10-20T00:00:00.000Z"),
      brandModel: "Mercedes-Benz Sprinter H2L4",
      productionYears: "2020-2026",
      engineType: "Dīzelis līdz 2.0, no 110 kW",
      bodyType: "Furgons H2L4",
      vehicleCategory: "" as const,
    };
    expect(marketplaceQueryFromScan(rec).vehicleCategory).toBe("van");
  });
});
