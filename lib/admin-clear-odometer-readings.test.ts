import { describe, expect, it } from "vitest";
import {
  clearAutoRecordsOdometerReadings,
  clearCsddOdometerReadings,
  clearVendorOdometerReadings,
  clearVinRegistryOdometerReadings,
  countAutoRecordsOdometerReadings,
  countCsddOdometerReadings,
  countVendorOdometerReadings,
  countVinRegistryOdometerReadings,
} from "@/lib/admin-clear-odometer-readings";
import {
  createDefaultSourceBlocks,
  emptyAutoRecordsServiceRow,
  emptyCsddMileageRow,
  emptyVinRegistryMileageRow,
} from "@/lib/admin-source-blocks";

describe("clear odometer readings per source", () => {
  it("clears CSDD mileage only", () => {
    const csdd = {
      ...createDefaultSourceBlocks().csdd,
      makeModel: "AUDI Q4",
      comments: "paliek",
      mileageHistory: [{ date: "18.02.2025", odometer: "33378", country: "Beļģija" }],
    };
    expect(countCsddOdometerReadings(csdd)).toBe(1);
    const cleared = clearCsddOdometerReadings(csdd);
    expect(cleared.mileageHistory).toEqual([emptyCsddMileageRow()]);
    expect(cleared.makeModel).toBe("AUDI Q4");
    expect(cleared.comments).toBe("paliek");
    expect(countCsddOdometerReadings(cleared)).toBe(0);
  });

  it("clears vendor mileage and paste, keeps incidents", () => {
    const autodna = {
      ...createDefaultSourceBlocks().autodna,
      serviceHistory: [{ date: "16.07.2025", odometer: "35842", country: "Latvija" }],
      mileagePasteRaw: "Odometra rādījums 35842 km",
      incidents: [{ incidentNo: "LV", csngDate: "01.06.2024", lossAmount: "1200 €" }],
      comments: "AutoDNA piezīme",
    };
    expect(countVendorOdometerReadings(autodna)).toBe(2);
    const cleared = clearVendorOdometerReadings(autodna);
    expect(cleared.serviceHistory).toEqual([emptyAutoRecordsServiceRow()]);
    expect(cleared.mileagePasteRaw).toBe("");
    expect(cleared.incidents[0]?.lossAmount).toBe("1200 €");
    expect(cleared.comments).toBe("AutoDNA piezīme");
    expect(countVendorOdometerReadings(cleared)).toBe(0);
  });

  it("clears dealer mileage, keeps service works", () => {
    const dealer = {
      ...createDefaultSourceBlocks().auto_records,
      serviceHistory: [{ date: "13.06.2022", odometer: "0", country: "Beļģija" }],
      serviceWorks: [{ date: "15.05.2026", odometer: "45328", location: "Mārupe", works: "Apkope" }],
    };
    expect(countAutoRecordsOdometerReadings(dealer)).toBe(1);
    const cleared = clearAutoRecordsOdometerReadings(dealer);
    expect(cleared.serviceHistory).toEqual([emptyAutoRecordsServiceRow()]);
    expect(cleared.serviceWorks[0]?.works).toBe("Apkope");
    expect(countAutoRecordsOdometerReadings(cleared)).toBe(0);
  });

  it("clears VIN registry mileage, keeps incidents", () => {
    const tjekbil = {
      ...createDefaultSourceBlocks().tjekbil,
      mileage: [{ date: "2024-01-01", odometer: "100000", country: "Dānija", origin: "apskate" }],
      incidents: [{ date: "2023-01-01", amount: "500", country: "Dānija", note: "x" }],
    };
    expect(countVinRegistryOdometerReadings(tjekbil)).toBe(1);
    const cleared = clearVinRegistryOdometerReadings(tjekbil);
    expect(cleared.mileage).toEqual([emptyVinRegistryMileageRow()]);
    expect(cleared.incidents[0]?.amount).toBe("500");
    expect(countVinRegistryOdometerReadings(cleared)).toBe(0);
  });
});
