import { describe, expect, it } from "vitest";
import { decodeVin, vinCheckDigitValid, vinModelYears } from "@/lib/vin-decode";

const NOW = new Date("2026-10-28T00:00:00Z");

describe("decodeVin", () => {
  it("atpazīst Eiropas VW pēc WMI, kontrolciparu neprasa", () => {
    const r = decodeVin("WVWZZZ1KZ6W000001", NOW);
    expect(r).toMatchObject({ ok: true, wmi: "WVW", make: "Volkswagen", country: "DE", region: "europe", checkDigitValid: null });
    if (r.ok) expect(r.modelYears).toEqual([2006]);
  });

  it("10. zīme dod vairākus iespējamos gadus 30 gadu ciklā", () => {
    expect(vinModelYears("A", NOW)).toEqual([2010, 1980]);
    expect(vinModelYears("S", NOW)).toEqual([2025, 1995]);
    expect(vinModelYears("T", NOW)).toEqual([2026, 1996]);
    expect(vinModelYears("0", NOW)).toEqual([]);
  });

  it("Ziemeļamerikas VIN pārbauda kontrolciparu", () => {
    expect(vinCheckDigitValid("1M8GDM9AXKP042788")).toBe(true);
    expect(vinCheckDigitValid("1M8GDM9A1KP042788")).toBe(false);
    const r = decodeVin("1M8GDM9AXKP042788", NOW);
    expect(r).toMatchObject({ ok: true, region: "northAmerica", checkDigitValid: true, make: null });
  });

  it("nederīgs garums vai burti I, O, Q", () => {
    expect(decodeVin("WVWZZZ1KZ6W00000", NOW)).toEqual({ ok: false, error: "length" });
    expect(decodeVin("WVWZZZ1KZ6W00000O", NOW)).toEqual({ ok: false, error: "chars" });
  });

  it("normalizē atstarpes un mazos burtus", () => {
    expect(decodeVin(" wvw zzz1kz6w000001 ", NOW)).toMatchObject({ ok: true, vin: "WVWZZZ1KZ6W000001" });
  });
});
