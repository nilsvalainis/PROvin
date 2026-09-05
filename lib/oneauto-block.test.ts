import { describe, expect, it } from "vitest";
import { oneautoTrafficLevel } from "@/lib/admin-block-traffic-status";
import { mergeSourceBlocksWithDefaults } from "@/lib/admin-source-blocks";
import { emptyOneautoBlock, parseOneautoBlockRaw } from "@/lib/oneauto-block";

describe("OneAuto avota bloks", () => {
  it("hidratē saglabāto JSON ar source: oneautoapi", () => {
    const parsed = parseOneautoBlockRaw({
      vinOverride: "WAUZZZGE0KB015525",
      lastFetchedVin: "WAUZZZGE0KB015525",
      fetchedAt: "2026-09-05T12:00:00.000Z",
      selectedProducts: ["oe_build_sheet", "oe_service_history"],
      lastCostEur: "€4.95",
      source: "oneautoapi",
      display: {
        equipment: [{ label: "Panoramic roof", value: "PR3L" }],
        serviceTimeline: [
          { date: "2019-10-21", odometer: "69343", place: "Premier", works: "Oil" },
        ],
        powertrain: [{ label: "engine", value: "2.0 TDI" }],
      },
    });
    expect(parsed.source).toBe("oneautoapi");
    expect(parsed.lastFetchedVin).toBe("WAUZZZGE0KB015525");
    expect(parsed.display.equipment[0]?.value).toBe("PR3L");
    expect(oneautoTrafficLevel(parsed)).toBe("complete");
  });

  it("tukšs bloks paliek sarkanā luksoforā", () => {
    expect(oneautoTrafficLevel(emptyOneautoBlock())).toBe("empty");
  });

  it("pēc noklusējuma ieķeksē tikai OE Service History", () => {
    expect(emptyOneautoBlock().selectedProducts).toEqual(["oe_service_history"]);
  });

  it("merge saglabā oneauto laukus no darba zonas", () => {
    const merged = mergeSourceBlocksWithDefaults({
      oneauto: {
        lastFetchedVin: "WAUZZZGE0KB015525",
        fetchedAt: "2026-09-05T12:00:00.000Z",
        source: "oneautoapi",
        display: {
          equipment: [],
          serviceTimeline: [],
          powertrain: [{ label: "engine", value: "2.0 TDI" }],
        },
      },
    });
    expect(merged.oneauto.lastFetchedVin).toBe("WAUZZZGE0KB015525");
    expect(merged.oneauto.source).toBe("oneautoapi");
    expect(oneautoTrafficLevel(merged.oneauto)).toBe("complete");
  });
});
