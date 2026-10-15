import { describe, expect, it } from "vitest";

import { iso3779CheckDigit, vinCheckDigitOk, vinScanFormatHint } from "@/lib/vin-scan/vin-check";
import { isValidScanPlate, parseVinScanPlates } from "@/lib/vin-scan/plates";

describe("VIN kontrolcipars", () => {
  it("ISO 3779 17 zīmēm", () => {
    expect(iso3779CheckDigit("1M8GDM9AXKP042788")).toBe("X");
    expect(vinCheckDigitOk("1M8GDM9AXKP042788")).toBe(true);
    expect(vinCheckDigitOk("1M8GDM9A0KP042788")).toBe(false);
    expect(vinScanFormatHint("1M8GDM9A0KP042788").warning).toContain("kontrolcipars");
    expect(vinScanFormatHint("WBA5R1C0").ok).toBe(false);
  });
});

describe("VIN SCAN numuri", () => {
  it("pieņem LV 6 zīmes un UK 7 zīmes", () => {
    expect(isValidScanPlate("lv", "NG8493")).toBe(true);
    expect(isValidScanPlate("uk", "AB12CDE")).toBe(true);
    expect(isValidScanPlate("nl", "G-123-BB")).toBe(true);
    expect(isValidScanPlate("lt", "ABC123")).toBe(true);
    expect(isValidScanPlate("fi", "ABC-123")).toBe(true);
    expect(isValidScanPlate("se", "BMX837")).toBe(true);
    expect(isValidScanPlate("se", "ABC12A")).toBe(true);
    expect(isValidScanPlate("se", "AB12")).toBe(false);
    expect(parseVinScanPlates({ lv: "ng-8493", uk: "ab12 cde", se: "bmx 837" })).toMatchObject({
      lv: "NG8493",
      uk: "AB12CDE",
      se: "BMX837",
    });
  });
});
