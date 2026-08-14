import { describe, expect, it } from "vitest";
import {
  clearAllOdometerReadings,
  countOdometerReadings,
} from "@/lib/admin-clear-odometer-readings";
import {
  createDefaultSourceBlocks,
  emptyAutoRecordsServiceRow,
  emptyCsddMileageRow,
  emptyLtabRow,
  emptyVinRegistryMileageRow,
} from "@/lib/admin-source-blocks";

describe("clearAllOdometerReadings", () => {
  it("clears mileage tables and paste journals across sources, keeps incidents and comments", () => {
    const blocks = createDefaultSourceBlocks();
    blocks.csdd.mileageHistory = [{ date: "18.02.2025", odometer: "33378", country: "Beļģija" }];
    blocks.csdd.makeModel = "AUDI Q4";
    blocks.csdd.comments = "CSDD piezīme";
    blocks.autodna.serviceHistory = [{ date: "16.07.2025", odometer: "35842", country: "Latvija" }];
    blocks.autodna.mileagePasteRaw = "Odometra rādījums 35842 km";
    blocks.autodna.incidents = [{ incidentNo: "LV", csngDate: "01.06.2024", lossAmount: "1200 €" }];
    blocks.autodna.comments = "AutoDNA piezīme";
    blocks.carvertical.serviceHistory = [{ date: "00.05.2025", odometer: "35519", country: "Beļģija" }];
    blocks.carvertical.vehicleHistoryTimeline = [
      { date: "00.05.2022", country: "Beļģija", description: "Pirmā reģistrācija" },
    ];
    blocks.auto_records.serviceHistory = [{ date: "13.06.2022", odometer: "0", country: "Beļģija" }];
    blocks.auto_records.serviceWorks = [
      { date: "15.05.2026", odometer: "45328", location: "Mārupe", works: "Apkope" },
    ];
    blocks.tjekbil.mileage = [{ date: "2024-01-01", odometer: "100000", country: "Dānija", origin: "apskate" }];
    blocks.tjekbil.incidents = [{ date: "2023-01-01", amount: "500", country: "Dānija", note: "x" }];
    blocks.citi_avoti.sections = [
      {
        serviceHistory: [{ date: "01.01.2020", odometer: "10", country: "Vācija" }],
        incidents: [emptyLtabRow()],
        comments: "cits",
        geminiContextRaw: "",
        mileagePasteRaw: "km paste",
        label: "CAR.INFO",
        rawUnprocessedData: "RAW paliek",
      },
    ];

    expect(countOdometerReadings(blocks)).toBeGreaterThan(5);

    const cleared = clearAllOdometerReadings(blocks);

    expect(cleared.csdd.mileageHistory).toEqual([emptyCsddMileageRow()]);
    expect(cleared.csdd.makeModel).toBe("AUDI Q4");
    expect(cleared.csdd.comments).toBe("CSDD piezīme");
    expect(cleared.autodna.serviceHistory).toEqual([emptyAutoRecordsServiceRow()]);
    expect(cleared.autodna.mileagePasteRaw).toBe("");
    expect(cleared.autodna.incidents[0]?.lossAmount).toBe("1200 €");
    expect(cleared.autodna.comments).toBe("AutoDNA piezīme");
    expect(cleared.carvertical.serviceHistory).toEqual([emptyAutoRecordsServiceRow()]);
    expect(cleared.carvertical.vehicleHistoryTimeline?.[0]?.description).toBe("Pirmā reģistrācija");
    expect(cleared.auto_records.serviceHistory).toEqual([emptyAutoRecordsServiceRow()]);
    expect(cleared.auto_records.serviceWorks[0]?.works).toBe("Apkope");
    expect(cleared.tjekbil.mileage).toEqual([emptyVinRegistryMileageRow()]);
    expect(cleared.tjekbil.incidents[0]?.amount).toBe("500");
    expect(cleared.citi_avoti.sections[0]?.serviceHistory).toEqual([emptyAutoRecordsServiceRow()]);
    expect(cleared.citi_avoti.sections[0]?.mileagePasteRaw).toBe("");
    expect(cleared.citi_avoti.sections[0]?.rawUnprocessedData).toBe("RAW paliek");
    expect(cleared.citi_avoti.sections[0]?.label).toBe("CAR.INFO");
    expect(countOdometerReadings(cleared)).toBe(0);
  });
});
