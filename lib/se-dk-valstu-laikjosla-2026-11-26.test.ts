/**
 * 26.11.2026 audits (Mercedes, anonimizēts): SE 12.2010-10.2016 → DK 27.10.2016 (imports) - 24.09.2026 → LV 11.2026.
 * Avotu dati bija pareizi, kļūdas bija mūsu interpretācijā (pirmā reģistrācija «Dānija», car.info rindas ar
 * Zviedrijas karogu, netulkots «Insurance ended», noapaļotie rādījumi, līzinga troksnis, «Dānijā 4», «0 dienas»).
 */
import { describe, expect, it } from "vitest";
import {
  mergeSourceBlocksWithDefaults,
  toPdfLtabManualBlock,
  toPdfManualVendorBlocks,
  type WorkspaceSourceBlocks,
} from "@/lib/admin-source-blocks";
import { buildClientReportDocumentHtml, type ClientReportPayload } from "@/lib/client-report-html";
import { computeLatviaRegistrationTenure } from "@/lib/latvia-registration-tenure";
import { lvCount } from "@/lib/lv-plural";
import { collectRegistryFactCardRows } from "@/lib/pdf-fact-card";
import { computeProvinInfoBannersFromPayloadSlice } from "@/lib/provin-alert-banners";
import { collectRegistryCountryPeriods } from "@/lib/registry-country-periods";
import { collectUnifiedMileageRows, prepareUnifiedMileageDisplayRows } from "@/lib/unified-mileage";
import { buildVehicleLifecycleEvents } from "@/lib/vehicle-lifecycle-timeline";
import { parseCarinfoPastedText, translateStoredCarinfoEvent } from "@/lib/vin-sources/carinfo-parse";
import { collapseDkLeaseInsuranceRows } from "@/lib/vin-sources/dk-lease-timeline";
import { mapTjekbilPayload, type TjekbilDmrResponse } from "@/lib/vin-sources/tjekbil-map";
import { capitalizeFactValue } from "@/lib/vin-sources/translate-lv";

const VIN = "WDDTEST0000SEDK01";
const DK_PLATE = "XX11111";

const lease = (from: string, to: string) => ({
  leasingGyldigFra: `${from}T00:00:00+02:00`,
  leasingGyldigTil: `${to}T00:00:00+02:00`,
});
const ins = (selskab: string, status: "Aktiv" | "Ophørt", oprettet: string) => ({ selskab, status, oprettet });
const syn = (synsdato: string, kategori: string, kmstand: number, synsresultat = "Godkendt") => ({
  firma: "Bilsyn",
  synstype: "Første syn",
  synsresultat,
  synsdato,
  kategori,
  kmstand,
  fejl: [],
});

/** DMR struktūra kā īstajā gadījumā: `leasingHistory` nav hronoloģisks, 3 × Ejerskifte, 7 apskates. */
const DMR: TjekbilDmrResponse = {
  basic: {
    regNr: DK_PLATE,
    stelNr: VIN,
    status: "Afmeldt",
    statusDato: "2026-09-24T09:55:05+02:00",
    foersteRegistreringDato: "2010-12-08T00:00:00+01:00",
    bilLeaset: false,
    koeretoejAnvendelseNavn: "Privat personkørsel",
    leasingHistory: [
      lease("2020-10-23", "2021-10-22"),
      lease("2024-10-19", "2025-10-06"),
      lease("2018-10-25", "2019-10-24"),
      lease("2022-10-21", "2023-10-20"),
      lease("2017-10-26", "2018-10-25"),
      lease("2021-10-22", "2022-10-21"),
      lease("2023-10-20", "2024-10-21"),
      lease("2016-10-27", "2017-10-26"),
      lease("2019-10-24", "2020-10-23"),
      lease("2026-02-27", "2026-09-24"),
    ],
    statusHistory: [
      { status: "Ejerskifte", statusDate: "2016-10-27T00:00:00", licensePlate: "XX22222" },
      { status: "Ejerskifte", statusDate: "2022-10-21T00:00:00", licensePlate: "XX22222" },
      { status: "Ejerskifte", statusDate: "2023-10-20T00:00:00", licensePlate: "XX22222" },
    ],
  },
  extended: {
    insurance: {
      selskab: "FORSIKRING B A/S",
      status: "Ophørt",
      historik: [
        ins("FORSIKRING B A/S", "Ophørt", "24-09-2026"),
        ins("FORSIKRING B A/S", "Aktiv", "27-02-2026"),
        ins("FORSIKRING B A/S", "Ophørt", "27-02-2026"),
        ins("FORSIKRING B A/S", "Ophørt", "06-10-2025"),
        ins("FORSIKRING B A/S", "Aktiv", "21-10-2024"),
        ins("FORSIKRING B A/S", "Ophørt", "21-10-2024"),
        ins("FORSIKRING B A/S", "Aktiv", "20-10-2023"),
        ins("FORSIKRING B A/S", "Ophørt", "20-10-2023"),
        ins("FORSIKRING B A/S", "Aktiv", "24-12-2022"),
        ins("FORSIKRING A A/S", "Ophørt", "24-12-2022"),
        ins("FORSIKRING A A/S", "Aktiv", "21-10-2022"),
        ins("FORSIKRING A A/S", "Ophørt", "21-10-2022"),
        ins("FORSIKRING A A/S", "Aktiv", "22-10-2021"),
        ins("FORSIKRING A A/S", "Ophørt", "22-10-2021"),
        ins("FORSIKRING A A/S", "Aktiv", "23-10-2020"),
        ins("FORSIKRING A A/S", "Ophørt", "23-10-2020"),
        ins("FORSIKRING A A/S", "Aktiv", "09-01-2020"),
        ins("FORSIKRING C", "Ophørt", "09-01-2020"),
        ins("FORSIKRING C", "Aktiv", "24-10-2019"),
      ],
    },
  },
  inspectionData: {
    rapporter: [
      syn("13-08-2026", "Periodisk syn", 357628),
      syn("06-09-2024", "Registreringssyn uden ændring", 340332),
      syn("20-09-2022", "Periodisk syn", 317000),
      syn("01-10-2020", "Periodisk syn", 302000),
      syn("20-09-2018", "Periodisk syn", 265000),
      syn("27-10-2016", "Registreringssyn", 210000),
      syn("27-10-2016", "Toldsyn import", 210000, "Middel"),
    ],
  },
};

const LOGS = [
  { mileage: 357628, mileageAt: "2026-08-13T06:31:00", origin: 10 },
  { mileage: 357000, mileageAt: "2026-08-13T00:00:00", origin: 20 },
  { mileage: 340332, mileageAt: "2024-09-06T08:13:00", origin: 10 },
  { mileage: 340000, mileageAt: "2024-09-06T00:00:00", origin: 20 },
  { mileage: 317000, mileageAt: "2022-09-20T08:08:00", origin: 10 },
  { mileage: 210000, mileageAt: "2016-10-27T08:22:00", origin: 10 },
  { mileage: 0, mileageAt: "2010-12-08T00:00:00", origin: 30 },
];

const RAW = JSON.stringify({ sources: ["tjekbil.dk"], tjekbil: { dmr: DMR, mileagelogs: LOGS } }, null, 2);

/** Kā melnrakstā saglabāts pirms labojuma (vecā loģika): DK pirmā reģistrācija, «Dānijā 4», 2020 līzinga sākums. */
function storedTjekbilBlock() {
  return {
    mileage: [
      { date: "2026-08-13", odometer: "357628", country: "Dānija", origin: "Færdselsstyrelsen (synsrapport)" },
      { date: "2026-08-13", odometer: "357000", country: "Dānija", origin: "Motorstyrelsen (nodokļu reģistrs)" },
      { date: "2024-09-06", odometer: "340332", country: "Dānija", origin: "Færdselsstyrelsen (synsrapport)" },
      { date: "2024-09-06", odometer: "340000", country: "Dānija", origin: "Motorstyrelsen (nodokļu reģistrs)" },
      { date: "2022-09-20", odometer: "317000", country: "Dānija", origin: "Færdselsstyrelsen (synsrapport)" },
      { date: "2016-10-27", odometer: "210000", country: "Dānija", origin: "Færdselsstyrelsen (muitas apskate)" },
      { date: "2010-12-08", odometer: "0", country: "Dānija", origin: "Pirmā reģistrācija" },
    ],
    incidents: [],
    timeline: [
      { date: "2026-09-24", odometer: "", country: "Dānija", event: "Līzings beidzas" },
      { date: "2026-09-24", odometer: "", country: "Dānija", event: "Apdrošināšana: FORSIKRING B A/S, beigusies" },
      { date: "2026-09-24", odometer: "", country: "Dānija", event: "Reģistrācijas statuss: Noņemts no uzskaites" },
      { date: "2026-08-13", odometer: "357628", country: "Dānija", event: "Periodiskā apskate: Izturēta · Bilsyn" },
      { date: "2026-02-27", odometer: "", country: "Dānija", event: "Līzings sākas" },
      { date: "2025-10-06", odometer: "", country: "Dānija", event: "Līzings beidzas" },
      { date: "2024-10-21", odometer: "", country: "Dānija", event: "Līzings beidzas" },
      { date: "2024-10-21", odometer: "", country: "Dānija", event: "Apdrošināšana: FORSIKRING B A/S, aktīva" },
      { date: "2024-10-21", odometer: "", country: "Dānija", event: "Apdrošināšana: FORSIKRING B A/S, beigusies" },
      { date: "2024-10-19", odometer: "", country: "Dānija", event: "Līzings sākas" },
      { date: "2023-10-20", odometer: "", country: "Dānija", event: "Līzings beidzas" },
      { date: "2023-10-20", odometer: "", country: "Dānija", event: "Līzings sākas" },
      { date: "2022-12-24", odometer: "", country: "Dānija", event: "Apdrošināšana: FORSIKRING B A/S, aktīva" },
      { date: "2022-12-24", odometer: "", country: "Dānija", event: "Apdrošināšana: FORSIKRING A A/S, beigusies" },
      { date: "2022-10-21", odometer: "", country: "Dānija", event: "Līzings sākas" },
      { date: "2022-10-21", odometer: "", country: "Dānija", event: "Līzings beidzas" },
      ...["2021-10-22", "2020-10-23", "2019-10-24", "2018-10-25"].flatMap((date) => [
        { date, odometer: "", country: "Dānija", event: "Līzings beidzas" },
        { date, odometer: "", country: "Dānija", event: "Līzings sākas" },
      ]),
      { date: "2017-10-26", odometer: "", country: "Dānija", event: "Līzings sākas" },
      { date: "2017-10-26", odometer: "", country: "Dānija", event: "Līzings beidzas" },
      { date: "2016-10-27", odometer: "210000", country: "Dānija", event: "Reģistrācijas apskate: Izturēta · Bilsyn" },
      { date: "2016-10-27", odometer: "210000", country: "Dānija", event: "Muitas apskate (imports): Stāvoklis vidējs · Bilsyn" },
      { date: "2016-10-27", odometer: "", country: "Dānija", event: "Līzings sākas" },
      { date: "2010-12-08", odometer: "", country: "", event: "Pirmā reģistrācija" },
    ],
    ownersSummary: "Īpašnieku skaits Dānijā: 4.",
    statusRecords: "Izmantošanas veids: Privāti\nLīzings: 23.10.2020 - 24.09.2026 (10 periodi)\nPēdējā apskate: 13.08.2026, Izturēta",
    rawUnprocessedData: RAW,
    autoNotes: "",
    comments: "",
  };
}

/** car.info Zviedrijas cilne pēc eksporta: Dānijas DMR dati ar Zviedrijas valsti (vecā parsēšana). */
function storedCarinfoBlock() {
  return {
    mileage: [
      { date: "2026-08-13", odometer: "357630", country: "Zviedrija", origin: "car.info, apskate" },
      { date: "2022-09-20", odometer: "317000", country: "Zviedrija", origin: "car.info, apskate" },
    ],
    incidents: [],
    timeline: [
      { date: "2026-09-26", odometer: "", country: "Zviedrija", event: "Līzings beidzies" },
      { date: "2026-09-24", odometer: "", country: "Zviedrija", event: "Insurance ended, FORSIKRING B A/S" },
      { date: "2026-09-24", odometer: "", country: "Zviedrija", event: "Noņemts no satiksmes" },
      { date: "2026-08-13", odometer: "357630", country: "Zviedrija", event: "Tehniskā apskate, izieta" },
    ],
    ownersSummary: "1 īpašnieki",
    statusRecords: [
      "Satiksmē: nē",
      "Iekšzemes (Zviedrija): jā",
      "Pēdējā apskate: 13.08.2026",
      "Aprēķinātais nobraukums (car.info aprēķins, nav rādījums): 357 630 km",
      `Pēdējais zināmais reģistrācijas numurs: DK ${DK_PLATE} (Dānija)`,
      "Īpašais statuss: Līzings",
    ].join("\n"),
    autoNotes: `Pēdējais zināmais reģistrācijas numurs: DK ${DK_PLATE} (Dānija).\nĪpašais statuss: Līzings.`,
    rawUnprocessedData: "",
    comments: "",
  };
}

const SERVICE = [
  ["12.08.2011", "25400", "Zviedrija"],
  ["08.05.2012", "50319", "Zviedrija"],
  ["15.08.2013", "95953", "Zviedrija"],
  ["19.08.2015", "170533", "Zviedrija"],
  ["28.04.2016", "193879", "Zviedrija"],
  ["18.01.2017", "218348", "Dānija"],
  ["11.12.2018", "268641", "Dānija"],
  ["03.06.2022", "312780", "Dānija"],
  ["23.06.2023", "324067", "Dānija"],
].map(([date, odometer, country]) => ({ date: date!, odometer: odometer!, country: country! }));

function storedWorkspace(): WorkspaceSourceBlocks {
  return mergeSourceBlocksWithDefaults({
    csdd: {
      makeModel: "MERCEDES BENZ E350 4MATIC",
      registrationNumber: "AA0000",
      vin: VIN,
      firstRegistration: "2010-12-08",
      firstRegistrationLatvia: "",
      registrationStatus: "Uzskaitē",
      prevInspectionDate: "2026-11-26",
      mileageHistory: [{ date: "26.11.2026", odometer: "287469", country: "Latvija" }],
    },
    ltab: {
      rows: [{ incidentNo: "", csngDate: "", lossAmount: "" }],
      certificate: { plate: "AA0000", accidentCount: "0", insuredFrom: "24.11.2026", insuredTo: "24.12.2026", insuredDays: "31", claims: [] },
    },
    auto_records: { serviceHistory: SERVICE },
    tjekbil: storedTjekbilBlock(),
    carinfo: storedCarinfoBlock(),
  });
}

function lifecycleInput(blocks: WorkspaceSourceBlocks) {
  return {
    csddForm: blocks.csdd,
    autoRecordsBlock: blocks.auto_records,
    manualVendorBlocks: toPdfManualVendorBlocks(blocks),
    manualLtabBlock: toPdfLtabManualBlock(blocks.ltab, { csdd: blocks.csdd }),
  };
}

describe("1. pirmā reģistrācija nav Dānijas fakts, ja ir DK imports", () => {
  it("tjekbil ielase: 0 km rinda bez valsts, laika joslā pirmā reģistrācija bez valsts", () => {
    const mapped = mapTjekbilPayload({ dmr: DMR, mileagelogs: LOGS });
    const zero = mapped.mileage.find((r) => r.odometer === "0");
    expect(zero?.country).toBe("");
    expect(mapped.timeline.find((r) => /Pirmā reģistrācija/.test(r.event))?.country).toBe("");
  });

  it("saglabātais melnraksts: valstu posms DK sākas ar importu 10.2016, ne 12.2010", () => {
    const blocks = storedWorkspace();
    expect(blocks.tjekbil.mileage.find((r) => r.odometer === "0")?.country).toBe("");
    const periods = collectRegistryCountryPeriods(blocks);
    const dk = periods.find((p) => p.country === "Dānija");
    expect(dk?.fromLabel).toBe("10.2016");
  });

  it("laikjosla: pirmā reģistrācija Zviedrijā, pārejas tikai SE → DK un DK → LV", () => {
    const events = buildVehicleLifecycleEvents(lifecycleInput(storedWorkspace()));
    const first = events.find((e) => e.kind === "first_registration");
    expect(first?.country).toBe("Zviedrija");
    const transitions = events.filter((e) => e.kind === "import").map((e) => `${e.date} ${e.title}`);
    expect(transitions).toEqual(["27.10.2016 Zviedrija → Dānija", "26.11.2026 Dānija → Latvija"]);
  });
});

describe("2. car.info rindas pēc eksporta ir Dānijas dati", () => {
  it("valsts pārlikta uz Dāniju, dublikāti ar DMR atskaitē izlaisti", () => {
    const blocks = storedWorkspace();
    expect(blocks.carinfo.mileage.every((r) => r.country === "Dānija")).toBe(true);
    expect(blocks.carinfo.timeline.every((r) => r.country === "Dānija")).toBe(true);
    const se = toPdfManualVendorBlocks(blocks).find((b) => b.title === "ZVIEDRIJAS REĢISTRI");
    expect(se?.mileageRows ?? []).toEqual([]);
    expect(se?.vehicleHistoryTimeline ?? []).toEqual([]);
  });

  it("car.info teksts ar eksportu: notikumi pēc eksporta - galamērķa valstī", () => {
    const parsed = parseCarinfoPastedText(
      [
        "car.info EN / SE Transportstyrelsen",
        "NOTE: The latest known registration number for the vehicle is DK XX11111",
        "Number of Owners",
        "1",
        "Vehicle history",
        "2026-09-24",
        "Insurance ended",
        "FORSIKRING B A/S",
        "2016-10-20",
        "Vehicle exported",
        "2015-06-01",
        "Inspection",
        "Passed",
        "170,000 km",
        "Hidden items: 3",
      ].join("\n"),
    );
    const byDate = Object.fromEntries((parsed.timeline ?? []).map((r) => [r.date, r]));
    expect(byDate["2026-09-24"]?.country).toBe("Dānija");
    expect(byDate["2026-09-24"]?.event).toBe("Apdrošināšana beigusies: FORSIKRING B A/S");
    expect(byDate["2015-06-01"]?.country).toBe("Zviedrija");
    expect(parsed.ownersSummary).toBe("1 īpašnieks");
  });
});

describe("3. car.info notikumi latviski", () => {
  it("saglabātais «Insurance ended, …» un nezināms virsraksts ar oriģinālu pēdiņās", () => {
    expect(translateStoredCarinfoEvent("Insurance ended, FORSIKRING B A/S")).toBe(
      "Apdrošināšana beigusies: FORSIKRING B A/S",
    );
    expect(translateStoredCarinfoEvent("Something new happened")).toBe(
      'Reģistra ieraksts (car.info: "Something new happened")',
    );
    expect(translateStoredCarinfoEvent("Līzings beidzies")).toBe("Līzings beidzies");
  });
});

describe("4. nobraukuma tabula", () => {
  it("13.08.2026 viena DK rinda ar precīzo 357 628; noapaļotie rādījumi nav atsevišķi", () => {
    const blocks = storedWorkspace();
    const rows = prepareUnifiedMileageDisplayRows(collectUnifiedMileageRows(lifecycleInput(blocks)));
    const aug = rows.filter((r) => r.date.includes("13.08.2026") || r.date.includes("2026-08-13"));
    expect(aug.map((r) => [r.odometer.replace(/\D/g, ""), r.country])).toEqual([["357628", "Dānija"]]);
    const kms = rows.map((r) => r.odometer.replace(/\D/g, ""));
    expect(kms).not.toContain("357000");
    expect(kms).not.toContain("340000");
    expect(kms).not.toContain("357630");
    expect(rows.some((r) => r.country.includes("/"))).toBe(false);
  });
});

describe("5. Zviedrijas reģistru bloks", () => {
  it("bez DK apskates; rindas nedublējas; «km» un «1 īpašnieks»", () => {
    const se = toPdfManualVendorBlocks(storedWorkspace()).find((b) => b.title === "ZVIEDRIJAS REĢISTRI")!;
    const facts = collectRegistryFactCardRows({ statusRecords: se.statusRecords, autoNotes: se.autoNotes });
    const keys = facts.map((r) => r.k);
    expect(keys).not.toContain("Pēdējā apskate");
    expect(keys.filter((k) => k === "Pēdējais zināmais reģistrācijas numurs")).toHaveLength(1);
    expect(keys.filter((k) => k === "Īpašais statuss")).toHaveLength(1);
    expect(facts.find((r) => /Aprēķinātais nobraukums/.test(r.k))?.v).toBe("357 630 km");
    expect(collectRegistryFactCardRows({ ownersSummary: "Īpašnieki: 1 īpašnieki" })[0]?.v).toBe("1 īpašnieks");
    expect(capitalizeFactValue("27.10.2016 - 24.09.2026 (10 periodi)")).toBe("27.10.2016 - 24.09.2026 (10 periodi)");
    expect(lvCount(1, "īpašnieks", "īpašnieki")).toBe("1 īpašnieks");
    expect(lvCount(11, "īpašnieks", "īpašnieki")).toBe("11 īpašnieki");
    expect(lvCount(21, "īpašnieks", "īpašnieki")).toBe("21 īpašnieks");
  });
});

describe("6. Dānijas bloks: līzings", () => {
  it("ielase: līzinga rinda no 27.10.2016, gada līgumi vienā laika joslas rindā", () => {
    const mapped = mapTjekbilPayload({ dmr: DMR, mileagelogs: LOGS });
    expect(mapped.statusRecords).toMatch(/Līzings: 27\.10\.2016 - 24\.09\.2026 \(10 periodi\)/);
    const lease = mapped.timeline.filter((r) => /^Līzings/.test(r.event));
    expect(lease.map((r) => `${r.date} ${r.event}`).sort()).toEqual([
      "2016-10-27 Līzings 2016-2025 (gada līgumi)",
      "2026-02-27 Līzings sākas",
      "2026-09-24 Līzings beidzas",
    ]);
    const insurance = mapped.timeline.filter((r) => /^Apdrošināšana/.test(r.event)).map((r) => `${r.date} ${r.event}`);
    expect(insurance.sort()).toEqual([
      "2019-10-24 Apdrošināšana: FORSIKRING C, aktīva",
      "2020-01-09 Apdrošināšana: FORSIKRING A A/S, aktīva",
      "2022-12-24 Apdrošināšana: FORSIKRING B A/S, aktīva",
      "2025-10-06 Apdrošināšana: FORSIKRING B A/S, beigusies",
      "2026-02-27 Apdrošināšana: FORSIKRING B A/S, aktīva",
      "2026-09-24 Apdrošināšana: FORSIKRING B A/S, beigusies",
    ]);
  });

  it("saglabātais melnraksts: līzinga rinda pārrēķināta no RAW, laika josla apvienota atskaitē", () => {
    const blocks = storedWorkspace();
    expect(blocks.tjekbil.statusRecords).toMatch(/Līzings: 27\.10\.2016 - 24\.09\.2026 \(10 periodi\)/);
    const dk = toPdfManualVendorBlocks(blocks).find((b) => b.title === "DĀNIJAS REĢISTRI")!;
    const events = (dk.vehicleHistoryTimeline ?? []).map((r) => r.description);
    expect(events).toContain("Līzings 2016-2025 (gada līgumi)");
    expect(events.filter((e) => /^Apdrošināšana/.test(e))).toEqual([
      "Apdrošināšana: FORSIKRING B A/S, beigusies",
      "Apdrošināšana: FORSIKRING B A/S, aktīva",
    ]);
  });

  it("apvienošana neskar vienu līgumu un ir idempotenta", () => {
    const one = [
      { date: "2026-02-27", event: "Līzings sākas" },
      { date: "2026-09-24", event: "Līzings beidzas" },
    ];
    expect(collapseDkLeaseInsuranceRows(one)).toEqual(one);
    const mapped = mapTjekbilPayload({ dmr: DMR, mileagelogs: LOGS });
    expect(collapseDkLeaseInsuranceRows(mapped.timeline)).toEqual(mapped.timeline);
  });
});

describe("7. īpašnieki Dānijā", () => {
  it("reģistrācijas apskate līzinga laikā bez Ejerskifte nav jauns īpašnieks (3, ne 4)", () => {
    expect(mapTjekbilPayload({ dmr: DMR, mileagelogs: LOGS }).ownersSummary).toBe("Īpašnieku skaits Dānijā: 3.");
    expect(storedWorkspace().tjekbil.ownersSummary).toBe("Īpašnieku skaits Dānijā: 3.");
  });
});

describe("8. reģistrācija Latvijā bez CSDD «Pirmā reģistrācija Latvijā»", () => {
  const ref = new Date("2026-11-26T12:00:00Z");
  it("agrākais LV signāls - OCTA no LTAB (24.11), nevis šodienas apskate", () => {
    const blocks = storedWorkspace();
    const t = computeLatviaRegistrationTenure({
      csddForm: blocks.csdd,
      manualLtabBlock: toPdfLtabManualBlock(blocks.ltab, { csdd: blocks.csdd }),
      referenceDate: ref,
    });
    expect(t?.firstDateDisplay).toBe("24.11.2026");
    expect(t?.daysRegistered).toBe(2);
    expect(t?.exact).toBe(false);
  });

  it("bez cita LV signāla kartīte saka «Nav precīza datuma», ne «0 dienas»", () => {
    const blocks = storedWorkspace();
    const [banner] = computeProvinInfoBannersFromPayloadSlice({ csddForm: blocks.csdd }, ref);
    expect(banner?.value).toBe("Nav precīza datuma");
    expect(banner?.value).not.toMatch(/0 dienas/);
  });
});

describe("visa atskaite (PDF teksts)", () => {
  it("nav «Dānijā 4», «Insurance ended», «Km», «Periodi», «Zviedrija / Dānija»", () => {
    const blocks = storedWorkspace();
    const html = buildClientReportDocumentHtml({
      payload: {
        sessionId: "test",
        isDemo: false,
        vin: VIN,
        created: Date.parse("2026-11-26T19:00:00Z") / 1000,
        amountTotal: 9999,
        currency: "EUR",
        paymentStatus: "paid",
        listingUrl: null,
        customerEmail: null,
        customerPhone: null,
        customerName: null,
        contactMethod: null,
        notes: null,
        csdd: "",
        ltab: "",
        tirgus: "",
        citi: "",
        iriss: "",
        apskatesPlāns: "",
        tehniskoRiskuAnalize: "",
        cenasAtbilstiba: "",
        ...lifecycleInput(blocks),
      } as ClientReportPayload,
      portfolio: [],
      pdfInsights: [],
      dateFmt: new Intl.DateTimeFormat("lv-LV"),
      formatBytes: () => "0 B",
    });
    const text = html.replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, "").replace(/<[^>]+>/g, "\n");
    expect(text).not.toMatch(/Dānijā 4/);
    expect(text).toMatch(/Dānijā 3/);
    expect(text).not.toMatch(/Insurance ended/);
    expect(text).not.toMatch(/\d Km\b/);
    expect(text).not.toMatch(/Periodi\)/);
    expect(text).not.toMatch(/Zviedrija \/ Dānija|Dānija \/ Zviedrija/);
    expect(text).not.toMatch(/Avoti atšķiras valstī/);
  });
});
