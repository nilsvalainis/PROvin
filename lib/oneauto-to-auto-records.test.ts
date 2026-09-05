import { describe, expect, it } from "vitest";
import { emptyAutoRecordsBlock } from "@/lib/admin-source-blocks";
import { emptyOneautoBlock } from "@/lib/oneauto-block";
import { buildOneautoDisplay } from "@/lib/oneauto-catalog";
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
    expect(next.outvinReport?.vehicleInfo.vinCode).toBe("YV1TEST");
  });

  it("VIN Lookup oficiālos laukus liek transporta info, ne AI atliekās", () => {
    const { vehicleInfo, leftovers } = oneautoPowertrainToVehicleInfo([
      { label: "oem vehicle desc", value: "BMW X1 (E84) xDrive 20 d" },
      { label: "manufacturer desc", value: "BMW" },
      { label: "oem model range desc", value: "X1 (E84)" },
      { label: "oem derivative desc", value: "xDrive 20 d" },
      { label: "oem model year", value: "2013" },
      { label: "manufactured year", value: "2012" },
      { label: "oem colour desc", value: "Mineral-weiss metallic (A96)" },
      { label: "oem interior trim desc", value: "Leather" },
      { label: "power kw", value: "135" },
      { label: "power bhp", value: "184" },
      { label: "date last updated", value: "2025-09-23" },
    ]);
    expect(vehicleInfo.model).toBe("BMW X1 (E84) xDrive 20 d");
    expect(vehicleInfo.modelSeries).toBe("X1 (E84)");
    expect(vehicleInfo.productionDate).toBe("2012");
    expect(vehicleInfo.color).toBe("Mineral-weiss metallic");
    expect(vehicleInfo.colorCode).toBe("A96");
    expect(vehicleInfo.interior).toBe("Leather");
    expect(vehicleInfo.power).toBe("135 kW (184 ZS)");
    expect(leftovers.some((r) => r.label === "Modeļa gads" && r.value === "2013")).toBe(true);
    expect(leftovers.some((r) => /date last updated/i.test(r.label))).toBe(true);
    expect(leftovers.some((r) => /colour|interior|manufacturer|derivative/i.test(r.label))).toBe(false);
  });

  it("VIN Lookup JSON caur display iekrīt esošajos dīlera laukos", () => {
    const display = buildOneautoDisplay({
      vin_decoder: {
        result: {
          vehicle_identification_number: "WBAVL12090VX12345",
          oem_vehicle_desc: "BMW X1 (E84) xDrive 20 d",
          manufacturer_desc: "BMW",
          oem_model_range_desc: "X1 (E84)",
          oem_derivative_desc: "xDrive 20 d",
          oem_model_year: 2013,
          manufactured_year: 2012,
          oem_colour_desc: "Mineral-weiss metallic (A96)",
          oem_interior_trim_desc: "Leather",
          power_kw: 135,
          power_bhp: 184,
          date_last_updated: "2025-09-23",
          oem_engine_desc: "N47D20C",
          oem_transmission_type_desc: "automatic",
          oem_fuel_type_desc: "Diesel",
          oem_body_type_desc: "SUV",
          oem_drivetrain_desc: "AWD",
        },
      },
    });
    const next = applyOneautoToAutoRecords(emptyAutoRecordsBlock(), {
      display,
      ingest: { ...emptyOneautoIngest(), lastFetchedVin: "WBAVL12090VX12345" },
      vehicleOverride: true,
    });
    const info = next.outvinReport?.vehicleInfo;
    expect(info?.vinCode).toBe("WBAVL12090VX12345");
    expect(info?.model).toBe("BMW X1 (E84) xDrive 20 d");
    expect(info?.modelSeries).toBe("X1 (E84)");
    expect(info?.productionDate).toBe("2012");
    expect(info?.color).toBe("Mineral-weiss metallic");
    expect(info?.colorCode).toBe("A96");
    expect(info?.interior).toBe("Leather");
    expect(info?.power).toBe("135 kW (184 ZS)");
    expect(info?.engineCode).toBe("N47D20C");
    expect(info?.transmission).toBe("automatic");
    expect(info?.fuel).toBe("Diesel");
    expect(info?.body).toBe("SUV");
    expect(info?.drive).toBe("AWD");
    expect(next.aiContextRaw).toMatch(/Modeļa gads:\s*2013/);
    expect(next.aiContextRaw).toMatch(/2025-09-23/);
    expect(next.aiContextRaw).not.toMatch(/Mineral-weiss|Leather|BMW X1/i);
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
