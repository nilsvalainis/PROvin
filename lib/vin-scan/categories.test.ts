import { describe, expect, it } from "vitest";

import {
  groupVinScanByCategory,
  VIN_SCAN_CATALOG,
  VIN_SCAN_CATEGORIES,
  vinScanCategoryLabel,
  vinScanSourceCategory,
} from "@/lib/vin-scan/catalog";

describe("VIN SCAN avotu kategorijas", () => {
  it("Nila secība: Reģistri → Vēsture → Izsoles → Apdrošināšana → Zādzība → Ražotājs → Atsaukumi", () => {
    expect(VIN_SCAN_CATEGORIES.map((c) => c.label)).toEqual([
      "Reģistri",
      "Vēsture",
      "Izsoles",
      "Apdrošināšana",
      "Zādzība",
      "Ražotājs",
      "Atsaukumi",
    ]);
  });

  it("katram kataloga avotam ir derīga kategorija", () => {
    const ids = new Set<string>(VIN_SCAN_CATEGORIES.map((c) => c.id));
    for (const item of VIN_SCAN_CATALOG) {
      expect(ids.has(item.category), item.id).toBe(true);
    }
  });

  it("piemēri pa grupām", () => {
    expect(vinScanSourceCategory("csdd")).toBe("registri");
    expect(vinScanSourceCategory("esyn")).toBe("vesture");
    expect(vinScanSourceCategory("bidfax")).toBe("izsoles");
    expect(vinScanSourceCategory("lkf_ee")).toBe("apdrosinasana");
    expect(vinScanSourceCategory("nicb")).toBe("zadziba");
    expect(vinScanSourceCategory("vin_decode")).toBe("razotajs");
    expect(vinScanSourceCategory("recall_bmw")).toBe("atsaukumi");
    expect(vinScanSourceCategory("auchistory")).toBeNull();
    expect(vinScanCategoryLabel("apdrosinasana")).toBe("Apdrošināšana");
  });

  it("grupē rindas kategoriju secībā, iekšā saglabā ievades secību, izņemtos id izlaiž", () => {
    const rows = [
      { id: "recall_vw" },
      { id: "bidfax" },
      { id: "csdd" },
      { id: "lt_itpr" },
      { id: "stat_vin" },
      { id: "mnt_ee" },
    ];
    const groups = groupVinScanByCategory(rows);
    expect(groups.map((g) => g.category)).toEqual(["registri", "izsoles", "atsaukumi"]);
    expect(groups[0]?.items.map((r) => r.id)).toEqual(["csdd", "mnt_ee"]);
    expect(groups[1]?.items.map((r) => r.id)).toEqual(["bidfax", "stat_vin"]);
    expect(groups[0]?.label).toBe("Reģistri");
  });
});
