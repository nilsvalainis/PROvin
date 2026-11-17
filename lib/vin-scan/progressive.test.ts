import { describe, expect, it } from "vitest";

import { defaultVinScanSourceIds } from "@/lib/vin-scan/catalog";
import { vinScanScanPhases, VIN_SCAN_FAST_SOURCE_MAX_MS } from "@/lib/vin-scan/progressive";
import { vinScanSourceTimeoutMs } from "@/lib/vin-scan/source-timeouts";

describe("VIN SCAN rezultāti pa daļām", () => {
  it("katrs noklusējuma avots ir tieši vienā daļā", () => {
    const all = defaultVinScanSourceIds();
    const { fast, slow } = vinScanScanPhases(all);
    expect([...fast, ...slow].sort()).toEqual([...all].sort());
    expect(fast.filter((id) => slow.includes(id))).toEqual([]);
  });

  it("ātrajā daļā ir tikai avoti ar īsu taimautu, tostarp WMI un Dānija", () => {
    const { fast, slow } = vinScanScanPhases();
    for (const id of fast) expect(vinScanSourceTimeoutMs(id)).toBeLessThanOrEqual(VIN_SCAN_FAST_SOURCE_MAX_MS);
    for (const id of slow) expect(vinScanSourceTimeoutMs(id)).toBeGreaterThan(VIN_SCAN_FAST_SOURCE_MAX_MS);
    expect(fast).toEqual(expect.arrayContaining(["vin_decode", "tjekbil", "esyn"]));
    expect(slow).toEqual(expect.arrayContaining(["mnt_ee", "lkf_ee"]));
  });

  it("tukšs saraksts dod tukšas daļas", () => {
    expect(vinScanScanPhases([])).toEqual({ fast: [], slow: [] });
  });
});
