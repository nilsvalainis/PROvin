import { describe, expect, it, vi } from "vitest";
import { emptyCsddTechData, type CsddTechDataResult } from "@/lib/csdd-tech-data";

const mocks = vi.hoisted(() => ({
  fetchCsdd: vi.fn<(nr1: string, caller: string) => Promise<CsddTechDataResult>>(),
}));

vi.mock("@/lib/csdd-tech-data-counted", () => ({
  fetchCsddTechDataCounted: (...args: unknown[]) => mocks.fetchCsdd(...(args as [string, string])),
}));

import { prefetchDealerCheckCsdd } from "@/lib/dealer-check-csdd-prefetch";

const VIN = "WBA8A71070K896936";

describe("prefetchDealerCheckCsdd", () => {
  it("no v/n aizpilda VIN un atgriež pilnu CSDD snapshot", async () => {
    mocks.fetchCsdd.mockResolvedValue({
      found: true,
      message: "BMW 320d",
      data: {
        ...emptyCsddTechData(),
        registrationNumber: "LR4521",
        vin: VIN,
        make: "BMW",
        model: "320d",
        year: "2016",
        fuel: "Dīzeļdegviela",
        firstRegistrationIso: "2016-03-12",
      },
    });
    const out = await prefetchDealerCheckCsdd({ plate: "lr-4521", vin: "" });
    expect(mocks.fetchCsdd).toHaveBeenCalledWith("LR4521", "admin");
    expect(out.vin).toBe(VIN);
    expect(out.plate).toBe("LR-4521");
    expect(out.csdd?.make).toBe("BMW");
    expect(out.csdd?.vin).toBe(VIN);
    expect(out.message).toBe("");
  });

  it("tukšs vaicājums CSDD nezvana", async () => {
    mocks.fetchCsdd.mockClear();
    const out = await prefetchDealerCheckCsdd({ plate: "", vin: "" });
    expect(mocks.fetchCsdd).not.toHaveBeenCalled();
    expect(out.csdd).toBeNull();
    expect(out.vin).toBe("");
  });
});
