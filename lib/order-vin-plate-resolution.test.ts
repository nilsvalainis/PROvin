import { describe, expect, it } from "vitest";
import {
  classifyOrderVinOrPlateInput,
  orderVinPlateResolutionIsFailed,
  parseOrderVinPlateResolution,
  VIN_PLATE_RESOLVE_FAILED_LABEL,
} from "@/lib/order-vin-plate-resolution";

describe("classifyOrderVinOrPlateInput", () => {
  it("17 zīmju VIN ir VIN, arī ar atstarpēm un VIN: prefiksu", () => {
    expect(classifyOrderVinOrPlateInput("WVWZZZ1JZ3W386752")).toEqual({
      kind: "vin",
      vin: "WVWZZZ1JZ3W386752",
    });
    expect(classifyOrderVinOrPlateInput(" vin: wvw zzz1jz3w386752 ")).toEqual({
      kind: "vin",
      vin: "WVWZZZ1JZ3W386752",
    });
  });

  it("LV numurzīme (2 burti + cipari vai 3 burti + cipari) ir plate", () => {
    expect(classifyOrderVinOrPlateInput("KG982")).toEqual({ kind: "plate", plate: "KG982" });
    expect(classifyOrderVinOrPlateInput("ab-1234")).toEqual({ kind: "plate", plate: "AB1234" });
    expect(classifyOrderVinOrPlateInput("ABC 12")).toEqual({ kind: "plate", plate: "ABC12" });
  });

  it("tukšs, nepilns VIN un dīlera stila B193-7 nav VIN un nav LV numurzīme", () => {
    expect(classifyOrderVinOrPlateInput("")).toEqual({ kind: "invalid" });
    expect(classifyOrderVinOrPlateInput("WVWZZZ1JZ3W38675")).toEqual({ kind: "invalid" });
    expect(classifyOrderVinOrPlateInput("B193-7")).toEqual({ kind: "invalid" });
    expect(classifyOrderVinOrPlateInput("WVWZZZ1KZ6W00000O")).toEqual({ kind: "invalid" });
  });
});

describe("parseOrderVinPlateResolution", () => {
  it("pieņem pending / resolved / failed ar normalizētu numuru", () => {
    expect(
      parseOrderVinPlateResolution({
        plate: "kg-982",
        status: "resolved",
        updatedAt: "2026-10-29T10:00:00.000Z",
      }),
    ).toEqual({
      plate: "KG982",
      status: "resolved",
      updatedAt: "2026-10-29T10:00:00.000Z",
    });
    expect(
      parseOrderVinPlateResolution({
        plate: "AB1234",
        status: "failed",
        message: VIN_PLATE_RESOLVE_FAILED_LABEL,
        updatedAt: "2026-10-29T11:00:00.000Z",
      })?.status,
    ).toBe("failed");
  });

  it("noraida bez numura, bez laika vai ar svešu statusu", () => {
    expect(parseOrderVinPlateResolution(null)).toBeNull();
    expect(parseOrderVinPlateResolution({ plate: "KG982", status: "resolved" })).toBeNull();
    expect(
      parseOrderVinPlateResolution({
        plate: "",
        status: "pending",
        updatedAt: "2026-10-29T10:00:00.000Z",
      }),
    ).toBeNull();
    expect(
      parseOrderVinPlateResolution({
        plate: "KG982",
        status: "done",
        updatedAt: "2026-10-29T10:00:00.000Z",
      }),
    ).toBeNull();
  });
});

describe("orderVinPlateResolutionIsFailed", () => {
  it("tikai failed", () => {
    expect(orderVinPlateResolutionIsFailed(undefined)).toBe(false);
    expect(
      orderVinPlateResolutionIsFailed({
        plate: "KG982",
        status: "pending",
        updatedAt: "2026-10-29T10:00:00.000Z",
      }),
    ).toBe(false);
    expect(
      orderVinPlateResolutionIsFailed({
        plate: "KG982",
        status: "failed",
        updatedAt: "2026-10-29T10:00:00.000Z",
      }),
    ).toBe(true);
  });
});
