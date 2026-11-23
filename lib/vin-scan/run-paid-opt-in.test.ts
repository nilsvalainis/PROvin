import { beforeEach, describe, expect, it, vi } from "vitest";

const probeCalls: string[] = [];

vi.mock("server-only", () => ({}));
vi.mock("@/lib/source-health-store", () => ({
  readSourceHealth: async () => ({ sources: {} }),
  recordSourceOutcomes: async () => undefined,
}));
vi.mock("@/lib/vin-scan/listings-page-relay", () => ({
  withVinScanRelayDedupe: <T>(fn: () => Promise<T>) => fn(),
}));
// Mock: neviens īsts (maksas) pieprasījums.
vi.mock("@/lib/vin-scan/probes", async () => {
  const { buildVinScanIndicator } = await import("@/lib/vin-scan/types");
  return {
    sourceNeedsInput: () => null,
    vinScanProbeFor: (id: string) => (ctx: { vin: string }) => {
      probeCalls.push(id);
      return buildVinScanIndicator(id as never, ctx.vin, { status: "found", summary: "ok" });
    },
  };
});

import { runVinScan, sanitizeVinScanPaidSourceIds, sanitizeVinScanSourceIds } from "@/lib/vin-scan/run";

const VIN = "WBANP71040CY09201";

beforeEach(() => {
  probeCalls.length = 0;
});

describe("VIN SCAN maksas avots tikai ar admina ķeksi", () => {
  it("JoJ bez allowPaid neskrien, ar allowPaid - skrien", async () => {
    await runVinScan({ vin: VIN, sourceIds: ["joj_copart_iaai", "vin_decode"], ignoreBreaker: true });
    expect(probeCalls).toEqual(["vin_decode"]);
    probeCalls.length = 0;
    await runVinScan({ vin: VIN, sourceIds: ["joj_copart_iaai"], ignoreBreaker: true, allowPaid: ["joj_copart_iaai"] });
    expect(probeCalls).toEqual(["joj_copart_iaai"]);
  });

  it("sanitize: tikai JoJ, citi maksas avoti nekad", () => {
    expect(sanitizeVinScanPaidSourceIds(["joj_copart_iaai", "speckr", "carvertical"])).toEqual(["joj_copart_iaai"]);
    expect(sanitizeVinScanPaidSourceIds("joj_copart_iaai")).toEqual([]);
    expect(sanitizeVinScanSourceIds(["joj_copart_iaai"])).toBeUndefined();
    expect(sanitizeVinScanSourceIds(["joj_copart_iaai"], ["joj_copart_iaai"])).toEqual(["joj_copart_iaai"]);
  });
});
