import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const VIN = "WBA5R1C0XLFH42873";
const PEEK_ID = "0f8fad5b-d9cb-469f-a165-70867728950e";

const state: {
  peek: Record<string, unknown> | null;
  doc: Record<string, unknown> | null;
  snapshot: { vin: string; scannedAt: string; indicators: Array<{ id: string; status: string; summary: string; detail: string }> } | null;
  seedCalls: Array<Record<string, unknown>>;
  locks: Map<string, string>;
} = { peek: null, doc: null, snapshot: null, seedCalls: [], locks: new Map() };

vi.mock("@/lib/listing-peek-store", () => ({
  getListingPeekById: vi.fn(async () => state.peek),
  listListingPeeks: vi.fn(async () => (state.peek ? [state.peek] : [])),
}));
vi.mock("@/lib/quick-eval-store", async () => {
  const { mergeSourceBlocksWithDefaults } = await import("@/lib/admin-source-blocks");
  const empty = () => ({
    version: 1,
    peekId: PEEK_ID,
    vin: "",
    sourceBlocks: mergeSourceBlocksWithDefaults(null),
    createdAt: "2026-11-26T10:00:00Z",
    updatedAt: "2026-11-26T10:00:00Z",
  });
  return {
    readQuickEval: vi.fn(async () => state.doc),
    updateQuickEval: vi.fn(async (_id: string, fn: (d: unknown) => unknown) => {
      state.doc = (await fn(state.doc ?? empty())) as Record<string, unknown>;
      return state.doc;
    }),
  };
});
vi.mock("@/lib/quick-eval-service", () => ({
  seedQuickEval: vi.fn(async (_id: string, opts: Record<string, unknown>) => {
    state.seedCalls.push(opts);
    const vin = String(opts.vin ?? "");
    state.doc = {
      ...(state.doc ?? {}),
      vin,
      seed: { at: "2026-11-26T12:00:00Z", parts: { csdd: "filled" } },
      ...(opts.skipVinScan ? {} : { vinScan: { at: "2026-11-26T12:00:00Z", indicators: [] } }),
    };
    return state.doc;
  }),
}));
vi.mock("@/lib/stripe-webhook-dedupe-store", () => ({
  tryBeginStripeEvent: vi.fn(async (key: string) => {
    if (state.locks.has(key)) return false;
    state.locks.set(key, "claimed");
    return true;
  }),
  completeStripeEvent: vi.fn(async (key: string) => void state.locks.set(key, "done")),
  releaseStripeEvent: vi.fn(async (key: string) => void state.locks.delete(key)),
}));
vi.mock("@/lib/vin-scan/store", () => ({ readVinScanSnapshot: vi.fn(async () => state.snapshot) }));
vi.mock("@/lib/vin-scan/catalog", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/vin-scan/catalog")>()),
  defaultVinScanSourceIds: () => ["csdd", "carfax_eu"],
}));
vi.mock("@/lib/vin-scan/thecarapi-flags", () => ({ thecarapiConfigured: () => false, thecarapiAdminFlag: () => false }));
vi.mock("@/lib/thecarapi-cc-vin", () => ({ fetchThecarapiCcVinMerge: vi.fn() }));
vi.mock("@/lib/csdd-tech-data-counted", () => ({ fetchCsddTechDataCounted: vi.fn() }));
vi.mock("@/lib/ecsdd-auto", () => ({
  readEcsddRelayConfig: () => ({ baseUrl: "https://r.example", token: "x".repeat(20), autoEnabled: true }),
  fetchEcsddRelaySession: vi.fn(async () => ({ state: "logged_out" })),
  startEcsddLookup: vi.fn(),
}));
vi.mock("@/lib/ecsdd-auto-store", () => ({ readEcsddAutoStatus: vi.fn(async () => null) }));
vi.mock("@/lib/ltab-auto", () => ({ readLtabRelayConfig: () => null, startLtabLookup: vi.fn() }));
vi.mock("@/lib/ltab-auto-store", () => ({ readLtabAutoStatus: vi.fn(async () => null) }));
vi.mock("@/lib/order-plate-vin-resolve", () => ({
  PLATE_VIN_RETRY_DELAYS_MS: [0, 8000, 20000],
  usableResolvedVin: (v: string) => (/^[A-HJ-NPR-Z0-9]{17}$/.test(v) ? v : ""),
}));

import { resolveQuickEvalPlateVin, runQuickEvalAuto } from "@/lib/quick-eval-auto";
import { startEcsddLookup } from "@/lib/ecsdd-auto";

const NOW = Date.parse("2026-11-26T12:00:00Z");
const deps = { now: () => NOW, sleep: async () => undefined, retryDelaysMs: [0, 8000, 20000] };

function csddFound(vin = VIN) {
  return { found: true as const, data: { vin, registrationNumber: "AB1234" } } as never;
}

beforeEach(() => {
  state.peek = { id: PEEK_ID, vin: VIN, listingUrl: "https://www.ss.lv/msg/lv/x.html", createdAt: "2026-11-26T11:00:00Z", status: "new" };
  state.doc = null;
  state.snapshot = null;
  state.seedCalls = [];
  state.locks.clear();
  vi.mocked(startEcsddLookup).mockClear();
});

describe("ātro vērtējumu automātika", () => {
  it("idempotence: otrā palaišana tam pašam pieteikumam + VIN neko nedara", async () => {
    const a = await runQuickEvalAuto(PEEK_ID, { deps: { ...deps, fetchCsdd: vi.fn() } });
    expect(a.ok).toBe(true);
    expect((state.doc?.auto as { state: string }).state).toBe("ready");
    const b = await runQuickEvalAuto(PEEK_ID, { deps: { ...deps, fetchCsdd: vi.fn() } });
    expect(b.reason).toBe("already_ran");
    expect(state.seedCalls).toHaveLength(1);
  });

  it("«Atkārtot» palaiž vēlreiz (cita slēdzenes atslēga)", async () => {
    await runQuickEvalAuto(PEEK_ID, { deps: { ...deps, fetchCsdd: vi.fn() } });
    const r = await runQuickEvalAuto(PEEK_ID, { retry: true, deps: { ...deps, fetchCsdd: vi.fn() } });
    expect(r.ok).toBe(true);
    expect(state.seedCalls).toHaveLength(2);
  });

  it("numurs -> VIN ar atkārtojumiem pēc pārejošas CSDD kļūdas", async () => {
    state.peek = { ...state.peek!, vin: "AB1234" };
    const fetchCsdd = vi
      .fn()
      .mockResolvedValueOnce({ found: false, message: "CSDD relejs neatbildēja" })
      .mockResolvedValueOnce(csddFound());
    const r = await runQuickEvalAuto(PEEK_ID, { deps: { ...deps, fetchCsdd } });
    expect(fetchCsdd).toHaveBeenCalledTimes(2);
    expect(r.vin).toBe(VIN);
    expect(state.seedCalls[0]!.vin).toBe(VIN);
    const auto = state.doc?.auto as { steps: Record<string, { state: string }> };
    expect(auto.steps.plate_vin!.state).toBe("ok");
  });

  it("numurs: CSDD nav ieraksta - neatkārto, solis «error»", async () => {
    const fetchCsdd = vi.fn().mockResolvedValue({ found: false, message: "Transportlīdzeklis nav atrasts" });
    const r = await resolveQuickEvalPlateVin("AB1234", { ...deps, fetchCsdd });
    expect(fetchCsdd).toHaveBeenCalledTimes(1);
    expect(r).toMatchObject({ vin: "", failKind: "not_found" });
  });

  it("kešs: tas pats VIN skenēts < 24 h - VIN SCAN nepalaiž", async () => {
    state.snapshot = {
      vin: VIN,
      scannedAt: "2026-11-26T08:00:00.000Z",
      indicators: [
        { id: "csdd", status: "found", summary: "x", detail: "" },
        { id: "carfax_eu", status: "none", summary: "nav", detail: "" },
      ],
    };
    const r = await runQuickEvalAuto(PEEK_ID, { deps: { ...deps, fetchCsdd: vi.fn() } });
    expect(r.cacheHit).toBe(true);
    expect(state.seedCalls[0]!.skipVinScan).toBe(true);
    expect((state.doc?.vinScan as { at: string }).at).toBe("2026-11-26T08:00:00.000Z");
  });

  it("vecs momentuzņēmums (> 24 h) - VIN SCAN palaiž", async () => {
    state.snapshot = { vin: VIN, scannedAt: "2026-11-25T08:00:00.000Z", indicators: [{ id: "csdd", status: "found", summary: "x", detail: "" }, { id: "carfax_eu", status: "none", summary: "", detail: "" }] };
    const r = await runQuickEvalAuto(PEEK_ID, { deps: { ...deps, fetchCsdd: vi.fn() } });
    expect(r.cacheHit).toBe(false);
    expect(state.seedCalls[0]!.skipVinScan).toBe(false);
  });

  it("Smart-ID sesija nav aktīva - e.csdd negaida un nesāk, atzīmē «Smart-ID gaida»", async () => {
    await runQuickEvalAuto(PEEK_ID, { deps: { ...deps, fetchCsdd: vi.fn() } });
    const auto = state.doc?.auto as { state: string; steps: Record<string, { state: string }> };
    expect(auto.state).toBe("ready");
    expect(auto.steps.ecsdd!.state).toBe("smartid_wait");
    expect(startEcsddLookup).not.toHaveBeenCalled();
  });
});
