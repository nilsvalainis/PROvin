import { describe, expect, it } from "vitest";
import { parseCarinfoPastedText } from "@/lib/vin-sources/carinfo-parse";

describe("parseCarinfoPastedText", () => {
  it("reads mileage rows with dates, km and country from copied page text", () => {
    const parsed = parseCarinfoPastedText(`
Mileage history
2024-03-12  145 230 km  Sweden
19.09.2023  128400 km Denmark
Taxi
Number of owners: 3
`);
    expect(parsed.found).toBe(true);
    expect(parsed.mileage).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ date: "2024-03-12", odometer: "145230", country: "Zviedrija" }),
        expect.objectContaining({ date: "2023-09-19", odometer: "128400", country: "Dānija" }),
      ]),
    );
    expect(parsed.notes.some((n) => /TAKSOMETRS/.test(n))).toBe(true);
  });

  it("returns empty when paste has no dates or odometer", () => {
    const parsed = parseCarinfoPastedText("Login / Signup\nCar.info Sweden");
    expect(parsed.found).toBe(false);
    expect(parsed.mileage).toEqual([]);
  });
});
