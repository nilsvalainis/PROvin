import { describe, expect, it } from "vitest";

import { VIN_SCAN_CANARY_SOURCE_IDS, VIN_SCAN_CANARY_VINS, vinScanCanarySourceIds } from "@/lib/vin-scan/canary";
import { isPaidVinScanSourceId } from "@/lib/vin-scan/free-sources";

describe("VIN SCAN kanārijputns", () => {
  it("2-4 zināmi VIN, viens ar stat.vin ierakstu, tikai bezmaksas avoti", () => {
    expect(VIN_SCAN_CANARY_VINS.length).toBeGreaterThanOrEqual(2);
    expect(VIN_SCAN_CANARY_VINS.length).toBeLessThanOrEqual(4);
    expect(VIN_SCAN_CANARY_VINS.filter((row) => row.statVinRecord)).toHaveLength(1);
    expect(VIN_SCAN_CANARY_VINS.some((row) => row.vin === "WBA5R1C0XLFH42873")).toBe(true);
    expect(vinScanCanarySourceIds()).toEqual([...VIN_SCAN_CANARY_SOURCE_IDS]);
    expect(vinScanCanarySourceIds()).toContain("stat_vin");
    expect(vinScanCanarySourceIds()).toContain("vin_decode");
    for (const id of vinScanCanarySourceIds()) {
      expect(isPaidVinScanSourceId(id)).toBe(false);
    }
    expect(vinScanCanarySourceIds()).not.toContain("autodna");
    expect(vinScanCanarySourceIds()).not.toContain("joj_copart_iaai");
    expect(vinScanCanarySourceIds()).not.toContain("carvertical");
    // Fixie / CAPTCHA avotus kanārijputns nesauc: tos uztver avotu veselības sērijas.
    for (const id of ["mnt_ee", "lkf_ee", "nummerplade", "carpass", "auchistory", "carinfo"]) {
      expect(vinScanCanarySourceIds()).not.toContain(id);
    }
  });

  it("katram expectFound avotam ir vieta kanārijputna sarakstā", () => {
    for (const row of VIN_SCAN_CANARY_VINS) {
      for (const id of row.expectFound ?? []) expect(vinScanCanarySourceIds()).toContain(id);
    }
    expect(VIN_SCAN_CANARY_VINS.some((row) => row.expectFound?.includes("tjekbil"))).toBe(true);
  });
});
