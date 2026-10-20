import { describe, expect, it } from "vitest";
import { rigaLocalToUtc } from "@/lib/iriss-pavadzimes-parse";
import {
  compactDealerPlate,
  dealerPlateMeta,
  displayDealerPlate,
  emptyWaybillPlateStates,
  formatRigaDateTimeComma,
  isAllowlistedWaybillPlate,
  waybillPlateOccupancy,
} from "@/lib/iriss-waybill-plates";

describe("IRISS dealer plates", () => {
  it("allowlists only the three trading numbers", () => {
    expect(displayDealerPlate("B193-7")).toBe("B193-7");
    expect(displayDealerPlate("b7627")).toBe("B762-7");
    expect(displayDealerPlate("B 192-7")).toBe("B192-7");
    expect(displayDealerPlate("B861-6")).toBe("");
    expect(compactDealerPlate("B193-7")).toBe("B1937");
    expect(isAllowlistedWaybillPlate("B861-6")).toBe(false);
    expect(isAllowlistedWaybillPlate("AB-1234")).toBe(false);
    expect(isAllowlistedWaybillPlate("WVWZZZ3CZE1234567")).toBe(false);
    expect(emptyWaybillPlateStates().map((row) => row.plate)).toEqual(["B193-7", "B762-7", "B192-7"]);
    expect(dealerPlateMeta("B193-7")).toEqual({ owner: "SIA ĪRISS", bottomText: "SIA ĪRISS" });
    expect(dealerPlateMeta("B192-7")).toEqual({ owner: "SIA Dzintarzeme Auto", bottomText: "Dzintarzeme auto" });
    expect(dealerPlateMeta("B192-7").bottomText).not.toMatch(/371|\+/);
  });

  it("marks a plate busy only while the latest waybill is still valid", () => {
    const now = rigaLocalToUtc(2026, 10, 20, 16, 50)!;
    const rows = [
      {
        number: "P02799",
        plate: "B1937",
        brandModel: "Volvo V50",
        validUntil: rigaLocalToUtc(2026, 10, 22, 15, 59)!.toISOString(),
        issuedAt: rigaLocalToUtc(2026, 10, 18, 15, 59)!.toISOString(),
      },
      {
        number: "P01000",
        plate: "B193-7",
        brandModel: "old",
        validUntil: rigaLocalToUtc(2026, 9, 1, 12, 0)!.toISOString(),
        issuedAt: rigaLocalToUtc(2026, 8, 20, 12, 0)!.toISOString(),
      },
      {
        number: "P02800",
        plate: "B762-7",
        brandModel: "VW Passat",
        validUntil: rigaLocalToUtc(2026, 10, 19, 10, 0)!.toISOString(),
        issuedAt: rigaLocalToUtc(2026, 10, 17, 10, 0)!.toISOString(),
      },
    ];
    const occ = waybillPlateOccupancy(rows, now);
    expect(occ[0]).toMatchObject({
      plate: "B193-7",
      busy: true,
      current: { number: "P02799", brandModel: "Volvo V50" },
    });
    expect(occ[1]).toMatchObject({ plate: "B762-7", busy: false });
    expect(occ[2]).toMatchObject({ plate: "B192-7", busy: false });
  });

  it("formats Europe/Riga wall time with a comma", () => {
    expect(formatRigaDateTimeComma("2026-10-22T12:59:00.000Z")).toBe("22.10.2026, 15:59");
  });
});
