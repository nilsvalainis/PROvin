import { describe, expect, it } from "vitest";

import { mergeSourceBlocksWithDefaults, type WorkspaceSourceBlocks } from "@/lib/admin-source-blocks";
import { emptyOutvinVehicleInfo } from "@/lib/outvin-dealer-types";
import {
  checkSourceConsistency,
  countSourceIssues,
  criticalSourceIssues,
  formatSourceIssueLine,
  type SourceIssue,
} from "@/lib/source-consistency";
import type { ThecarapiAdminRecord } from "@/lib/vin-scan/thecarapi-fields";

/** Anonimizēti paraugi (bez VIN / numuriem / personām) pēc 23.11 gadījumiem. */
const NOW = Date.UTC(2026, 10, 24);

function blocks(patch: Record<string, unknown>): WorkspaceSourceBlocks {
  return mergeSourceBlocksWithDefaults(patch as unknown);
}

function csdd(extra: Record<string, unknown> = {}) {
  return {
    makeModel: "AUDI A4",
    registrationNumber: "XX0000",
    firstRegistration: "2018-03-10",
    fuelType: "Dīzeļdegviela",
    enginePowerKw: "140",
    engineDisplacementCm3: "1968",
    ...extra,
  };
}

function lot(fields: Record<string, string>, extra: Partial<ThecarapiAdminRecord> = {}): ThecarapiAdminRecord {
  return {
    site: "openlane",
    id: "1000001",
    date: "2026-10-01",
    venue: "Openlane",
    photoDate: "",
    photoUrls: [],
    fields: Object.entries(fields).map(([key, value]) => ({ key, label: key, value })),
    raw: null,
    rawHistory: null,
    rawDetail: null,
    rawImages: null,
    photos: [],
    ...extra,
  };
}

function run(patch: Record<string, unknown>, texts: { label: string; text: string }[] = []): SourceIssue[] {
  return checkSourceConsistency({ sourceBlocks: blocks(patch), texts, nowMs: NOW });
}

function kinds(issues: SourceIssue[]): string[] {
  return issues.map((i) => `${i.kind}:${i.severity}`);
}

describe("checkSourceConsistency - nobraukums", () => {
  it("vēlāks rādījums citā avotā ievērojami mazāks - kritisks", () => {
    const issues = run({
      csdd: csdd({
        mileageHistory: [
          { date: "15.06.2021", odometer: "180000", country: "Latvija" },
          { date: "10.05.2019", odometer: "120000", country: "Latvija" },
        ],
      }),
      carvertical: { serviceHistory: [{ date: "01.09.2022", odometer: "150000", country: "Latvija" }] },
    });
    const drop = issues.find((i) => i.kind === "mileage_drop");
    expect(drop?.severity).toBe("critical");
    expect(formatSourceIssueLine(drop!)).toContain("180 000 km");
    expect(formatSourceIssueLine(drop!)).toContain("150 000 km");
  });

  it("kritums, kas jau ir viena avota iekšienē (pārkopēts citos), nav avotu pretruna", () => {
    const issues = run({
      csdd: csdd({
        mileageHistory: [
          { date: "11.09.2018", odometer: "228276", country: "Latvija" },
          { date: "15.06.2016", odometer: "235342", country: "Latvija" },
        ],
      }),
      autodna: {
        serviceHistory: [
          { date: "15.06.2016", odometer: "235342", country: "Latvija" },
          { date: "11.09.2018", odometer: "228276", country: "Latvija" },
        ],
      },
    });
    expect(issues.filter((i) => i.kind === "mileage_drop")).toEqual([]);
  });

  it("viena datuma rādījumi atšķiras >1 % - brīdinājums", () => {
    const issues = run({
      csdd: csdd({ mileageHistory: [{ date: "12.04.2023", odometer: "100000", country: "Latvija" }] }),
      autodna: { serviceHistory: [{ date: "12.04.2023", odometer: "104000", country: "Latvija" }] },
    });
    expect(kinds(issues)).toContain("mileage_same_day:warn");
  });

  it("1 % robežās - nav pretrunas", () => {
    const issues = run({
      csdd: csdd({ mileageHistory: [{ date: "12.04.2023", odometer: "100000", country: "Latvija" }] }),
      autodna: { serviceHistory: [{ date: "12.04.2023", odometer: "100600", country: "Latvija" }] },
    });
    expect(issues.filter((i) => i.kind === "mileage_same_day")).toEqual([]);
  });

  it("datums nākotnē dīlera tabulā - ielases sargs to jau izmet, pretrunu nav", () => {
    const issues = run({
      csdd: csdd(),
      auto_records: {
        serviceWorks: [{ date: "23.05.2028", odometer: "40000", location: "Serviss", works: "Eļļas maiņa" }],
      },
    });
    expect(issues.filter((i) => i.kind === "future_date")).toEqual([]);
  });

  it("datums nākotnē, kas palicis izsoļu pārdošanas tabulā, tiek parādīts", () => {
    const issues = run({
      csdd: csdd(),
      cc_vin: { sales: [{ date: "01.10.2028", venue: "Openlane", odometer: "", price: "", status: "" }] },
    });
    const f = issues.find((i) => i.kind === "future_date");
    expect(f).toBeTruthy();
    expect(f!.values.some((v) => v.value === "01.10.2028")).toBe(true);
  });
});

describe("checkSourceConsistency - īpašnieki, valsts, datumi", () => {
  it("CarVertical rāda vairāk īpašnieku maiņu Latvijā nekā CSDD īpašnieku", () => {
    const issues = run({
      csdd: csdd({
        ownerCountLatvia: "1",
        ownerRegistrationEvents: [{ date: "22.08.2023", label: "Pirmā reģistrācija Latvijā" }],
      }),
      carvertical: {
        serviceHistory: [{ date: "01.08.2023", odometer: "15", country: "Latvija" }],
        vehicleHistoryTimeline: [
          { date: "01.08.2023", country: "Latvija", description: "Mainītas īpašumtiesības" },
          { date: "01.05.2026", country: "Latvija", description: "Mainītas īpašumtiesības" },
        ],
      },
    });
    const o = issues.find((i) => i.kind === "owners");
    expect(o?.severity).toBe("warn");
    expect(formatSourceIssueLine(o!)).toContain("05.2026");
  });

  it("iepriekšējā valsts CSDD nav nevienā citā avotā; dīlera ražotāja tirgus netiek ņemts", () => {
    const vi = { ...emptyOutvinVehicleInfo(), countryRegion: "Vācija" };
    const issues = run({
      csdd: csdd({ previousRegistrationCountry: "Vācija" }),
      auto_records: {
        outvinReport: { vehicleInfo: vi, accidentCheck: "", stolenCheck: "", equipment: [] },
        serviceWorks: [{ date: "10.01.2020", odometer: "30000", location: "Francija", works: "Apkope" }],
      },
    });
    const c = issues.find((i) => i.kind === "country");
    expect(c).toBeTruthy();
    expect(c!.values.map((v) => v.value)).toContain("Francija");
  });

  it("iepriekšējā valsts sakrīt ar vizītēm - nav pretrunas", () => {
    const issues = run({
      csdd: csdd({ previousRegistrationCountry: "Vācija" }),
      auto_records: {
        serviceWorks: [{ date: "10.01.2020", odometer: "30000", location: "Vācija", works: "Apkope" }],
      },
    });
    expect(issues.filter((i) => i.kind === "country")).toEqual([]);
  });

  it("pirmā reģistrācija izsolē atšķiras par >45 dienām", () => {
    const issues = run({
      csdd: csdd({ firstRegistration: "2020-12-09" }),
      cc_vin: { thecarapiRecords: [lot({ date_first_registration: "2021-06-01" })] },
    });
    expect(kinds(issues)).toContain("first_registration:warn");
  });

  it("izlaiduma gads = ražošanas gads + 1 - tikai info (modeļa gads)", () => {
    const vi = { ...emptyOutvinVehicleInfo(), productionDate: "12.09.2020" };
    const issues = run({
      csdd: csdd({ firstRegistration: "2020-12-09", modelYear: "2021" }),
      auto_records: { outvinReport: { vehicleInfo: vi, accidentCheck: "", stolenCheck: "", equipment: [] } },
    });
    expect(kinds(issues)).toContain("model_year:info");
    expect(countSourceIssues(issues)).toBe(0);
  });
});

describe("checkSourceConsistency - auto identitāte un AI teksts", () => {
  it("cita marka izsolē un cita degviela - kritiski", () => {
    const issues = run({
      csdd: csdd(),
      cc_vin: { thecarapiRecords: [lot({ clean_make: "BMW", fuel_group: "Petrol" })] },
    });
    expect(kinds(issues)).toContain("make:critical");
    expect(kinds(issues)).toContain("fuel:critical");
  });

  it("jauda atšķiras >5 % - brīdinājums", () => {
    const issues = run({
      csdd: csdd({ enginePowerKw: "140" }),
      cc_vin: { thecarapiRecords: [lot({ clean_make: "Audi", kw: "110" })] },
    });
    expect(kinds(issues)).toContain("power:warn");
  });

  it("AI teksts min pilnpiedziņu, ražotājs saka viena ass (4MATIC gadījums) - kritisks, viens punkts", () => {
    const vi = { ...emptyOutvinVehicleInfo(), drive: "Rear-Wheel Drive" };
    const issues = run(
      {
        csdd: csdd({ makeModel: "MERCEDES-BENZ E 300 DE" }),
        auto_records: { outvinReport: { vehicleInfo: vi, accidentCheck: "", stolenCheck: "", equipment: [] } },
      },
      [
        { label: "Risku analīze", text: "Auto ar 4MATIC pilnpiedziņu, jāpārbauda sadales kārba." },
        { label: "Kopsavilkums", text: "4MATIC sistēma prasa regulāru apkopi." },
      ],
    );
    const ai = issues.filter((i) => i.kind === "ai_drivetrain");
    expect(ai).toHaveLength(1);
    expect(ai[0]!.severity).toBe("critical");
    expect(ai[0]!.values.map((v) => v.source)).toEqual(["Risku analīze", "Kopsavilkums"]);
    expect(criticalSourceIssues(issues)).toHaveLength(1);
  });
});

describe("checkSourceConsistency - bojājumi un cenas", () => {
  it("izsolē bojājumu nav, AutoDNA negadījums pirms izsoles - brīdinājums", () => {
    const issues = run({
      csdd: csdd(),
      autodna: { incidents: [{ incidentNo: "1", csngDate: "14.03.2024", lossAmount: "" }] },
      cc_vin: { thecarapiRecords: [lot({ clean_make: "Audi", HasDamages: "false" })] },
    });
    expect(kinds(issues)).toContain("damage:warn");
  });

  it("negadījums pēc izsoles - nav pretrunas", () => {
    const issues = run({
      csdd: csdd(),
      autodna: { incidents: [{ incidentNo: "1", csngDate: "14.11.2026", lossAmount: "" }] },
      cc_vin: { thecarapiRecords: [lot({ clean_make: "Audi", HasDamages: "false" })] },
    });
    expect(issues.filter((i) => i.kind === "damage")).toEqual([]);
  });

  it("Openlane publiskā cena atšķiras no solījuma (7 300 / 11 168) - info, skaitā neietilpst", () => {
    const issues = run({
      csdd: csdd(),
      cc_vin: {
        thecarapiRecords: [lot({ clean_make: "Audi", final_price: "7300", current_price: "7300", public_price_eur: "11168" })],
      },
    });
    const p = issues.find((i) => i.kind === "auction_price");
    expect(p?.severity).toBe("info");
    expect(formatSourceIssueLine(p!)).toContain("7 300 €");
    expect(formatSourceIssueLine(p!)).toContain("11 168 €");
    expect(countSourceIssues(issues)).toBe(0);
  });

  it("tukši bloki - nav pretrunu un nav kļūdu", () => {
    expect(checkSourceConsistency({ sourceBlocks: null, nowMs: NOW })).toEqual([]);
  });

  it("kritiskie sakārtoti pirmie", () => {
    const issues = run({
      csdd: csdd({ firstRegistration: "2020-12-09" }),
      cc_vin: { thecarapiRecords: [lot({ clean_make: "BMW", date_first_registration: "2021-06-01" })] },
    });
    expect(issues[0]!.severity).toBe("critical");
  });
});
