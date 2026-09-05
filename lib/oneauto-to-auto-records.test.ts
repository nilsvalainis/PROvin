import { describe, expect, it } from "vitest";
import { emptyAutoRecordsBlock } from "@/lib/admin-source-blocks";
import { emptyOneautoBlock } from "@/lib/oneauto-block";
import { emptyOutvinVehicleInfo } from "@/lib/outvin-dealer-types";
import {
  applyOneautoToAutoRecords,
  emptyOneautoIngest,
  foldOneautoBlockIntoAutoRecords,
  oneautoDisplayToEquipment,
  oneautoPowertrainToVehicleInfo,
} from "@/lib/oneauto-to-auto-records";

describe("OneAuto → OFICIĀLĀ DĪLERA DATI", () => {
  it("mapē dzinēju, degvielu un tilpumu uz transporta info", () => {
    const { vehicleInfo, leftovers } = oneautoPowertrainToVehicleInfo([
      { label: "oem_engine_desc", value: "D4204T14" },
      { label: "oem_transmission_type_desc", value: "automatic" },
      { label: "fuel", value: "Diesel" },
      { label: "displacement", value: "1969" },
      { label: "unknown_flag", value: "X" },
    ]);
    expect(vehicleInfo.engineCode).toBe("D4204T14");
    expect(vehicleInfo.transmission).toBe("automatic");
    expect(vehicleInfo.fuel).toBe("Diesel");
    expect(vehicleInfo.displacement).toBe("1969");
    expect(leftovers).toEqual([{ label: "unknown_flag", value: "X" }]);
  });

  it("komplektāciju liek kā kods + apraksts", () => {
    expect(
      oneautoDisplayToEquipment({
        equipment: [{ label: "Panoramic roof", value: "PR3L" }],
        powertrain: [],
        serviceTimeline: [],
      }),
    ).toEqual([{ code: "PR3L", description: "Panoramic roof" }]);
  });

  it("darbus un km liek vecajos laukos, vietu ar lielo burtu", () => {
    const next = applyOneautoToAutoRecords(emptyAutoRecordsBlock(), {
      display: {
        equipment: [],
        powertrain: [{ label: "Engine", value: "D4204T14" }],
        serviceTimeline: [
          {
            date: "2020-12-23",
            odometer: "142220",
            place: "d.velop AG - Office Space, Sutthauser Straße 287, 49080 Osnabrück, Germany",
            works: "oil service; cabin filter",
          },
        ],
      },
      ingest: { ...emptyOneautoIngest(), lastFetchedVin: "YV1TEST" },
      vehicleOverride: true,
    });
    expect(next.outvinReport?.vehicleInfo.engineCode).toBe("D4204T14");
    expect(next.serviceWorks[0]?.date).toBe("23.12.2020");
    expect(next.serviceWorks[0]?.location).toMatch(/^D\.velop/);
    expect(next.serviceWorks[0]?.works).toMatch(/Oil service/i);
    expect(next.serviceHistory[0]?.odometer).toBe("142220");
    expect(next.serviceHistory[0]?.country).toBe("Vācija");
    expect(next.oneautoIngest?.lastFetchedVin).toBe("YV1TEST");
  });

  it("nepazaudē jau aizpildītu ātrumkārbu, ja API nav precīzāka", () => {
    const base = emptyAutoRecordsBlock();
    base.outvinReport = {
      vehicleInfo: { ...emptyOutvinVehicleInfo(), transmission: "Automātiskā" },
      accidentCheck: "",
      stolenCheck: "",
      equipment: [],
    };
    const next = applyOneautoToAutoRecords(base, {
      display: {
        equipment: [],
        powertrain: [{ label: "transmission", value: "auto" }],
        serviceTimeline: [],
      },
      ingest: emptyOneautoIngest(),
      vehicleOverride: false,
    });
    expect(next.outvinReport?.vehicleInfo.transmission).toBe("Automātiskā");
  });

  it("hidratējot veco oneauto bloku, iztukšo to pēc pārneses", () => {
    const oa = emptyOneautoBlock();
    oa.display = {
      equipment: [{ label: "Panoramic roof", value: "PR3L" }],
      powertrain: [{ label: "fuel", value: "Petrol" }],
      serviceTimeline: [{ date: "23.12.2020", odometer: "142220", place: "Volvo", works: "Eļļas maiņa" }],
    };
    oa.lastFetchedVin = "YV1";
    const folded = foldOneautoBlockIntoAutoRecords(emptyAutoRecordsBlock(), oa);
    expect(folded.oneauto.lastFetchedVin).toBe("");
    expect(folded.autoRecords.outvinReport?.vehicleInfo.fuel).toBe("Petrol");
    expect(folded.autoRecords.outvinReport?.equipment[0]?.code).toBe("PR3L");
    expect(folded.autoRecords.serviceWorks[0]?.works).toContain("Eļļas maiņa");
    expect(foldOneautoBlockIntoAutoRecords(folded.autoRecords, folded.oneauto).autoRecords.serviceWorks).toEqual(
      folded.autoRecords.serviceWorks,
    );
  });
});
