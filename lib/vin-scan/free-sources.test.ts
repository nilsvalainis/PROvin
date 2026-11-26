import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { VIN_SCAN_BROWSER_FETCH_IDS, browserFetchAwaiting, browserFetchSummary } from "@/lib/vin-scan/browser-fetch";
import { VIN_SCAN_REMOVED_IDS, VIN_SCAN_SOURCE_IDS, vinScanCatalogItem, vinScanSourceLinkOnly } from "@/lib/vin-scan/catalog";
import {
  freeVinScanSourceIds,
  isFreeVinScanSourceId,
  isMeteredVinScanSourceId,
  isPaidVinScanSourceId,
  isValuableVinScanSourceId,
  VIN_SCAN_PAID_SOURCE_IDS,
  vinScanAutoSourceIds,
} from "@/lib/vin-scan/free-sources";
import { emptyVinScanPlates } from "@/lib/vin-scan/plates";
import { vinScanProbeFor } from "@/lib/vin-scan/probes";

const VIN = "WBA5R1C0XLFH42873";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("free VIN SCAN avoti", () => {
  it("automātiskais saraksts ir kataloga avoti bez maksas pirkumiem un JoJ $0.50", () => {
    const free = freeVinScanSourceIds();
    expect(free).not.toContain("joj_copart_iaai");
    expect(free).not.toContain("thecarapi_eu");
    expect(free).not.toContain("speckr");
    expect(free).toEqual(
      VIN_SCAN_SOURCE_IDS.filter((id) => !isPaidVinScanSourceId(id) && id !== "vegvesen" && !vinScanSourceLinkOnly(id)),
    );
    expect(free).not.toContain("vegvesen");
    expect(isFreeVinScanSourceId("vegvesen")).toBe(true);
    // 26.11 audits: stat.vin, AucHistory, LT policija u.c. tikai kā saite, automātiski netiek prasīti.
    expect(free).not.toContain("stat_vin");
    expect(free).not.toContain("auchistory");
    expect(free).not.toContain("lt_itpr");
    expect(free).toContain("csdd");
    expect(isMeteredVinScanSourceId("joj_copart_iaai")).toBe(true);
    expect(isMeteredVinScanSourceId("thecarapi_eu")).toBe(true);
    expect(isFreeVinScanSourceId("thecarapi_eu")).toBe(false);
    expect(isMeteredVinScanSourceId("stat_vin")).toBe(false);
    for (const id of VIN_SCAN_PAID_SOURCE_IDS) {
      expect(free).not.toContain(id);
      expect(isPaidVinScanSourceId(id)).toBe(true);
    }
    for (const id of VIN_SCAN_REMOVED_IDS) {
      expect(free).not.toContain(id);
    }
  });

  it("stat.vin ir vērtīgais noklusējuma avots", () => {
    expect(isValuableVinScanSourceId("stat_vin")).toBe(true);
    expect(isValuableVinScanSourceId("carvertical")).toBe(false);
  });

  it("stat.vin un pārējos bloķētos avotus serveris nelasa: zonde uzreiz atdod from-browser joslu", async () => {
    /* Datucentra IP šajās lapās saņem 403, tāpēc servera pieprasījums būtu tikai lieks troksnis. */
    const fetchSpy = vi.fn(async () => {
      throw new Error("serveris nedrīkst lasīt from-browser avotu");
    });
    vi.stubGlobal("fetch", fetchSpy);
    for (const id of VIN_SCAN_BROWSER_FETCH_IDS) {
      // NICB ir tikai ASV datubāze: BMW (WBA) VIN to neprasa vispār (sk. nicb testu zemāk).
      const vin = id === "nicb" ? "1FTFW1ET5DFC10312" : VIN;
      const row = await vinScanProbeFor(id)!({ vin, plates: emptyVinScanPlates(), listingUrl: "" });
      expect(row, id).toMatchObject({
        id,
        status: "browser_only",
        summary: browserFetchSummary(id),
        openUrl: vinScanCatalogItem(id).openUrl(vin),
      });
      expect(browserFetchAwaiting(row), id).toBe(true);
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("NICB ne-ASV VIN neprasa (26.11): rinda «skipped», neskaitās un nedod viltus «zagts»", async () => {
    const fetchSpy = vi.fn(async () => {
      throw new Error("NICB nedrīkst prasīt");
    });
    vi.stubGlobal("fetch", fetchSpy);
    const row = await vinScanProbeFor("nicb")!({ vin: VIN, plates: emptyVinScanPlates(), listingUrl: "" });
    expect(row).toMatchObject({ id: "nicb", status: "skipped", summary: "NICB attiecas tikai uz ASV auto" });
    expect(browserFetchAwaiting(row)).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  /* "Automātiskās plūsmas palaiž tikai bezmaksas avotus" un "jau notiekošu skenējumu neatkārto" tagad
     ir uzvedības testi ar īstu runOrderFreeVinScan: lib/vin-scan/auto-flow-paid-sources.test.ts. */

  it("automātiskais scan neiekļauj maksas avotus (JoJ / paid sourceIds)", () => {
    const free = freeVinScanSourceIds();
    expect(vinScanAutoSourceIds({})).toEqual(free);
    expect(vinScanAutoSourceIds({ sourceIds: ["csdd"] })).toEqual(["csdd"]);
    expect(vinScanAutoSourceIds({ sourceIds: ["joj_copart_iaai"] })).toEqual(free);
    expect(vinScanAutoSourceIds({ sourceIds: ["thecarapi_eu"] })).toEqual(free);
    expect(vinScanAutoSourceIds({ sourceIds: ["speckr", "csdd"] })).toEqual(["csdd"]);
    expect(vinScanAutoSourceIds({ sourceIds: ["carvertical"] })).toEqual(free);
  });

  /* Melnraksta krātuves uzvedība (vinScan paliek blakus autoIngest, revīzija nemainās):
     lib/vin-scan/draft-vin-scan-persist.test.ts. Kartītes renderis: components/admin/AdminOrderVinScanCard.test.tsx. */
});
