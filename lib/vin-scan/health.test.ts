import { describe, expect, it } from "vitest";

import {
  VIN_SCAN_HEALTH_VINS,
  buildVinScanHealthMatrix,
  classifyVinScanHealth,
  vinScanIndicatorsAreCacheable,
} from "@/lib/vin-scan/health";
import { decodeVinLocal } from "@/lib/vin-scan/vin-decode";

describe("VIN SCAN health", () => {
  it("ir vismaz 10 dažādu marku/valstu VIN plus ziņotais Volvo", () => {
    expect(VIN_SCAN_HEALTH_VINS.length).toBeGreaterThanOrEqual(10);
    expect(VIN_SCAN_HEALTH_VINS.some((row) => row.vin === "YV1DZ5251B2146640")).toBe(true);
    const makes = new Set(VIN_SCAN_HEALTH_VINS.map((row) => row.make));
    expect(makes.size).toBeGreaterThanOrEqual(6);
  });

  it("katrs testa VIN lokāli dekodējas", () => {
    for (const row of VIN_SCAN_HEALTH_VINS) {
      const d = decodeVinLocal(row.vin);
      expect(d.ok, row.vin).toBe(true);
      expect(d.make.toLowerCase()).toContain(row.make.slice(0, 3).toLowerCase());
    }
  });

  it("found / none / unknown → ok / empty / error", () => {
    expect(classifyVinScanHealth("found", "Volvo")).toEqual({ cell: "ok", reason: "Volvo" });
    expect(classifyVinScanHealth("none", "VIN nav Dānijas reģistrā")).toEqual({
      cell: "empty",
      reason: "VIN nav Dānijas reģistrā",
    });
    expect(classifyVinScanHealth("unknown", "Avots neatbildēja laikā")).toEqual({
      cell: "error",
      reason: "Avots neatbildēja laikā",
    });
    expect(classifyVinScanHealth("skipped", "Nav CAPSOLVER_API_KEY")).toEqual({
      cell: "error",
      reason: "Nav CAPSOLVER_API_KEY",
    });
  });

  it("matrica source × VIN", () => {
    const matrix = buildVinScanHealthMatrix([
      { vin: "YV1DZ5251B2146640", sourceId: "vin_decode", status: "found", summary: "2011 Volvo Zviedrija" },
      { vin: "YV1DZ5251B2146640", sourceId: "tjekbil", status: "none", summary: "VIN nav Dānijas reģistrā" },
      { vin: "YV1DZ5251B2146640", sourceId: "carinfo", status: "unknown", summary: "car.info Cloudflare" },
    ]);
    expect(matrix.vin_decode?.["YV1DZ5251B2146640"]?.cell).toBe("ok");
    expect(matrix.tjekbil?.["YV1DZ5251B2146640"]?.cell).toBe("empty");
    expect(matrix.carinfo?.["YV1DZ5251B2146640"]?.cell).toBe("error");
  });

  it("kešs: tukšs / tikai unknown bez dekodējuma nav cacheable", () => {
    expect(vinScanIndicatorsAreCacheable([])).toBe(false);
    expect(
      vinScanIndicatorsAreCacheable([
        { id: "tjekbil", status: "unknown", summary: "Avots neatbildēja laikā" },
        { id: "csdd", status: "unknown", summary: "Avotu neizdevās nolasīt" },
      ]),
    ).toBe(false);
    expect(
      vinScanIndicatorsAreCacheable([
        { id: "vin_decode", status: "found", summary: "Volvo" },
        { id: "tjekbil", status: "unknown", summary: "Avots neatbildēja laikā" },
        { id: "csdd", status: "unknown", summary: "Avotu neizdevās nolasīt" },
      ]),
    ).toBe(false);
    expect(
      vinScanIndicatorsAreCacheable([
        { id: "vin_decode", status: "found", summary: "Volvo" },
        { id: "tjekbil", status: "none", summary: "VIN nav Dānijas reģistrā" },
        { id: "csdd", status: "none", summary: "CSDD reģistrā šāds numurs netika atrasts" },
      ]),
    ).toBe(true);
    expect(vinScanIndicatorsAreCacheable([{ id: "vin_decode", status: "found", summary: "Volvo" }])).toBe(true);
  });
});
