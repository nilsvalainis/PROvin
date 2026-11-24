/**
 * 24.11.2026 - anonimizētas fiksācijas (bez VIN, numuriem, personām):
 * 1) Volvo XC90 2.4D: rūpnīcas kodi AG02 «POWER TRAIN AWD», K03 Haldex, bet OneAuto OE VIN Lookup
 *    `oem_drivetrain_desc` = «Front-Wheel Drive» (kataloga tips) - drošības tīkls sabojāja pareizu tekstu.
 * 2) BMW 3. sērija: OneAuto VIN Decoder `manufactured_year` 2014 (VIN 10. poz.), pirmā reģ. un dīleris 2012.
 * 3) Mercedes GLE: AI «piecas īpašumtiesību maiņas ārvalstīs pirms reģistrācijas Latvijā» (visas LV),
 *    «kopējā vēsturē 9 īpašnieki» (nav nevienā avotā).
 * 4) checkOwners abos virzienos; CarVertical notikums pirms CSDD izziņas - reģistrācijas apliecības izmaiņa.
 */
import { describe, expect, it } from "vitest";

import { mergeSourceBlocksWithDefaults, type WorkspaceSourceBlocks } from "@/lib/admin-source-blocks";
import { buildCanonicalFacts } from "@/lib/canonical-facts-sheet";
import { buildOneautoDisplay } from "@/lib/oneauto-catalog";
import { oneautoPowertrainToVehicleInfo } from "@/lib/oneauto-to-auto-records";
import { emptyOutvinVehicleInfo } from "@/lib/outvin-dealer-types";
import { findOwnerClaimIssues } from "@/lib/owner-claims-check";
import { plausibleProductionDate, productionDateContradictsRecords } from "@/lib/production-date-guard";
import {
  drivetrainFromSpecLine,
  extractOemDrivetrain,
  extractVehicleDrivetrain,
  findDrivetrainContradictions,
  OEM_DRIVETRAIN_SOURCE_LABEL,
  resolveVehicleDrivetrain,
  stripAwdClaimsForTwoWheelDrive,
} from "@/lib/registry-drivetrain";
import { checkSourceConsistency } from "@/lib/source-consistency";
import { dealerVehicleInfoForDisplay } from "@/lib/vehicle-display-name";

const NOW = Date.UTC(2026, 10, 24);

/** Vendor blokiem (CarVertical / AutoDNA) parsētājs prasa `serviceHistory` atslēgu. */
function blocks(patch: Record<string, unknown>): WorkspaceSourceBlocks {
  const p: Record<string, unknown> = { ...patch };
  for (const k of ["carvertical", "autodna"]) if (p[k]) p[k] = { serviceHistory: [], ...(p[k] as object) };
  const merged = mergeSourceBlocksWithDefaults(p as unknown);
  // Reģistra bloku un dīlera RAW ingest ieliek tieši (kā saglabātā melnrakstā), bez parsētāja filtriem.
  if (patch.tjekbil) merged.tjekbil = { ...merged.tjekbil, ...(patch.tjekbil as object) };
  const ingest = (patch.auto_records as { oneautoIngest?: unknown } | undefined)?.oneautoIngest;
  if (ingest) merged.auto_records = { ...merged.auto_records, oneautoIngest: ingest as never };
  return merged;
}

/** XC90 CarVertical RAW fragments (rūpnīcas kodu saraksts + LV specifikācija). */
const XC90_CV_RAW = [
  "Transmisijas tips",
  "Automātiskā ātrumkārba",
  "Piedziņas tips",
  "Pilnpiedziņa",
  "Piedziņas veids",
  "Iekšdedze",
  "AF02DOORS 5 doorsAG02POWER TRAIN AWD 4-wheel drive",
  "DB20Gear box 6-speed automatic awdDC02NEUTRAL CONTROL AUTO.GEAR With NEUTRAL",
  "DI19GEAR LEVER TYPE/KNOB Sapeli wood knob XC90DK03Visco differential electrical controlled limited coupling",
  "awd (haldex)",
  "G606FUELTANK,CAPACITY Capacity 68 litre, DIESEL AWDGB02DIAGNOS SYSTEM E OBD",
  "T244ENGINE EMBLEM REAR RH Emblem '2.4D AWD'T304DECAL TRIMLEVEL Trim level 3 (Summum)",
].join("\n");

function oneautoFwd() {
  return {
    oneautoIngest: {
      results: { oe_vin_lookup: { payload: { result: { oem_drivetrain_desc: "Front-Wheel Drive" } } } },
    },
    outvinReport: {
      vehicleInfo: { ...emptyOutvinVehicleInfo(), drive: "Front-Wheel Drive" },
      equipment: [{ code: "B05", description: "Gearbox/driveline 6-speed automatic, 2wd and 4wd" }],
      accidentCheck: "",
      stolenCheck: "",
    },
  };
}

describe("1. piedziņa no visiem avotiem", () => {
  it("rindu lasītājs: kodi, LV specifikācija, izņēmumi", () => {
    expect(drivetrainFromSpecLine("AF02DOORS 5 doorsAG02POWER TRAIN AWD 4-wheel drive")).toBe(true);
    expect(drivetrainFromSpecLine("1X2Four wheel drive9F9Without locking")).toBe(true);
    expect(drivetrainFromSpecLine("1X0Front-wheel drive1Z9Initial standard fuel filling")).toBe(false);
    expect(drivetrainFromSpecLine("Pilnpiedziņa")).toBe(true);
    expect(drivetrainFromSpecLine("X5 xDrive30d")).toBe(true);
    expect(drivetrainFromSpecLine("DB10GEARBOX Manual 6-speed FWDDD04PEDAL")).toBe(null);
    expect(drivetrainFromSpecLine("Manual 6-speed FWD")).toBe(false);
    // Nav piedziņas apraksts:
    expect(drivetrainFromSpecLine("4X4Side airbag in front and rear with curtain airbag")).toBe(null);
    expect(drivetrainFromSpecLine("FQ1Wheels of Quattro GmbHG01Shock absorption")).toBe(null);
    expect(drivetrainFromSpecLine('2Z7Type sign at rear and "Quattro" nameplates respectively')).toBe(null);
    expect(drivetrainFromSpecLine("Gearbox/driveline 6-speed automatic, 2wd and 4wd")).toBe(null);
    expect(drivetrainFromSpecLine("8B05Gearbox/driveline 6-speed automatic, 2wd and 4wd8D11Rear mirror")).toBe(null);
    expect(drivetrainFromSpecLine("FRONT WHEEL BRAKE 16 INCH DISC")).toBe(null);
    expect(drivetrainFromSpecLine("LHD (left-hand drive)")).toBe(null);
    expect(drivetrainFromSpecLine("Volkswagen ID.4 Pro 4MOTION (2021 - 2024)")).toBe(null);
    expect(drivetrainFromSpecLine("Piedziņas veids")).toBe(null);
  });

  it("XC90: rūpnīcas kodi AWD uzvar OneAuto katalogu FWD; pretruna - brīdinājums", () => {
    const b = blocks({ carvertical: { aiContextRaw: XC90_CV_RAW }, auto_records: oneautoFwd() });
    const res = resolveVehicleDrivetrain(b);
    expect(res.tier).toBe("factory_codes");
    expect(res.conflict).toBe(true);
    expect(res.drivetrain).toMatchObject({ awd: true, sourceLabel: "CarVertical rūpnīcas kodi" });
    expect(extractOemDrivetrain(b)).toMatchObject({ awd: false, sourceLabel: OEM_DRIVETRAIN_SOURCE_LABEL });

    // Drošības tīkls AWD vairs nedzēš, AI tekstam nav kritiskas pretrunas.
    const text = "XC90 2.4D AWD ar Haldex sajūgu - pārbaudīt Haldex eļļas maiņu.";
    expect(stripAwdClaimsForTwoWheelDrive(text, extractVehicleDrivetrain(b))).toBe(text);
    expect(findDrivetrainContradictions(text, extractVehicleDrivetrain(b))).toEqual([]);

    const issues = checkSourceConsistency({ sourceBlocks: b, texts: [{ label: "Risku analīze", text }], nowMs: NOW });
    expect(issues.filter((i) => i.kind === "ai_drivetrain")).toEqual([]);
    const dt = issues.find((i) => i.kind === "drivetrain");
    // Pretī runā tikai OneAuto katalogs (aprīkojums nav pirkts) - info, ne brīdinājums.
    expect(dt?.severity).toBe("info");
    expect(dt?.title).toMatch(/avoti nesakrīt/);
    const vals = dt!.values.map((v) => `${v.source}=${v.value}`);
    expect(vals).toContain("CarVertical rūpnīcas kodi=pilnpiedziņa");
    expect(vals).toContain(`${OEM_DRIVETRAIN_SOURCE_LABEL}=viena ass`);

    // Faktu lapā - pilnpiedziņa, nav aizlieguma.
    const facts = buildCanonicalFacts({ sourceBlocks: b, vin: "TESTVIN0000000001" });
    expect(facts.sheet).toMatch(/Piedziņa \(avots CarVertical rūpnīcas kodi.*\): pilnpiedziņa/);
    expect(facts.sheet).not.toMatch(/aizliegts rakstīt/);
  });

  it("specifikācija AWD pret katalogu FWD - katalogs vājos avotus neapgāž", () => {
    const b = blocks({ carvertical: { aiContextRaw: "Piedziņas tips\nPilnpiedziņa" }, auto_records: oneautoFwd() });
    const res = resolveVehicleDrivetrain(b);
    expect(res.drivetrain).toMatchObject({ awd: true, sourceLabel: "CarVertical specifikācija" });
    expect(res.conflictOnlyCatalog).toBe(true);
    const text = "Pilnpiedziņas sistēma prasa apkopi.";
    expect(stripAwdClaimsForTwoWheelDrive(text, extractVehicleDrivetrain(b))).toBe(text);
    const issues = checkSourceConsistency({ sourceBlocks: b, texts: [{ label: "Kopsavilkums", text }], nowMs: NOW });
    expect(issues.filter((i) => i.severity === "critical")).toEqual([]);
  });

  it("specifikācija un izsole runā pretī - piedziņa nav noteikta, brīdinājums", () => {
    const b = blocks({
      carvertical: { aiContextRaw: "Piedziņas tips\nPilnpiedziņa" },
      cc_vin: {
        thecarapiRecords: [
          { site: "openlane", id: "1", date: "2026-10-01", venue: "Openlane", photoDate: "", photoUrls: [], fields: [{ key: "drive", label: "drive", value: "Front" }], raw: null, rawHistory: null, rawDetail: null, rawImages: null, photos: [] },
        ],
      },
    });
    const res = resolveVehicleDrivetrain(b);
    expect(res.drivetrain).toBeNull();
    const issues = checkSourceConsistency({ sourceBlocks: b, nowMs: NOW });
    const dt = issues.find((i) => i.kind === "drivetrain");
    expect(dt?.severity).toBe("warn");
    expect(dt?.title).toMatch(/nav noteikta/);
  });

  it("tikai OneAuto katalogs (bez aprīkojuma) - piedziņa nezināma, faktu lapā «nav apstiprināta», bez aizlieguma", () => {
    const b = blocks({ auto_records: oneautoFwd() });
    const res = resolveVehicleDrivetrain(b);
    expect(res.drivetrain).toBeNull();
    expect(res.catalogHint).toEqual({ awd: false, source: OEM_DRIVETRAIN_SOURCE_LABEL });
    const facts = buildCanonicalFacts({ sourceBlocks: b, vin: "TESTVIN0000000001" });
    expect(facts.sheet).toMatch(/Piedziņa pēc ražotāja katalogs \(OneAuto\) - nav apstiprināta/);
    expect(facts.sheet).not.toMatch(/aizliegts rakstīt/);
    const issues = checkSourceConsistency({
      sourceBlocks: b,
      texts: [{ label: "Risku analīze", text: "Pilnpiedziņas Haldex sajūgs jāpārbauda." }],
      nowMs: NOW,
    });
    expect(issues.filter((i) => i.kind === "ai_drivetrain")).toEqual([]);
  });

  it("nopirkts OneAuto aprīkojums (build sheet) ar piedziņu - augsta ticamība", () => {
    const b = blocks({
      carvertical: { aiContextRaw: "Piedziņas tips\nPilnpiedziņa" },
      auto_records: {
        oneautoIngest: { results: { oe_build_sheet: { payload: { result: { oem_drivetrain_desc: "Front-Wheel Drive" } } } } },
      },
    });
    const res = resolveVehicleDrivetrain(b);
    expect(res.tier).toBe("factory_codes");
    expect(res.drivetrain).toMatchObject({ awd: false, sourceLabel: "OneAuto aprīkojums (build sheet)" });
  });

  it("4MATIC RWD gadījums (DMR «Baghjulstrukket» + katalogs 4x2) paliek RWD arī ar CarVertical modeļa nosaukumu", () => {
    const b = blocks({
      csdd: { makeModel: "MERCEDES BENZ E 300 DE 4MATIC" },
      carvertical: { aiContextRaw: "Modelis\nE 300 de 4MATIC" },
      auto_records: {
        outvinReport: { vehicleInfo: { ...emptyOutvinVehicleInfo(), drive: "4x2 (RWD)" }, equipment: [], accidentCheck: "", stolenCheck: "" },
      },
      tjekbil: {
        statusRecords: "Jauda / piedziņa: 194 HK (143 kW) · Aizmugurējo riteņu piedziņa\nDzenošās asis (DMR): 2 (pilnpiedziņa)",
        rawUnprocessedData: '{"traekkendeAksler": "2", "traekhjul": "Baghjulstrukket"}',
      },
    });
    const res = resolveVehicleDrivetrain(b);
    expect(res.tier).toBe("registry");
    expect(res.drivetrain).toMatchObject({ awd: false });
    expect(res.conflict).toBe(true);
    expect(stripAwdClaimsForTwoWheelDrive("E 300 de 4MATIC universālis ar pilnpiedziņu.", res.drivetrain)).toBe("E 300 de universālis.");
    const issues = checkSourceConsistency({
      sourceBlocks: b,
      texts: [{ label: "Risku analīze", text: "Auto ar 4MATIC pilnpiedziņu." }],
      nowMs: NOW,
    });
    expect(issues.find((i) => i.kind === "ai_drivetrain")?.severity).toBe("critical");
  });

  it("rūpnīcas kodi un reģistrs runā pretī - null", () => {
    const b = blocks({
      carvertical: { aiContextRaw: "AG02POWER TRAIN AWD 4-wheel drive" },
      tjekbil: { rawUnprocessedData: '{"traekhjul": "Forhjulstrukket"}' },
    });
    expect(extractVehicleDrivetrain(b)).toBeNull();
  });
});

describe("2. ražošanas datums: VIN Decoder gads netiek lietots", () => {
  it("vin_decoder manufactured_year izmests; OE VIN Lookup paliek", () => {
    const dec = buildOneautoDisplay({ vin_decoder: { result: { manufacturer_desc: "BMW", manufactured_year: 2014 } } });
    expect(dec.powertrain.some((r) => /manufactured/i.test(r.label))).toBe(false);
    expect(dec.powertrain.some((r) => /manufacturer/i.test(r.label))).toBe(true);
    expect(oneautoPowertrainToVehicleInfo(dec.powertrain).vehicleInfo.productionDate ?? "").toBe("");

    const oe = buildOneautoDisplay({ oe_vin_lookup: { result: { manufactured_year: 2012 } } });
    expect(oneautoPowertrainToVehicleInfo(oe.powertrain).vehicleInfo.productionDate).toBe("2012");
  });

  it("modeļa gads nekļūst par ražošanas datumu", () => {
    const { vehicleInfo, leftovers } = oneautoPowertrainToVehicleInfo([{ label: "oem model year", value: "2014" }]);
    expect(vehicleInfo.productionDate ?? "").toBe("");
    expect(leftovers).toContainEqual({ label: "Modeļa gads", value: "2014" });
  });

  it("vēlāks par pirmo reģistrāciju / agrāko dīlera ierakstu - nerāda", () => {
    expect(productionDateContradictsRecords("2014", ["2012-09-07", "03.09.2012"])).toBe(true);
    expect(productionDateContradictsRecords("2012", ["2012-09-07"])).toBe(false);
    expect(productionDateContradictsRecords("15.03.2020", ["10.03.2020"])).toBe(true);
    expect(productionDateContradictsRecords("03.2020", ["10.03.2020"])).toBe(false);
    expect(productionDateContradictsRecords("", ["2012-09-07"])).toBe(false);
    expect(plausibleProductionDate("2014", ["2012-09-07"])).toBe("");
    const vi = { ...emptyOutvinVehicleInfo(), model: "BMW 320d", productionDate: "2014", firstRegistration: "" };
    expect(dealerVehicleInfoForDisplay(vi, "BMW 320d", ["03.09.2012"]).productionDate).toBe("");
    expect(dealerVehicleInfoForDisplay(vi, "BMW 320d", ["03.09.2015"]).productionDate).toBe("2014");
  });
});

/** GLE: CSDD 4 īpašnieki LV (no 01.03.2023), CarVertical 5 «Mainītas īpašumtiesības» Latvijā. */
function gleBlocks(): WorkspaceSourceBlocks {
  return blocks({
    csdd: {
      makeModel: "MERCEDES BENZ GLE",
      registrationNumber: "XX0000",
      firstRegistration: "2019-03-26",
      firstRegistrationLatvia: "2023-03-01",
      previousRegistrationCountry: "IGAUNIJA",
      ownerCountLatvia: "4",
      ownerRegistrationEvents: [
        { date: "01.03.2023", label: "Pirmā reģistrācija Latvijā" },
        { date: "06.02.2024", label: "Īpašnieka maiņa" },
        { date: "02.12.2024", label: "Īpašnieka maiņa" },
        { date: "07.03.2025", label: "Īpašnieka maiņa" },
      ],
      registry: { nr1: "TEST", fetchedAt: "2026-11-04T17:33:22.705Z", data: {} },
    },
    carvertical: {
      vehicleHistoryTimeline: [
        { date: "01.03.2019", country: "", description: "Pirmā reģistrācija" },
        { date: "01.03.2023", country: "Latvija", description: "Mainītas īpašumtiesības" },
        { date: "01.09.2023", country: "Latvija", description: "Mainītas īpašumtiesības" },
        { date: "01.02.2024", country: "Latvija", description: "Mainītas īpašumtiesības" },
        { date: "01.02.2025", country: "Latvija", description: "Mainītas īpašumtiesības" },
        { date: "01.03.2025", country: "Latvija", description: "Mainītas īpašumtiesības" },
      ],
    },
  });
}

describe("3. īpašnieku apgalvojumi AI tekstā", () => {
  it("«ārvalstīs pirms reģistrācijas Latvijā» un «9 īpašnieki» - brīdinājumi; pareizi skaitļi - nē", () => {
    const b = gleBlocks();
    const bad = findOwnerClaimIssues(
      "Reģistrācijas notikumu sadaļā norādītas piecas īpašumtiesību maiņas ārvalstīs pirms automašīnas reģistrācijas Latvijā.",
      b,
    );
    expect(bad.map((i) => i.id)).toEqual(["owner_foreign_before_lv"]);
    expect(bad[0]!.message).toContain("01.09.2023");

    const nine = findOwnerClaimIssues("Kopējā vēsturē fiksēti 9 īpašnieki, no tiem Latvijā 4 īpašnieki un 3 īpašnieku maiņas.", b);
    expect(nine).toHaveLength(1);
    expect(nine[0]).toMatchObject({ id: "owner_count_unsourced" });
    expect(nine[0]!.message).toMatch(/9 īpašniekus/);

    expect(findOwnerClaimIssues("Latvijā reģistrēti 4 īpašnieki un 3 īpašnieku maiņas.", b)).toEqual([]);

    const issues = checkSourceConsistency({
      sourceBlocks: b,
      texts: [
        { label: "CarVertical", text: "Norādītas piecas īpašumtiesību maiņas ārvalstīs pirms reģistrācijas Latvijā." },
        { label: "CSDD", text: "Kopējā vēsturē fiksēti 9 īpašnieki." },
      ],
      nowMs: NOW,
    });
    const ai = issues.filter((i) => i.kind === "ai_owners");
    expect(ai.map((i) => i.severity)).toEqual(["warn", "warn"]);
  });

  it("ārvalstu maiņa avotos ir - «ārvalstīs pirms Latvijas» nav kļūda", () => {
    const b = gleBlocks();
    b.autodna = {
      ...b.autodna,
      vehicleHistoryTimeline: [{ date: "11.07.2019", country: "Igaunija", description: "Mainītas īpašumtiesības" }],
    };
    expect(
      findOwnerClaimIssues("Pirms reģistrācijas Latvijā ārvalstīs fiksēta viena īpašumtiesību maiņa.", b).filter(
        (i) => i.id === "owner_foreign_before_lv",
      ),
    ).toEqual([]);
  });

  it("faktu lapā CarVertical notikumi ar valsti, datumu un piezīmi par CSDD", () => {
    const facts = buildCanonicalFacts({ sourceBlocks: gleBlocks(), vin: "TESTVIN0000000001" });
    expect(facts.sheet).toContain("CarVertical īpašumtiesību notikumi (datums, valsts): 01.03.2023 Latvija; 01.09.2023 Latvija");
    expect(facts.sheet).toMatch(/skaita arī reģistrācijas apliecības izmaiņas.*oficiālais skaits Latvijā - CSDD/);
  });
});

describe("4. checkOwners abos virzienos", () => {
  it("CarVertical maiņas pirms CSDD izziņas, kuru CSDD nav - info (apliecības izmaiņa); CSDD maiņa bez CarVertical - info", () => {
    const issues = checkSourceConsistency({ sourceBlocks: gleBlocks(), nowMs: NOW });
    const owners = issues.filter((i) => i.kind === "owners");
    expect(owners.every((i) => i.severity === "info")).toBe(true);
    const cert = owners.find((i) => /reģistrācijas apliecības izmaiņa/.test(i.title));
    expect(cert?.values.map((v) => v.value)).toContain("09.2023");
    const reverse = owners.find((i) => /CSDD īpašnieka maiņa, kuras nav CarVertical/.test(i.title));
    expect(reverse?.values[0]!.value).toBe("12.2024");
  });

  it("Toyota gadījums: CarVertical 05.2026 pirms CSDD izziņas 11.2026 - info, nevis brīdinājums", () => {
    const issues = checkSourceConsistency({
      sourceBlocks: blocks({
        csdd: {
          makeModel: "TOYOTA",
          registrationNumber: "XX0000",
          firstRegistration: "2018-03-10",
          ownerCountLatvia: "1",
          ownerRegistrationEvents: [{ date: "22.08.2023", label: "Pirmā reģistrācija Latvijā" }],
          rawUnprocessedData: "Informācija sagatavota elektroniski 05.11.2026 21:13:52.",
        },
        carvertical: {
          vehicleHistoryTimeline: [
            { date: "01.08.2023", country: "Latvija", description: "Mainītas īpašumtiesības" },
            { date: "01.05.2026", country: "Latvija", description: "Mainītas īpašumtiesības" },
          ],
        },
      }),
      nowMs: NOW,
    });
    const owners = issues.filter((i) => i.kind === "owners");
    expect(owners).toHaveLength(1);
    expect(owners[0]).toMatchObject({ severity: "info" });
    expect(owners[0]!.title).toMatch(/var būt reģistrācijas apliecības izmaiņa/);
  });
});
