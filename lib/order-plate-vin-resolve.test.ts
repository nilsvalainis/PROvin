import { describe, expect, it, vi, beforeEach } from "vitest";
import type { CsddTechDataResult } from "@/lib/csdd-tech-data";

const mocks = vi.hoisted(() => ({
  patchOrderDraft: vi.fn(),
  readOrderDraft: vi.fn(),
  upsertOrderDraftVinPlateResolution: vi.fn(),
  patchStripePaidIndexVin: vi.fn(),
}));

vi.mock("@/lib/admin-order-draft-store", () => ({
  isSafeOrderDraftSessionId: (id: string) => id.startsWith("cs_"),
  patchOrderDraft: mocks.patchOrderDraft,
  readOrderDraft: mocks.readOrderDraft,
  upsertOrderDraftVinPlateResolution: mocks.upsertOrderDraftVinPlateResolution,
}));

vi.mock("@/lib/admin-stripe-paid-index", () => ({
  patchStripePaidIndexVin: mocks.patchStripePaidIndexVin,
}));

vi.mock("@/lib/admin-paid-order-source-seed", () => ({
  seedPaidOrderAutoSources: vi.fn(),
}));

vi.mock("@/lib/order-vin-scan-run", () => ({
  runOrderFreeVinScan: vi.fn(),
}));

vi.mock("@/lib/admin-orders", () => ({
  getCheckoutSessionDetail: vi.fn(),
}));

import { emptyCsddTechData } from "@/lib/csdd-tech-data";
import { ensureOrderDraftEditsFromCheckoutFields, resolveOrderVinFromPlate } from "@/lib/order-plate-vin-resolve";

const VALID_VIN = "WVWZZZ1JZ3W386752";

function foundCsdd(over: { registrationNumber?: string; vin?: string } = {}) {
  return async () =>
    ({
      found: true as const,
      message: "ok",
      data: {
        ...emptyCsddTechData(),
        registrationNumber: over.registrationNumber ?? "KG982",
        vin: over.vin ?? VALID_VIN,
        make: "VW",
        model: "Golf",
        year: "2000",
      },
    });
}

describe("resolveOrderVinFromPlate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.patchOrderDraft.mockResolvedValue({ ok: true });
    mocks.upsertOrderDraftVinPlateResolution.mockResolvedValue({ ok: true });
    mocks.patchStripePaidIndexVin.mockResolvedValue(undefined);
  });

  it("atrisinā numurzīmi uz VIN caur mock CSDD", async () => {
    mocks.readOrderDraft.mockResolvedValue({
      orderEdits: { licensePlate: "KG982", vin: "" },
      vinPlateResolution: null,
    });
    const fetchCsdd = vi.fn(foundCsdd());

    const result = await resolveOrderVinFromPlate("cs_test_123", {
      stripeVin: "KG982",
      fetchCsdd,
    });

    expect(result.effectiveVin).toBe(VALID_VIN);
    expect(result.resolution?.status).toBe("resolved");
    expect(fetchCsdd).toHaveBeenCalledWith("KG982");
    expect(mocks.patchStripePaidIndexVin).toHaveBeenCalledWith("cs_test_123", "WVWZZZ1JZ3W386752");
  });

  it("neveiksmei saglabā failed statusu", async () => {
    mocks.readOrderDraft.mockResolvedValue(null);
    const fetchCsdd = vi.fn(async (): Promise<CsddTechDataResult> => ({
      found: false,
      message: "CSDD reģistrā šāds numurs netika atrasts",
    }));

    const result = await resolveOrderVinFromPlate("cs_test_456", {
      stripeVin: "ZZ999",
      fetchCsdd,
    });

    expect(result.effectiveVin).toBeNull();
    expect(result.resolution?.status).toBe("failed");
    expect(result.resolution?.plate).toBe("ZZ999");
  });

  it("jau resolved VIN vairs nezvana CSDD; force atkārto, ja laukā vēl ir numurzīme", async () => {
    mocks.readOrderDraft.mockResolvedValue({
      orderEdits: { licensePlate: "KG982", vin: VALID_VIN },
      vinPlateResolution: {
        plate: "KG982",
        status: "resolved",
        updatedAt: "2026-10-29T09:00:00.000Z",
      },
    });
    const fetchCsdd = vi.fn(foundCsdd());
    const skipped = await resolveOrderVinFromPlate("cs_test_123", { stripeVin: "KG982", fetchCsdd });
    expect(skipped).toMatchObject({
      ok: true,
      effectiveVin: VALID_VIN,
      skipped: true,
      reason: "already_resolved",
    });
    expect(fetchCsdd).not.toHaveBeenCalled();

    mocks.readOrderDraft.mockResolvedValue({
      orderEdits: { licensePlate: "KG982", vin: "KG982" },
      vinPlateResolution: {
        plate: "KG982",
        status: "resolved",
        updatedAt: "2026-10-29T09:00:00.000Z",
      },
    });
    const forced = await resolveOrderVinFromPlate("cs_test_123", { stripeVin: "KG982", fetchCsdd, force: true });
    expect(forced.resolution?.status).toBe("resolved");
    expect(forced.effectiveVin).toBe(VALID_VIN);
    expect(fetchCsdd).toHaveBeenCalledTimes(1);
  });

  it("ja laukā jau ir VIN, numurzīmi neārstē", async () => {
    mocks.readOrderDraft.mockResolvedValue({
      orderEdits: { vin: VALID_VIN, licensePlate: "KG982" },
      vinPlateResolution: null,
    });
    const fetchCsdd = vi.fn(foundCsdd());
    const result = await resolveOrderVinFromPlate("cs_test_123", { stripeVin: "KG982", fetchCsdd });
    expect(result).toMatchObject({ ok: true, effectiveVin: VALID_VIN, skipped: true, reason: "already_vin" });
    expect(fetchCsdd).not.toHaveBeenCalled();
  });

  it("nederīga sesija vai tukšs ievads - bez CSDD", async () => {
    const fetchCsdd = vi.fn(foundCsdd());
    expect(await resolveOrderVinFromPlate("ord_not_stripe", { stripeVin: "KG982", fetchCsdd })).toMatchObject({
      ok: false,
      reason: "invalid_session",
    });
    mocks.readOrderDraft.mockResolvedValue({ orderEdits: { vin: "", licensePlate: "" }, vinPlateResolution: null });
    expect(await resolveOrderVinFromPlate("cs_test_123", { stripeVin: "", fetchCsdd })).toMatchObject({
      ok: false,
      reason: "invalid_intake",
    });
    expect(fetchCsdd).not.toHaveBeenCalled();
  });

  it("CSDD atrada auto, bet VIN nav lietojams - failed, numurzīme paliek", async () => {
    mocks.readOrderDraft.mockResolvedValue({
      orderEdits: { licensePlate: "KG982", vin: "" },
      vinPlateResolution: null,
    });
    const fetchCsdd = vi.fn(foundCsdd({ vin: "AAAAAAAAAAAAAAAAA" }));
    const result = await resolveOrderVinFromPlate("cs_test_123", { stripeVin: "KG982", fetchCsdd });
    expect(result.ok).toBe(true);
    expect(result.effectiveVin).toBeNull();
    expect(result.resolution).toMatchObject({ status: "failed", plate: "KG982", message: "CSDD atbildē nav VIN" });
    expect(mocks.patchStripePaidIndexVin).not.toHaveBeenCalled();
  });
});

describe("ensureOrderDraftEditsFromCheckoutFields", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.patchOrderDraft.mockResolvedValue({ ok: true });
    mocks.readOrderDraft.mockResolvedValue({ orderEdits: {} });
  });

  it("VIN aizpilda tukšu melnrakstu; esošu VIN un e-pastu nepārraksta", async () => {
    mocks.readOrderDraft.mockResolvedValue({ orderEdits: {} });
    await ensureOrderDraftEditsFromCheckoutFields("cs_test_123", {
      vinOrPlate: VALID_VIN,
      customerEmail: "a@b.lv",
    });
    expect(mocks.patchOrderDraft).toHaveBeenCalledWith(
      "cs_test_123",
      { orderEdits: { vin: VALID_VIN, customerEmail: "a@b.lv" } },
      { force: true },
    );

    mocks.patchOrderDraft.mockClear();
    mocks.readOrderDraft.mockResolvedValue({
      orderEdits: { vin: VALID_VIN, customerEmail: "vecs@b.lv" },
    });
    await ensureOrderDraftEditsFromCheckoutFields("cs_test_123", {
      vinOrPlate: "KG982",
      customerEmail: "jauns@b.lv",
    });
    expect(mocks.patchOrderDraft).toHaveBeenCalledWith(
      "cs_test_123",
      { orderEdits: { vin: VALID_VIN, customerEmail: "vecs@b.lv", licensePlate: "KG982" } },
      { force: true },
    );
  });

  it("numurzīme ieliek licensePlate un notīra nederīgo VIN", async () => {
    mocks.readOrderDraft.mockResolvedValue({ orderEdits: { vin: "WVWZZZ1JZ3W38675" } });
    await ensureOrderDraftEditsFromCheckoutFields("cs_test_123", { vinOrPlate: "kg-982" });
    expect(mocks.patchOrderDraft).toHaveBeenCalledWith(
      "cs_test_123",
      { orderEdits: { vin: "", licensePlate: "KG982" } },
      { force: true },
    );
  });

  it("nederīga sesija vai bez izmaiņām - neraksta", async () => {
    await ensureOrderDraftEditsFromCheckoutFields("bad", { vinOrPlate: VALID_VIN });
    expect(mocks.patchOrderDraft).not.toHaveBeenCalled();
    mocks.readOrderDraft.mockResolvedValue({ orderEdits: { vin: VALID_VIN } });
    await ensureOrderDraftEditsFromCheckoutFields("cs_test_123", { vinOrPlate: VALID_VIN });
    expect(mocks.patchOrderDraft).not.toHaveBeenCalled();
  });
});

