import { beforeEach, describe, expect, it, vi } from "vitest";

const probeCalls: string[] = [];
let safetyGateHint: unknown = "nav izsaukts";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/source-health-store", () => ({
  readSourceHealth: async () => ({ sources: {} }),
  recordSourceOutcomes: async () => undefined,
}));

vi.mock("@/lib/vin-scan/listings-page-relay", () => ({
  withVinScanRelayDedupe: <T>(fn: () => Promise<T>) => fn(),
}));

vi.mock("@/lib/vin-scan/probes", async () => {
  const { buildVinScanIndicator } = await import("@/lib/vin-scan/types");
  return {
    sourceNeedsInput: () => null,
    vinScanProbeFor:
      (id: string) =>
      async (ctx: { vin: string; vehicleHint?: () => Promise<unknown> }) => {
        probeCalls.push(id);
        if (id === "eu_safety_gate") {
          safetyGateHint = ctx.vehicleHint ? await ctx.vehicleHint() : null;
          return buildVinScanIndicator("eu_safety_gate", ctx.vin, { status: "none", summary: "nav" });
        }
        if (id === "csdd") {
          await new Promise((r) => setTimeout(r, 20));
          return buildVinScanIndicator("csdd", ctx.vin, {
            status: "found",
            summary: "VOLVO V60",
            vehicle: { make: "VOLVO", model: "V60", year: "2014" },
          });
        }
        return buildVinScanIndicator(id as never, ctx.vin, {
          status: "found",
          summary: "ok",
          vehicle: { make: "VOLVO", model: "740 Series", year: "2014" },
        });
      },
  };
});

import { runVinScan, sanitizeVinScanSourceIds } from "@/lib/vin-scan/run";

const VIN = "YV1FW7BCDE1234567";

describe("runVinScan 26.11 audits", () => {
  beforeEach(() => {
    probeCalls.length = 0;
    safetyGateHint = "nav izsaukts";
  });

  it("saišu avotus (LT policija, AucHistory u.c.) neizsauc pat ar skaidru sarakstu - nav CapSolver maksas", async () => {
    expect(sanitizeVinScanSourceIds(["lt_itpr", "auchistory", "nummerplade", "csdd"])).toEqual(["csdd"]);
    expect(sanitizeVinScanSourceIds(["lt_itpr", "auchistory"])).toBeUndefined();
    const rows = await runVinScan({ vin: VIN, sourceIds: ["lt_itpr", "auchistory", "stat_vin", "csdd"], ignoreBreaker: true });
    expect(probeCalls).toEqual(["csdd"]);
    expect(rows.map((r) => r.id)).toEqual(["csdd"]);
  });

  it("noklusējuma skenējums saišu avotus neprasa", async () => {
    await runVinScan({ vin: VIN, ignoreBreaker: true });
    for (const id of ["lt_itpr", "auchistory", "nummerplade", "biluppgifter", "recall_volvo", "carpass"]) {
      expect(probeCalls, id).not.toContain(id);
    }
    expect(probeCalls).toContain("csdd");
  });

  it("ES Safety Gate saņem CSDD modeli (V60), nevis vPIC «740 Series»", async () => {
    await runVinScan({ vin: VIN, sourceIds: ["vin_decode", "csdd", "eu_safety_gate"], ignoreBreaker: true });
    expect(safetyGateHint).toEqual({ make: "VOLVO", model: "V60", year: "2014" });
  });
});
