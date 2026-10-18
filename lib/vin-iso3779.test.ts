import { describe, expect, it } from "vitest";
import {
  extractIso3779VinsFromText,
  extractVinCandidatesFromText,
  hasIso3779CheckDigit,
  iso3779CheckDigit,
  isIsoVinAlphabet17,
  vinNeedsCheckDigitWarning,
  vinOcrAlphabetVariants,
} from "@/lib/vin-iso3779";

const HONDA = "1HGCM82633A004352";
const BMW = "WBAZZZ8V0K1237731";

describe("ISO 3779 check digit", () => {
  it("accepts known 17-char VINs", () => {
    expect(iso3779CheckDigit(HONDA)).toBe("3");
    expect(hasIso3779CheckDigit(HONDA)).toBe(true);
    expect(iso3779CheckDigit(BMW)).toBe("0");
    expect(hasIso3779CheckDigit(BMW)).toBe(true);
  });

  it("rejects a 17-char string with a wrong check digit", () => {
    expect(hasIso3779CheckDigit("WBAZZZ8V1K1237731")).toBe(false);
    expect(hasIso3779CheckDigit("1HGCM82633A004352".slice(0, 16))).toBe(false);
    expect(vinNeedsCheckDigitWarning("WBAZZZ8V1K1237731")).toBe(true);
    expect(vinNeedsCheckDigitWarning(HONDA)).toBe(false);
    expect(vinNeedsCheckDigitWarning("W0VZCYHZXN684325")).toBe(false);
  });

  it("pulls a VIN from registration-like OCR text, including O/I noise", () => {
    const text = `FAHRZEUGBRIEF\nVIN: WBAZZZ8V0K1237731\nErstzulassung 01.2010`;
    expect(extractIso3779VinsFromText(text)).toEqual([BMW]);
    const noisy = "WBAZZZ8VOK1237731";
    expect(vinOcrAlphabetVariants(noisy)).toContain(BMW);
    expect(extractIso3779VinsFromText(`Identifikationsnummer ${noisy}`)).toContain(BMW);
  });

  it("does not treat random 17-char codes as VINs", () => {
    expect(extractIso3779VinsFromText("ABCDEFGHJKLMNPRST")).toEqual([]);
  });

  it("keeps a 17-char alphabet candidate without a check digit", () => {
    const wrong = "WBAZZZ8V1K1237731";
    expect(isIsoVinAlphabet17(wrong)).toBe(true);
    expect(hasIso3779CheckDigit(wrong)).toBe(false);
    expect(extractVinCandidatesFromText(`Ident ${wrong}`)).toEqual([wrong]);
    expect(extractIso3779VinsFromText(`Ident ${wrong}`)).toEqual([]);
  });
});
