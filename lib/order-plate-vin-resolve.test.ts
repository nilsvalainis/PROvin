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

import { resolveOrderVinFromPlate } from "@/lib/order-plate-vin-resolve";

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
    const fetchCsdd = vi.fn(async (): Promise<CsddTechDataResult> => ({
      found: true,
      message: "ok",
      data: {
        registrationNumber: "KG982",
        vin: "WVWZZZ1JZ3W386752",
        make: "VW",
        model: "Golf",
        year: "2000",
        fuel: "",
        powerKw: "",
        electricPowerKw: "",
        electricPowerKw2: "",
        displacementCm3: "",
        firstRegistrationIso: "",
        color: "",
        vehicleKind: "",
        cocCategory: "",
        cocType: "",
        cocApprovalNumber: "",
        cocVariant: "",
        cocVersion: "",
        grossMassKg: "",
        curbMassKg: "",
        insuranceEndIso: "",
        inspectionValidUntilIso: "",
      },
    }));

    const result = await resolveOrderVinFromPlate("cs_test_123", {
      stripeVin: "KG982",
      fetchCsdd,
    });

    expect(result.effectiveVin).toBe("WVWZZZ1JZ3W386752");
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
});
