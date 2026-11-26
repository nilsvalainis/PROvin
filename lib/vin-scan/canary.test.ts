import { describe, expect, it } from "vitest";

import { VIN_SCAN_BROWSER_FETCH_IDS } from "@/lib/vin-scan/browser-fetch";
import { isVinScanSourceId } from "@/lib/vin-scan/catalog";
import {
  VIN_SCAN_CANARY_BATCHES,
  VIN_SCAN_CANARY_BUDGET_MS,
  VIN_SCAN_CANARY_CONCURRENCY,
  vinScanCanarySourceIds,
} from "@/lib/vin-scan/canary";
import { isPaidVinScanSourceId } from "@/lib/vin-scan/free-sources";
import { vinScanSourceTimeoutMs } from "@/lib/vin-scan/source-timeouts";

describe("VIN SCAN ikdienas uzraudzība: zelta VIN", () => {
  it("katrs avots tiek pārbaudīts tieši vienreiz, ar derīgu VIN", () => {
    const ids = vinScanCanarySourceIds();
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(isVinScanSourceId(id)).toBe(true);
    for (const b of VIN_SCAN_CANARY_BATCHES) expect(b.vin).toMatch(/^[A-HJ-NPR-Z0-9]{17}$/);
  });

  it("Nila 23.11 zelta VIN un avoti", () => {
    const byVin = new Map(VIN_SCAN_CANARY_BATCHES.map((b) => [b.vin, b.checks.map((c) => `${c.id}:${c.expect}`)]));
    expect(byVin.get("U5YH6G17GNL050102")).toEqual(expect.arrayContaining(["mnt_ee:found", "lkf_ee:found"]));
    expect(byVin.get("WDD2120251A120979")).toEqual(
      expect.arrayContaining(["tjekbil:found", "esyn:found", "nummerplade:found", "carinfo:found"]),
    );
    expect(byVin.has("WBA7J21040G829261")).toBe(true);
    expect(byVin.get("WAUZZZF43PA018831")).toEqual(["thecarapi_eu:found"]);
  });

  it("nesauc maksas pirkuma avotus (izņemot TheCarApi abonementu) un pārlūka avotus", () => {
    for (const id of vinScanCanarySourceIds()) {
      if (id !== "thecarapi_eu") expect(isPaidVinScanSourceId(id)).toBe(false);
      expect((VIN_SCAN_BROWSER_FETCH_IDS as readonly string[]).includes(id)).toBe(false);
    }
    for (const id of ["joj_copart_iaai", "carvertical", "autodna", "speckr", "oneauto", "stat_vin", "bid_cars"]) {
      expect(vinScanCanarySourceIds()).not.toContain(id);
    }
  });

  it("partijas iekļaujas cron laika budžetā (2 vienlaikus)", () => {
    const need = VIN_SCAN_CANARY_BATCHES.map((b) => Math.max(...b.checks.map((c) => vinScanSourceTimeoutMs(c.id))) + 10_000);
    // Sliktākais gadījums: partijas pa pāriem, katrs pāris tik ilgs, cik garākā partija.
    let total = 0;
    for (let i = 0; i < need.length; i += VIN_SCAN_CANARY_CONCURRENCY) total += Math.max(...need.slice(i, i + VIN_SCAN_CANARY_CONCURRENCY));
    expect(total).toBeLessThanOrEqual(VIN_SCAN_CANARY_BUDGET_MS);
  });
});
