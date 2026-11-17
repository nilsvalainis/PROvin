/**
 * Automātiskās plūsmas (pasūtījuma VIN SCAN pēc apmaksas, cron, melnraksta saglabāšana) nedrīkst
 * palaist maksas avotus un nedrīkst pirkt CarVertical atskaiti. Pārbauda uzvedību: kuras zondes
 * tiešām tiek izsauktas, nevis vai avota tekstā ir kāds vārds. Tīkla nav - zondes un krātuves ir aizstātas.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const probeCalls: string[] = [];
const draftWrites: { status?: string; vin?: string }[] = [];
let draft: unknown = null;

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
    vinScanProbeFor: (id: string) => (ctx: { vin: string }) => {
      probeCalls.push(id);
      return buildVinScanIndicator(id as never, ctx.vin, { status: "none", summary: "nav" });
    },
  };
});
vi.mock("@/lib/admin-order-draft-store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/admin-order-draft-store")>();
  return {
    ...actual,
    readOrderDraft: vi.fn(async () => draft),
    upsertOrderDraftVinScan: vi.fn(async (_id: string, record: { status?: string; vin?: string }) => {
      draftWrites.push(record);
      return { ok: true };
    }),
  };
});
vi.mock("@/lib/admin-orders", () => ({ getCheckoutSessionDetail: vi.fn(async () => null) }));
vi.mock("@/lib/vin-scan/store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/vin-scan/store")>();
  return { ...actual, writeVinScanSnapshot: vi.fn(async () => undefined) };
});
vi.mock("@/lib/carvertical-purchase", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/carvertical-purchase")>();
  return { ...actual, purchaseCarVerticalReport: vi.fn(actual.purchaseCarVerticalReport) };
});

import { purchaseCarVerticalReport } from "@/lib/carvertical-purchase";
import { runOrderFreeVinScan } from "@/lib/order-vin-scan-run";
import { resetOrderVinScanSlots } from "@/lib/order-vin-scan-run-decision";
import { VIN_SCAN_SOURCE_IDS } from "@/lib/vin-scan/catalog";
import {
  VIN_SCAN_METERED_SOURCE_IDS,
  VIN_SCAN_PAID_SOURCE_IDS,
  freeVinScanSourceIds,
  isFreeVinScanSourceId,
} from "@/lib/vin-scan/free-sources";
import { runVinScan, sanitizeVinScanSourceIds } from "@/lib/vin-scan/run";

const VIN = "WBA5R1C0XLFH42873";
const PAID = [...VIN_SCAN_PAID_SOURCE_IDS, ...VIN_SCAN_METERED_SOURCE_IDS, "carvertical", "carvertical_preview", "autodna_preview"];

beforeEach(() => {
  probeCalls.length = 0;
  draftWrites.length = 0;
  draft = null;
  resetOrderVinScanSlots();
  vi.mocked(purchaseCarVerticalReport).mockClear();
  vi.stubEnv("THECARAPI_API_KEY", "");
  vi.stubEnv("THECARAPI_VIN_SCAN_ENABLED", "");
  vi.spyOn(console, "info").mockImplementation(() => undefined);
});

function expectOnlyFreeProbes() {
  for (const id of probeCalls) expect(isFreeVinScanSourceId(id), id).toBe(true);
  for (const id of PAID) expect(probeCalls, id).not.toContain(id);
  expect(purchaseCarVerticalReport).not.toHaveBeenCalled();
}

describe("automātiskais VIN SCAN nepalaiž maksas avotus", () => {
  it("runVinScan: arī tieši palūgti maksas avoti netiek izsaukti", async () => {
    const rows = await runVinScan({ vin: VIN, sourceIds: [...PAID, "tjekbil", "stat_vin"] });
    expect(probeCalls.sort()).toEqual(["stat_vin", "tjekbil"]);
    expect(rows.map((row) => row.id).sort()).toEqual(["stat_vin", "tjekbil"]);
    expectOnlyFreeProbes();
  });

  it("runVinScan bez saraksta palaiž tieši bezmaksas avotus", async () => {
    await runVinScan({ vin: VIN });
    expect([...probeCalls].sort()).toEqual([...freeVinScanSourceIds()].sort());
    expectOnlyFreeProbes();
  });

  it("runVinScan ar visu katalogu: maksas un mērāmie avoti paliek ārā", async () => {
    await runVinScan({ vin: VIN, sourceIds: [...VIN_SCAN_SOURCE_IDS, ...PAID] });
    expect(probeCalls.length).toBeGreaterThan(10);
    expectOnlyFreeProbes();
  });

  it("API ievades tīrīšana izmet maksas avotus", () => {
    expect(sanitizeVinScanSourceIds(PAID)).toBeUndefined();
    expect(sanitizeVinScanSourceIds([...PAID, "csdd", 7, null])).toEqual(["csdd"]);
    expect(sanitizeVinScanSourceIds("csdd")).toBeUndefined();
  });

  it("pasūtījuma auto skenējums: palūgti maksas avoti netiek palaisti, rezultāts saglabāts", async () => {
    const result = await runOrderFreeVinScan("cs_test_auto1", { vin: VIN, sourceIds: [...PAID, "tjekbil"] });
    expect(result).toMatchObject({ ok: true, vin: VIN });
    expect(probeCalls).toEqual(["tjekbil"]);
    expect(draftWrites.map((w) => w.status)).toEqual(["running", "done"]);
    expectOnlyFreeProbes();
  });

  it("pasūtījuma auto skenējums tikai ar maksas avotiem atkrīt uz bezmaksas sarakstu", async () => {
    await runOrderFreeVinScan("cs_test_auto2", { vin: VIN, sourceIds: ["carvertical", "joj_copart_iaai"] });
    expect([...probeCalls].sort()).toEqual([...freeVinScanSourceIds()].sort());
    expectOnlyFreeProbes();
  });

  it("jau notiekošu skenējumu otrreiz nepalaiž", async () => {
    draft = { vinScan: { at: new Date().toISOString(), vin: VIN, status: "running", indicators: [] } };
    const result = await runOrderFreeVinScan("cs_test_auto3", { vin: VIN });
    expect(result).toEqual({ ok: true, skipped: true, reason: "already_running" });
    expect(probeCalls).toEqual([]);
    expect(draftWrites).toEqual([]);
  });

  it("bez derīga VIN nekas netiek palaists", async () => {
    expect(await runOrderFreeVinScan("cs_test_auto4", { vin: "nav" })).toMatchObject({ skipped: true, reason: "no_vin" });
    expect(probeCalls).toEqual([]);
  });
});
