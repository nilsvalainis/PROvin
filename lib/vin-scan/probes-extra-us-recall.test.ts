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
import { ASV_MARKET_RECALL_LABEL, probeNhtsaRecalls, probeOemRecall } from "@/lib/vin-scan/probes-extra";

const EU_BMW = "WBA5R1C0XLFH42873";
const EU_VW = "WVWZZZ7NZEV015204";
const US_HONDA = "1HGCM82633A004352";

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

  it("ES WMI VW: NHTSA nav, UK lapa paliek (nav ASV ražotājs)", async () => {
    scanFetchSmart.mockResolvedValue({ status: 200, text: "<html>no recall</html>" });
    const row = await probeOemRecall(ctx(EU_VW), "vw");
    expect(scanFetch).not.toHaveBeenCalled();
    expect(scanFetchSmart).toHaveBeenCalledTimes(1);
    expect(String(scanFetchSmart.mock.calls[0]?.[0])).toContain("volkswagen.co.uk");
    expect(row.summary).not.toBe(ASV_MARKET_RECALL_LABEL);
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
