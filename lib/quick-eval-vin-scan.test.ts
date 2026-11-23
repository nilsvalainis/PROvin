import { afterEach, describe, expect, it, vi } from "vitest";

import { atraFreeGroups, atraFreeSourceIds } from "@/lib/atra-parbaude";
import { defaultVinScanSourceIds, VIN_SCAN_SOURCE_IDS, vinScanSourceDisabled } from "@/lib/vin-scan/catalog";
import {
  mergeQuickEvalVinScan,
  quickEvalNordicSearchLinks,
  quickEvalVinScanInput,
  quickEvalVinScanPlatesFromCsdd,
  quickEvalVinScanSourceIds,
} from "@/lib/quick-eval-vin-scan";
import type { VinScanIndicator } from "@/lib/vin-scan/types";

const VOLVO_SE = "YV1DZ5251B2146640";

function thecarapi(on: boolean) {
  vi.stubEnv("THECARAPI_API_KEY", on ? "test-key" : "");
  vi.stubEnv("THECARAPI_VIN_SCAN_ENABLED", on ? "true" : "");
}

/**
 * Vienīgie iemesli, kāpēc VIN SCAN kataloga avots drīkst NEBŪT ātrajos vērtējumos.
 * Tie paši ir arī VIN SCAN / «Ātrā pārbaude» noklusējumā. Jauns avots bez iemesla šeit -> tests krīt.
 */
function allowedExclusion(id: string, thecarapiOn: boolean): string | null {
  if (id === "joj_copart_iaai") return "maksas (~0,50 $), tikai ar ķeksi «Ātrajā pārbaudē»";
  if (id === "thecarapi_eu" && !thecarapiOn) return "TheCarApi karogs izslēgts";
  if (vinScanSourceDisabled(id)) return "avots izslēgts katalogā";
  return null;
}

describe("Ātrie vērtējumi = VIN SCAN avotu reģistrs", () => {
  afterEach(() => vi.unstubAllEnvs());

  for (const on of [false, true]) {
    const label = on ? "ieslēgts" : "izslēgts";

    it(`ātro vērtējumu avoti == VIN SCAN noklusējums (TheCarApi ${label})`, () => {
      thecarapi(on);
      expect(quickEvalVinScanSourceIds()).toEqual(defaultVinScanSourceIds());
    });

    it(`neviens VIN SCAN avots netrūkst bez iemesla (TheCarApi ${label})`, () => {
      thecarapi(on);
      const ids = new Set<string>(quickEvalVinScanSourceIds());
      const missing = VIN_SCAN_SOURCE_IDS.filter((id) => !ids.has(id) && !allowedExclusion(id, on));
      expect(missing).toEqual([]);
    });

    it(`sakrīt ar «Ātrās pārbaudes» bezmaksas avotiem (TheCarApi ${label})`, () => {
      thecarapi(on);
      const ids = [...quickEvalVinScanSourceIds()].sort();
      expect(ids).toEqual([...atraFreeSourceIds(on)].sort());
      const grouped = atraFreeGroups(on).flatMap((g) => g.items.map((i) => i.id));
      expect([...grouped].sort()).toEqual(ids);
    });
  }

  it("TheCarApi ieslēgts -> ir ātrajos vērtējumos; JoJ (maksas) nekad pēc noklusējuma", () => {
    thecarapi(true);
    expect(quickEvalVinScanSourceIds()).toContain("thecarapi_eu");
    expect(quickEvalVinScanSourceIds()).not.toContain("joj_copart_iaai");
    thecarapi(false);
    expect(quickEvalVinScanSourceIds()).not.toContain("thecarapi_eu");
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

function row(id: VinScanIndicator["id"], status: VinScanIndicator["status"], summary: string, scannedAt?: string): VinScanIndicator {
  return { id, label: id, country: "EU", status, summary, detail: "", openUrl: null, ...(scannedAt ? { scannedAt } : {}) };
}

describe("mergeQuickEvalVinScan: kopīgais VIN SCAN kešs ātrajā vērtējumā", () => {
  it("bez abiem - null", () => {
    expect(mergeQuickEvalVinScan(null, null)).toBeNull();
  });

  it("jaunāka kopīgā rinda (userscript imports vai JoJ no «Ātrās pārbaudes») aizstāj veco", () => {
    const own = {
      at: "2026-11-20T10:00:00.000Z",
      indicators: [row("vin_decode", "found", "WMI"), row("bid_cars", "browser_only", "Atver pārlūkā")],
    };
    const shared = {
      scannedAt: "2026-11-20T09:00:00.000Z",
      indicators: [
        row("vin_decode", "found", "vecs"),
        row("bid_cars", "found", "2 izsoles", "2026-11-21T08:00:00.000Z"),
        row("joj_copart_iaai", "found", "Copart 2019", "2026-11-21T08:05:00.000Z"),
      ],
    };
    const merged = mergeQuickEvalVinScan(own, shared)!;
    const byId = Object.fromEntries(merged.indicators.map((r) => [r.id, r.summary]));
    expect(byId.vin_decode).toBe("WMI");
    expect(byId.bid_cars).toBe("2 izsoles");
    expect(byId.joj_copart_iaai).toBe("Copart 2019");
    expect(merged.indicators[0]?.id).toBe("vin_decode");
    expect(merged.at).toBe("2026-11-20T10:00:00.000Z");
  });

  it("tikai kopīgais kešs (ātrais vērtējums vēl nav skenēts)", () => {
    const merged = mergeQuickEvalVinScan(null, { scannedAt: "2026-11-22T10:00:00.000Z", indicators: [row("rdw", "none", "Nav")] });
    expect(merged?.indicators.map((r) => r.id)).toEqual(["rdw"]);
    expect(merged?.at).toBe("2026-11-22T10:00:00.000Z");
  });
});
