import { describe, expect, it, vi, beforeEach } from "vitest";
import type { CsddTechDataResult } from "@/lib/csdd-tech-data";

const mocks = vi.hoisted(() => ({
  patchOrderDraft: vi.fn(),
  readOrderDraft: vi.fn(),
  upsertOrderDraftVinPlateResolution: vi.fn(),
  patchStripePaidIndexVin: vi.fn(),
  readDealerDataJob: vi.fn(),
  upsertDealerDataJob: vi.fn(),
  enqueueDealerDataJob: vi.fn(),
  seed: vi.fn(),
  scan: vi.fn(),
  intake: vi.fn(),
  dropbox: vi.fn(),
}));

vi.mock("@/lib/dealer-data-job-store", () => ({
  readDealerDataJob: mocks.readDealerDataJob,
  upsertDealerDataJob: mocks.upsertDealerDataJob,
}));

vi.mock("@/lib/dealer-data-job", () => ({
  enqueueDealerDataJob: mocks.enqueueDealerDataJob,
}));

vi.mock("@/lib/order-dropbox", () => ({
  ensureOrderDropboxFolderSafe: mocks.dropbox,
}));

vi.mock("@/lib/csdd-tech-data-counted", () => ({
  fetchCsddTechDataCounted: vi.fn(),
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
  seedPaidOrderAutoSources: mocks.seed,
}));

vi.mock("@/lib/order-vin-scan-run", () => ({
  runOrderFreeVinScan: mocks.scan,
}));

vi.mock("@/lib/order-auto-intake", () => ({
  startOrderAutoIntake: mocks.intake,
}));

vi.mock("@/lib/admin-orders", () => ({
  getCheckoutSessionDetail: vi.fn(),
}));

import { emptyCsddTechData } from "@/lib/csdd-tech-data";
import {
  ensureOrderDraftEditsFromCheckoutFields,
  resolveOrderVinFromPlate,
  usableResolvedVin,
} from "@/lib/order-plate-vin-resolve";
import { hasIso3779CheckDigit } from "@/lib/vin-iso3779";

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
    mocks.readDealerDataJob.mockResolvedValue(null);
    mocks.upsertDealerDataJob.mockResolvedValue(null);
    mocks.enqueueDealerDataJob.mockResolvedValue(true);
    mocks.seed.mockResolvedValue({ ok: true });
    mocks.scan.mockResolvedValue({ ok: true });
    mocks.intake.mockResolvedValue("background");
    mocks.dropbox.mockResolvedValue(undefined);
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
    expect(result.resolution).toMatchObject({
      status: "failed",
      plate: "KG982",
      failKind: "not_found",
      message: "CSDD atgrieztais VIN nav derīgs",
    });
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


describe("numurzīme → VIN → ielase (Nils 26.11, EB5020)", () => {
  const noSleep = vi.fn(async () => undefined);
  const delays = [0, 8_000, 20_000];

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.patchOrderDraft.mockResolvedValue({ ok: true });
    mocks.upsertOrderDraftVinPlateResolution.mockResolvedValue({ ok: true });
    mocks.patchStripePaidIndexVin.mockResolvedValue(undefined);
    mocks.readDealerDataJob.mockResolvedValue(null);
    mocks.upsertDealerDataJob.mockResolvedValue(null);
    mocks.enqueueDealerDataJob.mockResolvedValue(true);
    mocks.seed.mockResolvedValue({ ok: true });
    mocks.scan.mockResolvedValue({ ok: true });
    mocks.intake.mockResolvedValue("background");
    mocks.dropbox.mockResolvedValue(undefined);
    mocks.readOrderDraft.mockResolvedValue({ orderEdits: { licensePlate: "EB5020", vin: "" }, vinPlateResolution: null });
  });

  it("atrastais VIN palaiž to pašu plūsmu kā VIN pasūtījumam: avoti, VIN SCAN, dīlera dati, Dropbox", async () => {
    mocks.readDealerDataJob.mockResolvedValue({ sessionId: "cs_x", vin: "", status: "no_vin", attempts: 0, plate: "EB5020" });
    const fetchCsdd = vi.fn(foundCsdd({ registrationNumber: "EB5020" }));
    const r = await resolveOrderVinFromPlate("cs_x", { stripeVin: "EB5020", fetchCsdd, runDownstream: true, sleep: noSleep });
    expect(r.effectiveVin).toBe(VALID_VIN);
    expect(fetchCsdd).toHaveBeenCalledTimes(1);
    expect(mocks.enqueueDealerDataJob).toHaveBeenCalledWith({ sessionId: "cs_x", vin: VALID_VIN, cronAfterMs: 0 });
    expect(mocks.seed).toHaveBeenCalledWith("cs_x", expect.objectContaining({ vin: VALID_VIN }));
    // VIN SCAN iet caur automātiku pēc apmaksas (tā pati plūsma kā webhook), pēc CSDD sēklas; dīlerim bez push.
    expect(mocks.scan).not.toHaveBeenCalled();
    expect(mocks.intake).toHaveBeenCalledWith("cs_x", expect.objectContaining({ vin: VALID_VIN, skipPush: true }));
    expect(mocks.seed.mock.invocationCallOrder[0]).toBeLessThan(mocks.intake.mock.invocationCallOrder[0]!);
    expect(mocks.dropbox).toHaveBeenCalledWith("cs_x", { vin: VALID_VIN });
    expect(mocks.patchOrderDraft).toHaveBeenLastCalledWith(
      "cs_x",
      { orderEdits: expect.objectContaining({ vin: VALID_VIN, licensePlate: "EB5020" }) },
      { force: true },
    );
  });

  it("pasūtījumam bez dīlera darba dīlera ielasi nepalaiž (citi maksas avoti netiek aiztikti)", async () => {
    const r = await resolveOrderVinFromPlate("cs_x", {
      stripeVin: "EB5020",
      fetchCsdd: vi.fn(foundCsdd()),
      runDownstream: true,
      sleep: noSleep,
    });
    expect(r.effectiveVin).toBe(VALID_VIN);
    expect(mocks.enqueueDealerDataJob).not.toHaveBeenCalled();
    expect(mocks.seed).toHaveBeenCalled();
    expect(mocks.intake).toHaveBeenCalledWith("cs_x", expect.objectContaining({ vin: VALID_VIN, skipPush: false }));
  });

  it("CSDD relejs 502 (VPN pārslēgšanās) - atkārto un atrod VIN", async () => {
    const fetchCsdd = vi
      .fn<(nr: string) => Promise<CsddTechDataResult>>()
      .mockResolvedValueOnce({ found: false, message: "CSDD neatbildēja (HTTP 502)" })
      .mockImplementationOnce(foundCsdd());
    const r = await resolveOrderVinFromPlate("cs_x", { stripeVin: "EB5020", fetchCsdd, retryDelaysMs: delays, sleep: noSleep });
    expect(r.effectiveVin).toBe(VALID_VIN);
    expect(fetchCsdd).toHaveBeenCalledTimes(2);
    expect(noSleep).toHaveBeenCalledWith(8_000);
    expect(r.resolution).toMatchObject({ status: "resolved", attempts: 2 });
  });

  it("CSDD visu laiku nesasniedzams - failKind unreachable, dīlera darbā csdd_unreachable", async () => {
    mocks.readDealerDataJob.mockResolvedValue({ sessionId: "cs_x", vin: "", status: "no_vin", attempts: 0, plate: "EB5020", plateAttempts: 1 });
    const fetchCsdd = vi.fn(async (): Promise<CsddTechDataResult> => ({ found: false, message: "CSDD neatbildēja (HTTP 502)" }));
    const r = await resolveOrderVinFromPlate("cs_x", { stripeVin: "EB5020", fetchCsdd, retryDelaysMs: delays, sleep: noSleep });
    expect(r.effectiveVin).toBeNull();
    expect(fetchCsdd).toHaveBeenCalledTimes(3);
    expect(r.resolution).toMatchObject({ status: "failed", failKind: "unreachable", plate: "EB5020", attempts: 3 });
    expect(mocks.upsertDealerDataJob).toHaveBeenCalledWith(
      "cs_x",
      expect.objectContaining({ status: "no_vin", error: "csdd_unreachable", plateAttempts: 2 }),
    );
    expect(mocks.enqueueDealerDataJob).not.toHaveBeenCalled();
  });

  it("CSDD neatrod numuru - viens vaicājums, failKind not_found, ielase netiek palaista", async () => {
    mocks.readDealerDataJob.mockResolvedValue({ sessionId: "cs_x", vin: "", status: "no_vin", attempts: 0, plate: "EB5020" });
    const fetchCsdd = vi.fn(async (): Promise<CsddTechDataResult> => ({
      found: false,
      message: "CSDD reģistrā šāds numurs netika atrasts",
    }));
    const r = await resolveOrderVinFromPlate("cs_x", { stripeVin: "EB5020", fetchCsdd, runDownstream: true, retryDelaysMs: delays, sleep: noSleep });
    expect(r.effectiveVin).toBeNull();
    expect(fetchCsdd).toHaveBeenCalledTimes(1);
    expect(r.resolution).toMatchObject({ status: "failed", failKind: "not_found" });
    expect(mocks.upsertDealerDataJob).toHaveBeenCalledWith("cs_x", expect.objectContaining({ error: "vin_not_found" }));
    expect(mocks.seed).not.toHaveBeenCalled();
    expect(mocks.enqueueDealerDataJob).not.toHaveBeenCalled();
  });

  it("dubulta palaišana: svaigs «pending» vai «resolved» - otrs CSDD vaicājums netiek sūtīts", async () => {
    const fetchCsdd = vi.fn(foundCsdd());
    const now = Date.parse("2026-11-26T08:05:40.000Z");
    mocks.readOrderDraft.mockResolvedValue({
      orderEdits: { licensePlate: "EB5020", vin: "" },
      vinPlateResolution: { plate: "EB5020", status: "pending", updatedAt: "2026-11-26T08:05:30.000Z" },
    });
    const busy = await resolveOrderVinFromPlate("cs_x", { stripeVin: "EB5020", fetchCsdd, force: true, nowMs: () => now });
    expect(busy).toMatchObject({ skipped: true, reason: "in_progress", effectiveVin: null });

    mocks.readOrderDraft.mockResolvedValue({
      orderEdits: { licensePlate: "EB5020", vin: VALID_VIN },
      vinPlateResolution: { plate: "EB5020", status: "resolved", updatedAt: "2026-11-26T08:05:35.000Z" },
    });
    const done = await resolveOrderVinFromPlate("cs_x", { stripeVin: "EB5020", fetchCsdd, force: true });
    expect(done).toMatchObject({ skipped: true, reason: "already_resolved", effectiveVin: VALID_VIN });
    expect(fetchCsdd).not.toHaveBeenCalled();

    // Iestrēdzis «pending» (>3 min) vairs nebloķē.
    mocks.readOrderDraft.mockResolvedValue({
      orderEdits: { licensePlate: "EB5020", vin: "" },
      vinPlateResolution: { plate: "EB5020", status: "pending", updatedAt: "2026-11-26T07:55:00.000Z" },
    });
    const stale = await resolveOrderVinFromPlate("cs_x", { stripeVin: "EB5020", fetchCsdd, nowMs: () => now });
    expect(stale.effectiveVin).toBe(VALID_VIN);
    expect(fetchCsdd).toHaveBeenCalledTimes(1);
  });

  it("nederīgs VIN no CSDD (Ziemeļamerikas VIN ar nepareizu kontrolciparu, 16 zīmes) netiek saglabāts", async () => {
    expect(hasIso3779CheckDigit("1HGCM82643A004352")).toBe(false);
    for (const bad of ["1HGCM82643A004352", "WVWZZZ1JZ3W38675", "00000000000000000"]) {
      mocks.patchStripePaidIndexVin.mockClear();
      const r = await resolveOrderVinFromPlate("cs_x", {
        stripeVin: "EB5020",
        fetchCsdd: vi.fn(foundCsdd({ vin: bad })),
        sleep: noSleep,
      });
      expect(r.effectiveVin).toBeNull();
      expect(r.resolution?.status).toBe("failed");
      expect(mocks.patchStripePaidIndexVin).not.toHaveBeenCalled();
    }
    expect(usableResolvedVin("1HGCM82633A004352")).toBe("1HGCM82633A004352");
    expect(usableResolvedVin("WVWZZZ3CZME138258")).toBe("WVWZZZ3CZME138258");
  });
});
