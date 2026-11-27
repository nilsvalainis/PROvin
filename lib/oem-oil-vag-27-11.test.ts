/** 27.11.2026 (WVWZZZ3CZNE054721): VAG LongLife noklusējums 30 000 km / 24 mēn., lai pārsniegtam solim ir piebilde. */
import { describe, expect, it } from "vitest";
import { defaultOemOilIntervalForVehicle } from "@/lib/oem-oil-interval";

describe("VAG LongLife OEM noklusējums", () => {
  it("Passat B8 2.0 TDI (WVW, 2022, dīzelis) -> 30 000 km / 24 mēn.", () => {
    expect(defaultOemOilIntervalForVehicle({ vin: "WVWZZZ3CZNE054721", fuel: ["diesel"], engineCodes: ["DTSA"] })).toEqual({
      km: 30_000,
      kmMin: null,
      months: 24,
    });
  });
  it("Audi / Škoda / SEAT benzīns arī; marka no apraksta, ja VIN WMI cits", () => {
    expect(defaultOemOilIntervalForVehicle({ vin: "WAUZZZF43PA018831", fuel: ["Benzīns"] })?.km).toBe(30_000);
    expect(defaultOemOilIntervalForVehicle({ vin: "TMBJJ7NE5L0123456", fuel: ["petrol"] })?.km).toBe(30_000);
    expect(defaultOemOilIntervalForVehicle({ vin: "XXXZZZ5FZLW000001", descriptions: ["SEAT Leon"], fuel: ["diesel"] })?.km).toBe(30_000);
  });
  it("nav noklusējuma: elektro / hibrīds, nezināma degviela, pirms 2010, cita marka", () => {
    expect(defaultOemOilIntervalForVehicle({ vin: "WVWZZZE1ZMP000001", fuel: ["electric"] })).toBeNull();
    expect(defaultOemOilIntervalForVehicle({ vin: "WVWZZZ3CZNE054721", fuel: ["hybrid (diesel)"] })).toBeNull();
    expect(defaultOemOilIntervalForVehicle({ vin: "WVWZZZ3CZNE054721", fuel: [] })).toBeNull();
    expect(defaultOemOilIntervalForVehicle({ vin: "WVWZZZ3CZ8E000001", fuel: ["diesel"] })).toBeNull();
    expect(defaultOemOilIntervalForVehicle({ vin: "VF1RFB00X56789012", fuel: ["diesel"] })).toBeNull();
  });
  it("BMW dīzelis paliek kā bija", () => {
    expect(defaultOemOilIntervalForVehicle({ vin: "WBA5R1C0XLFH42873", fuel: ["diesel"] })?.months).toBe(24);
  });
});

describe("VW dīlera saīsinājumi «MANU» / «UNIVERS»", () => {
  it("tulkoti visās valodās", async () => {
    const { translateDealerVehicleValue } = await import("@/lib/dealer-vehicle-value-i18n");
    expect(translateDealerVehicleValue("transmission", "MANU", "lv")).toBe("mehāniskā");
    expect(translateDealerVehicleValue("body", "UNIVERS", "lv")).toBe("universālis");
    expect(translateDealerVehicleValue("vehicleType", "UNIVERS", "de")).toBe("Kombi");
    expect(translateDealerVehicleValue("transmission", "MANU", "en")).toBe("manual");
  });
});
