import { describe, expect, it } from "vitest";
import { fillAutoparksFromStock, parseStockFolderName, parseStockInfoTxt } from "@/lib/iriss-autoparks-info-txt";

const SEP = " – ";
const INFO = `Volvo XC60 2.4 D5 Summum AWD — AUTO1 purchase 17.10.2026
Stock number: YE89130
VIN: YV1DZ8256D2439274 (licence plate per proforma: EN-TG3005)
Build year: 2013 | First registration: 07/2013 (26.07.2013)
Odometer: 355,756 km
Body: SUV, 5 doors, 5 seats | Colour: Silver (Original) | Upholstery: Leather (Original)
 TOTAL: 5,990.00 EUR
`;

const empty = { vin: "", make: "", model: "", year: "", color: "", mileageKm: null };

describe("info.txt un mapes nosaukums", () => {
  it("parsē mapes nosaukumu", () => {
    expect(parseStockFolderName(`Volvo XC60 2013 sudrabs${SEP}439274${SEP}A1`)).toEqual({ make: "Volvo", model: "XC60", year: "2013", color: "sudrabs" });
    expect(parseStockFolderName("Mercedes Sprinter 316 CDI 2012 sarkans - WDB9061331N534460 - Autobid 84073")).toMatchObject({ model: "Sprinter 316 CDI", vin: "WDB9061331N534460" });
    expect(parseStockFolderName("BMW IX40")).toEqual({});
  });

  it("parsē info.txt", () => {
    expect(parseStockInfoTxt(INFO)).toEqual({ vin: "YV1DZ8256D2439274", year: "2013", mileageKm: 355756, color: "Silver" });
  });

  it("aizpilda tikai tukšos laukus, mapes nosaukums pirms info.txt", () => {
    const patch = fillAutoparksFromStock({ ...empty, make: "Volvo", mileageKm: 350000 }, `Volvo XC60 2013 sudrabs${SEP}439274${SEP}A1`, INFO);
    expect(patch).toEqual({ vin: "YV1DZ8256D2439274", model: "XC60", year: "2013", color: "sudrabs" });
  });

  it("cita auto VIN info.txt -> neko neaizpilda", () => {
    expect(fillAutoparksFromStock({ ...empty, vin: "WAUZZZ8K0EA036715" }, `Volvo XC60 2013 sudrabs${SEP}439274${SEP}A1`, INFO)).toEqual({});
  });
});
