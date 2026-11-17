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

vi.mock("@/lib/vin-scan/probes", async () => {
  const { buildVinScanIndicator } = await import("@/lib/vin-scan/types");
  return {
    sourceNeedsInput: (id: string, ctx: { vin: string; plates: { lv?: string } }) =>
      id === "csdd" && !ctx.plates.lv
        ? buildVinScanIndicator("csdd", ctx.vin, { status: "needs_input", summary: "Vajag LV numuru" })
        : null,
    vinScanProbeFor: (id: string) => (ctx: { vin: string }) => {
      probeCalls.push(id);
      return buildVinScanIndicator(id as never, ctx.vin, { status: "found", summary: "ok" });
    },
  };
});

import { runVinScan } from "@/lib/vin-scan/run";
import { vinScanSourceHealthOutcomes } from "@/lib/vin-scan/source-health-outcomes";
import type { SourceHealthDoc } from "@/lib/source-health";

const VIN = "U5YH6G17GNL050102";
const NOW = Date.parse("2026-11-17T12:00:00.000Z");

function healthWith(ids: string[], minutesAgo: number, streak = 5): SourceHealthDoc {
  const at = new Date(NOW - minutesAgo * 60_000).toISOString();
  const sources: SourceHealthDoc["sources"] = {};
  for (const id of ids) {
    sources[id] = { lastOkAt: null, lastErrAt: at, okCount: 0, errCount: streak, failStreak: streak, errors: [] };
  }
  return { sources };
}

beforeEach(() => {
  probeCalls.length = 0;
});

describe("VIN SCAN circuit breaker", () => {
  it("izlaiž avotu ar 5 kļūdām pēc kārtas un pēdējo kļūdu pirms 5 min", async () => {
    const rows = await runVinScan({
      vin: VIN,
      sourceIds: ["mnt_ee", "tjekbil"],
      nowMs: NOW,
      readHealth: async () => healthWith(["mnt_ee"], 5),
    });
    expect(probeCalls).toEqual(["tjekbil"]);
    const mnt = rows.find((r) => r.id === "mnt_ee")!;
    expect(mnt.status).toBe("unknown");
    expect(mnt.breakerOpen).toBe(true);
    expect(mnt.summary).toBe("Avots īslaicīgi atslēgts (5 kļūdas pēc kārtas), nākamā pārbaude pēc ~25 min");
    expect(rows.find((r) => r.id === "tjekbil")!.status).toBe("found");
  });

  it("pēc 30 min avotu izsauc vēlreiz (half-open)", async () => {
    await runVinScan({ vin: VIN, sourceIds: ["mnt_ee"], nowMs: NOW, readHealth: async () => healthWith(["mnt_ee"], 31) });
    expect(probeCalls).toEqual(["mnt_ee"]);
  });

  it("4 kļūdas pēc kārtas vēl neatslēdz", async () => {
    await runVinScan({ vin: VIN, sourceIds: ["mnt_ee"], nowMs: NOW, readHealth: async () => healthWith(["mnt_ee"], 1, 4) });
    expect(probeCalls).toEqual(["mnt_ee"]);
  });

  it("ignoreBreaker izsauc avotu un nelasa veselību", async () => {
    const read = vi.fn(async () => healthWith(["mnt_ee"], 5));
    await runVinScan({ vin: VIN, sourceIds: ["mnt_ee"], nowMs: NOW, ignoreBreaker: true, readHealth: read });
    expect(probeCalls).toEqual(["mnt_ee"]);
    expect(read).not.toHaveBeenCalled();
  });

  it("vin_decode nekad netiek atslēgts", async () => {
    const rows = await runVinScan({
      vin: VIN,
      sourceIds: ["vin_decode"],
      nowMs: NOW,
      readHealth: async () => healthWith(["vin_decode"], 1, 50),
    });
    expect(probeCalls).toEqual(["vin_decode"]);
    expect(rows[0]!.breakerOpen).toBeUndefined();
  });

  it("needs_input ir pirms breaker", async () => {
    const rows = await runVinScan({ vin: VIN, sourceIds: ["csdd"], nowMs: NOW, readHealth: async () => healthWith(["csdd"], 1) });
    expect(rows[0]!.status).toBe("needs_input");
    expect(rows[0]!.breakerOpen).toBeUndefined();
  });

  it("veselības lasīšanas kļūda - breaker neko neatslēdz", async () => {
    const rows = await runVinScan({
      vin: VIN,
      sourceIds: ["mnt_ee"],
      nowMs: NOW,
      readHealth: async () => {
        throw new Error("blob down");
      },
    });
    expect(probeCalls).toEqual(["mnt_ee"]);
    expect(rows[0]!.status).toBe("found");
  });

  it("veselību nolasa vienreiz uz skenējumu", async () => {
    const read = vi.fn(async () => healthWith([], 1));
    await runVinScan({ vin: VIN, sourceIds: ["mnt_ee", "tjekbil", "esyn"], nowMs: NOW, readHealth: read });
    expect(read).toHaveBeenCalledTimes(1);
  });

  it("breaker rindas netiek ierakstītas avotu veselībā kā jaunas kļūdas", async () => {
    const rows = await runVinScan({
      vin: VIN,
      sourceIds: ["mnt_ee", "tjekbil"],
      nowMs: NOW,
      readHealth: async () => healthWith(["mnt_ee"], 5),
    });
    expect(vinScanSourceHealthOutcomes(rows)).toEqual([{ id: "tjekbil", ok: true, msg: "ok" }]);
  });
});
