import { describe, expect, it } from "vitest";

import { vinScanIndicatorsAreCacheable } from "@/lib/vin-scan/health";
import { vinScanSnapshotFresh, type VinScanSnapshot } from "@/lib/vin-scan/store";
import { VIN_SCAN_TTL_MS } from "@/lib/vin-scan/catalog";
import { emptyVinScanPlates } from "@/lib/vin-scan/plates";
import type { VinScanIndicator } from "@/lib/vin-scan/types";

function snap(partial: Partial<VinScanSnapshot>): VinScanSnapshot {
  return {
    vin: "YV1DZ5251B2146640",
    plates: emptyVinScanPlates(),
    scannedAt: new Date().toISOString(),
    indicators: [],
    ...partial,
  };
}

const decode = {
  id: "vin_decode",
  label: "WMI",
  country: "ISO",
  status: "found",
  summary: "2011 Volvo Zviedrija",
  detail: "WMI YV1",
  openUrl: "https://vpic.nhtsa.dot.gov/decoder/Decoder?VIN=YV1DZ5251B2146640",
} as VinScanIndicator;

describe("vinScanSnapshotFresh", () => {
  it("TTL un cacheable indikatori", () => {
    expect(vinScanSnapshotFresh(snap({ indicators: [decode] }))).toBe(true);
    expect(
      vinScanSnapshotFresh(
        snap({
          scannedAt: new Date(Date.now() - VIN_SCAN_TTL_MS - 1000).toISOString(),
          indicators: [decode],
        }),
      ),
    ).toBe(false);
    expect(
      vinScanSnapshotFresh(
        snap({
          indicators: [
            decode,
            { ...decode, id: "tjekbil", status: "unknown", summary: "Avots neatbildēja laikā" },
          ],
        }),
      ),
    ).toBe(false);
    expect(vinScanIndicatorsAreCacheable([decode])).toBe(true);
  });
});
