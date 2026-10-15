import { describe, expect, it } from "vitest";
import { irissVinCheckDigitOk, irissVinWarning, normalizeIrissVin } from "@/lib/iriss-vin-check";

describe("irissVinWarning", () => {
  it("ignores an empty field", () => {
    expect(irissVinWarning("")).toBeNull();
    expect(irissVinWarning("   ")).toBeNull();
  });

  it("warns when length is not 17", () => {
    expect(irissVinWarning("WVWZZZ")).toBe("VIN parasti ir 17 rakstzīmes.");
    expect(irissVinWarning("WVWZZZ1JZ3W386752EXTRA")).toBe("VIN parasti ir 17 rakstzīmes.");
  });

  it("warns on I/O/Q", () => {
    expect(irissVinWarning("WVWZZZ1JZ3W38675O")).toContain("I, O vai Q");
    expect(irissVinWarning("1HGCM82633A004352".replace("H", "I"))).toContain("I, O vai Q");
  });

  it("accepts a VIN with a valid check digit", () => {
    expect(normalizeIrissVin(" 1hg cm82633a004352 ")).toBe("1HGCM82633A004352");
    expect(irissVinCheckDigitOk("1HGCM82633A004352")).toBe(true);
    expect(irissVinWarning("1HGCM82633A004352")).toBeNull();
  });

  it("warns when the check digit does not match", () => {
    expect(irissVinCheckDigitOk("1HGCM82633A004353")).toBe(false);
    expect(irissVinWarning("1HGCM82633A004353")).toBe("VIN kontrolcipars nesakrīt. Pārbaudi pārrakstīšanu.");
  });
});
