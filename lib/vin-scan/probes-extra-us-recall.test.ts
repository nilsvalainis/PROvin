import { afterEach, describe, expect, it, vi } from "vitest";

const scanFetch = vi.fn();
const scanFetchSmart = vi.fn();

vi.mock("@/lib/vin-scan/http", () => ({
  scanFetch: (...args: unknown[]) => scanFetch(...args),
  scanFetchSmart: (...args: unknown[]) => scanFetchSmart(...args),
  scanCaptchaTokenPlaceholder: () => "",
  solveScanRecaptcha: async () => null,
}));

import { emptyVinScanPlates } from "@/lib/vin-scan/plates";
import { vwGroupRecallCheckUrl } from "@/lib/vin-scan/catalog";
import {
  ASV_MARKET_RECALL_LABEL,
  VW_GROUP_RECALL_BROWSER_LABEL,
  probeNhtsaRecalls,
  probeOemRecall,
} from "@/lib/vin-scan/probes-extra";

const EU_BMW = "WBA5R1C0XLFH42873";
const EU_VW = "WVWZZZ7NZEV015204";
const EU_SKODA = "TMBJH9NP9N7043581";
const US_HONDA = "1HGCM82633A004352";
const US_VW = "1VWBH7A32EC527891";

function ctx(vin: string) {
  return { vin, plates: emptyVinScanPlates(), listingUrl: "" };
}

describe("NHTSA / ASV OEM atsaukumi ne-ASV VIN", () => {
  afterEach(() => {
    scanFetch.mockReset();
    scanFetchSmart.mockReset();
  });

  it("ES WMI: NHTSA modeļa vaicājumu nepalaiž, rāda operatora saiti", async () => {
    const row = await probeNhtsaRecalls(ctx(EU_BMW));
    expect(scanFetch).not.toHaveBeenCalled();
    expect(row.status).toBe("browser_only");
    expect(row.summary).toBe(ASV_MARKET_RECALL_LABEL);
    expect(row.openUrl).toContain("nhtsa.gov/recalls");
    expect(row.openUrl).toContain(EU_BMW);
    expect(row.recalls ?? []).toEqual([]);
  });

  it("ES WMI BMW: ASV ražotāja lapu nerāda kā atsaukumu", async () => {
    const row = await probeOemRecall(ctx(EU_BMW), "bmw");
    expect(scanFetch).not.toHaveBeenCalled();
    expect(scanFetchSmart).not.toHaveBeenCalled();
    expect(row.status).toBe("browser_only");
    expect(row.summary).toBe(ASV_MARKET_RECALL_LABEL);
    expect(row.openUrl).toContain("bmwusa.com");
    expect(row.recalls ?? []).toEqual([]);
  });

  it("ES WMI VW: mirusī UK lapa netiek prasīta, ir GOV.UK operatora saite", async () => {
    const row = await probeOemRecall(ctx(EU_VW), "vw");
    expect(scanFetch).not.toHaveBeenCalled();
    expect(scanFetchSmart).not.toHaveBeenCalled();
    expect(row.status).toBe("browser_only");
    expect(row.summary).toBe(VW_GROUP_RECALL_BROWSER_LABEL);
    expect(row.status).not.toBe("found");
    expect(row.status).not.toBe("none");
    expect(row.openUrl).toBe(vwGroupRecallCheckUrl(EU_VW));
    expect(row.openUrl).toContain("https://www.gov.uk/check-vehicle-recall?vin=");
    expect(row.openUrl).toContain(EU_VW);
    expect(row.openUrl).not.toContain("volkswagen.co.uk");
    expect(row.recalls ?? []).toEqual([]);
  });

  it("ES Škoda: tas pats GOV.UK ceļš, bez found un bez none", async () => {
    const row = await probeOemRecall(ctx(EU_SKODA), "vw");
    expect(scanFetch).not.toHaveBeenCalled();
    expect(scanFetchSmart).not.toHaveBeenCalled();
    expect(row.status).toBe("browser_only");
    expect(row.summary).toBe(VW_GROUP_RECALL_BROWSER_LABEL);
    expect(row.openUrl).toBe(vwGroupRecallCheckUrl(EU_SKODA));
    expect(row.recalls ?? []).toEqual([]);
  });

  it("ASV WMI VW: NHTSA paliek, GOV.UK HTML netiek lasīts kā atsaukums", async () => {
    scanFetch.mockImplementation(async (url: string) => {
      if (url.includes("DecodeVinValues")) {
        return {
          status: 200,
          text: JSON.stringify({
            Results: [{ Make: "VOLKSWAGEN", Model: "JETTA", ModelYear: "2014" }],
          }),
        };
      }
      if (url.includes("recallsByVehicle")) {
        return { status: 200, text: JSON.stringify({ results: [] }) };
      }
      throw new Error(`unexpected fetch ${url}`);
    });
    const row = await probeOemRecall(ctx(US_VW), "vw");
    expect(scanFetchSmart).not.toHaveBeenCalled();
    expect(row.status).toBe("none");
    expect(row.summary).toContain("NHTSA atsaukumu nav");
    expect(row.summary).not.toBe(VW_GROUP_RECALL_BROWSER_LABEL);
  });

  it("ASV WMI: NHTSA modeļa vaicājums paliek", async () => {
    scanFetch.mockImplementation(async (url: string) => {
      if (url.includes("DecodeVinValues")) {
        return {
          status: 200,
          text: JSON.stringify({
            Results: [{ Make: "HONDA", Model: "ACCORD", ModelYear: "2003" }],
          }),
        };
      }
      if (url.includes("recallsByVehicle")) {
        return { status: 200, text: JSON.stringify({ results: [] }) };
      }
      throw new Error(`unexpected fetch ${url}`);
    });
    const row = await probeNhtsaRecalls(ctx(US_HONDA));
    expect(scanFetch).toHaveBeenCalled();
    expect(scanFetch.mock.calls.some((call) => String(call[0]).includes("recallsByVehicle"))).toBe(true);
    expect(row.status).toBe("none");
    expect(row.summary).not.toBe(ASV_MARKET_RECALL_LABEL);
  });
});
