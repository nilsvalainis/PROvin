/**
 * Nils 25.11: laikposma joslā («Vēstures kopsavilkums») jābūt VISĀM apskatēm - arī neizturētajām
 * (vērtējums 2) un atkārtotajām tajā pašā mēnesī, kā arī ārvalstu (Austrijas §57a) apskatēm.
 * Dati izdomāti.
 */
import { describe, expect, it } from "vitest";
import { emptyCsddFields, type ClientManualVendorBlockPdf } from "@/lib/admin-source-blocks";
import { vendorTimelineRowDefaultInPdf } from "@/lib/carvertical-pdf-parse";
import { applyKfzAtToCitiAvoti } from "@/lib/kfzgutachten/apply-citi";
import type { KfzGutachtenReport } from "@/lib/kfzgutachten/parse-gutachten";
import { buildVehicleLifecycleEvents, INSPECTION_REPEAT_MARK } from "@/lib/vehicle-lifecycle-timeline";

function ta(date: string, rating: string, level: 1 | 2 | 3 | null, type: string) {
  return {
    date,
    inspectionType: type,
    ratingLabel: rating,
    ratingLevel: level,
    maxDefectLevel: null,
    smokeCoefficient: "",
    notes: "",
    defects: [],
  };
}

const csdd = {
  ...emptyCsddFields(),
  mileageHistory: [
    { date: "05.03.2024", odometer: "201000", country: "Latvija" },
    { date: "26.03.2024", odometer: "201150", country: "Latvija" },
  ],
  technicalInspectionHistory: [
    ta("26.03.2024", "0 - Teicamā tehniskā stāvoklī", null, "atkārtota pārbaude"),
    ta("05.03.2024", "2 - Ar mēneša laikā labojamiem defektiem", 2, "pamatpārbaude"),
  ],
};

const vendorBlocks: ClientManualVendorBlockPdf[] = [
  {
    title: "AutoDNA",
    mileageRows: [],
    incidentRows: [],
    comments: "",
    vehicleHistoryTimeline: [
      { date: "05.03.2024", country: "Latvija", description: "Veikta tehniskā apskate: Neizgāja", includeInPdf: true },
      { date: "26.03.2024", country: "Latvija", description: "Veikta tehniskā apskate: Izgāja", includeInPdf: true },
    ],
  },
  {
    title: "CarVertical",
    mileageRows: [],
    incidentRows: [],
    comments: "",
    vehicleHistoryTimeline: [
      { date: "01.03.2024", country: "Latvija", description: "Veikta tehniskā apskate", includeInPdf: true },
    ],
  },
] as ClientManualVendorBlockPdf[];

function kfzReport(): KfzGutachtenReport {
  return {
    gutachtenNr: "TEST-1",
    date: "14.06.2019",
    odometerKm: "150000",
    plate: "W-TEST1",
    make: "TEST",
    type: "",
    vin: "",
    displacementCcm: "",
    vehicleClass: "",
    firstRegistration: "",
    overall: "major",
    overallDe: "schwere Mängel",
    plaketteColor: "",
    nextInspection: "",
    previous: { gutachtenNr: "TEST-0", date: "10.06.2018", odometerKm: "131000" },
    findings: [],
  };
}

describe("laikposma josla - visas tehniskās apskates", () => {
  it("2 apskates vienā mēnesī (vērtējums 2 -> atkārtota) ir divas kartītes", () => {
    const events = buildVehicleLifecycleEvents({ csddForm: csdd, manualVendorBlocks: vendorBlocks });
    const insp = events.filter((e) => e.kind === "inspection");
    expect(insp.map((e) => e.date)).toEqual(["05.03.2024", "26.03.2024"]);
    const [failed, repeat] = insp;
    expect(failed!.detail).toBe("2 - Ar mēneša laikā labojamiem defektiem");
    expect(failed!.tone).toBe("warn");
    expect(failed!.odometer).toBe("201000");
    expect(failed!.sources).toEqual(expect.arrayContaining(["CSDD", "AutoDNA", "CarVertical"]));
    expect(repeat!.detail).toBe(`0 - Teicamā tehniskā stāvoklī · ${INSPECTION_REPEAT_MARK}`);
    expect(repeat!.tone).toBe("info");
    expect(repeat!.odometer).toBe("201150");
    // CarVertical mēneša rinda nepaliek kā trešā kartīte.
    expect(insp).toHaveLength(2);
  });

  it("vērtējums no teksta, ja ratingLevel nav saglabāts", () => {
    const events = buildVehicleLifecycleEvents({
      csddForm: {
        ...emptyCsddFields(),
        technicalInspectionHistory: [ta("11.02.2025", "3 - Bīstami", null, "pamatpārbaude")],
      },
    });
    expect(events.find((e) => e.kind === "inspection")?.tone).toBe("warn");
  });

  it("Austrijas §57a apskates (kfzgutachten.at) ir laikjoslā hronoloģiski ar LV apskatēm", () => {
    const citi = applyKfzAtToCitiAvoti(null, { reports: [kfzReport()] }).block;
    const events = buildVehicleLifecycleEvents({ csddForm: csdd, manualVendorBlocks: vendorBlocks, citiAvoti: citi });
    const insp = events.filter((e) => e.kind === "inspection");
    expect(insp.map((e) => `${e.date} ${e.country}`)).toEqual([
      "10.06.2018 Austrija",
      "14.06.2019 Austrija",
      "05.03.2024 Latvija",
      "26.03.2024 Latvija",
    ]);
    const at = insp[1]!;
    expect(at.detail).toBe("neatbilst - būtiski trūkumi");
    expect(at.tone).toBe("warn");
    expect(at.odometer).toBe("150000");
  });

  it("ielasot apskates rindas ir PDF ieslēgtas, pārējās izslēgtas", () => {
    expect(vendorTimelineRowDefaultInPdf("Veikta tehniskā apskate: Neizgāja")).toBe(true);
    expect(vendorTimelineRowDefaultInPdf("Periodisk syn")).toBe(true);
    expect(vendorTimelineRowDefaultInPdf("Reģistrēts")).toBe(false);
    expect(vendorTimelineRowDefaultInPdf("Mainītas īpašumtiesības")).toBe(false);
  });

  it("operatora izslēgta apskates rinda laikjoslā nenonāk", () => {
    const events = buildVehicleLifecycleEvents({
      manualVendorBlocks: [
        {
          ...vendorBlocks[0]!,
          vehicleHistoryTimeline: [
            { date: "05.03.2024", country: "Latvija", description: "Veikta tehniskā apskate: Neizgāja", includeInPdf: false },
          ],
        },
      ],
    });
    expect(events.filter((e) => e.kind === "inspection")).toHaveLength(0);
  });
});
