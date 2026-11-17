/**
 * "Zelta VIN" testi: reālas (saglabātas) avotu atbildes caur īstajiem parseriem.
 * Fiksācijas: lib/vin-scan/__fixtures__/{nhtsa,tjekbil,esyn}. Atjaunot: node scripts/vin-scan-refresh-fixtures.mjs
 * Ja avots maina formātu, šie testi krīt - tā ir jēga.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  esynVehicleSummary,
  parseEsynChassis,
  parseEsynInspections,
  parseNhtsaDecode,
  parseTjekbilProbe,
} from "@/lib/vin-scan/parse";
import { decodeVinLocal, mergeVinDecodeWithVpic } from "@/lib/vin-scan/vin-decode";
import { mapTjekbilPayload, tjekbilKid, type TjekbilDmrResponse, type TjekbilMileageLog } from "@/lib/vin-sources/tjekbil-map";

type Fixture = { _meta: { url: string; status: number }; body: unknown };

function fixture(source: string, name: string): Fixture {
  const file = path.join(process.cwd(), "lib/vin-scan/__fixtures__", source, `${name}.json`);
  return JSON.parse(readFileSync(file, "utf8")) as Fixture;
}

/** lv-LV tūkstošu atdalītājs ir nedalāmā atstarpe; salīdzinām ar parastu atstarpi. */
function sp<T>(v: T): T {
  return JSON.parse(JSON.stringify(v).replace(/[\u00a0\u202f]/g, " ")) as T;
}

function asResponse(f: Fixture): [number, string] {
  return [f._meta.status, typeof f.body === "string" ? f.body : JSON.stringify(f.body)];
}

const BMW = "WBA5R1C0XLFH42873";
const SKODA = "TMBJH9NP9N7043581";
const HONDA = "1HGCM82633A004352";
const SHARAN = "WVWZZZ7NZEV015204";
const CAPTUR = "VF12RFL1H49621453";
const VOLVO_MISS = "YV1DZ5251B2146640";

describe("NHTSA vPIC (zelta VIN)", () => {
  it("BMW: vPIC dod modeli, apvienojumā valsts no WMI", () => {
    const vpic = parseNhtsaDecode(...asResponse(fixture("nhtsa", BMW)));
    expect(vpic.status).toBe("found");
    expect(vpic.vehicle).toEqual({ make: "BMW", model: "330i", year: "2020" });

    const merged = mergeVinDecodeWithVpic(decodeVinLocal(BMW), vpic);
    expect(merged.summary).toBe("2020 BMW 330i Vācija");
    expect(merged.vehicle).toEqual({ make: "BMW", model: "330i", year: "2020" });
    expect(merged.flags?.registrationCountry).toBe("DE");
  });

  it("Škoda: NHTSA neatkodē (ErrorCode 7), paliek lokālais dekodējums", () => {
    const vpic = parseNhtsaDecode(...asResponse(fixture("nhtsa", SKODA)));
    expect(vpic.status).toBe("none");
    expect(vpic.detail).toMatch(/^7 - Manufacturer is not registered/);

    const local = decodeVinLocal(SKODA);
    expect(local).toMatchObject({ make: "Škoda", year: "2022", countryCode: "CZ", checkDigitOk: true });
    const merged = mergeVinDecodeWithVpic(local, vpic);
    expect(merged.status).toBe("found");
    expect(merged.summary).toBe("2022 Škoda Čehija");
    expect(merged.vehicle).toEqual({ make: "Škoda", model: "", year: "2022" });
  });

  it("Honda: tīrs ASV dekodējums", () => {
    const vpic = parseNhtsaDecode(...asResponse(fixture("nhtsa", HONDA)));
    expect(vpic.status).toBe("found");
    expect(vpic.summary).toBe("2003 HONDA Accord");
    const merged = mergeVinDecodeWithVpic(decodeVinLocal(HONDA), vpic);
    expect(merged.summary).toBe("2003 HONDA Accord ASV");
    expect(merged.flags?.registrationCountry).toBe("US");
  });
});

describe("tjekbil.dk zonde (zelta VIN)", () => {
  it("Sharan: atrasts, izņemts no uzskaites", () => {
    const parsed = parseTjekbilProbe(...asResponse(fixture("tjekbil", SHARAN)));
    expect(parsed.status).toBe("found");
    expect(parsed.summary).toBe("VOLKSWAGEN SHARAN, 2013, CM53865, Afmeldt");
    expect(parsed.vehicle).toEqual({ make: "VOLKSWAGEN", model: "SHARAN", year: "2013" });
  });

  it("Captur: atrasts, reģistrēts", () => {
    const parsed = parseTjekbilProbe(...asResponse(fixture("tjekbil", CAPTUR)));
    expect(parsed.status).toBe("found");
    expect(parsed.vehicle).toEqual({ make: "RENAULT", model: "Captur", year: "2013" });
  });

  it("Volvo: 404 = nav Dānijas reģistrā", () => {
    const f = fixture("tjekbil", VOLVO_MISS);
    expect(f._meta.status).toBe(404);
    expect(parseTjekbilProbe(...asResponse(f))).toEqual({ status: "none", summary: "VIN nav Dānijas reģistrā" });
  });

  it("kid ņemts no DMR atbildes (vajadzīgs mileagelogs pieprasījumam)", () => {
    expect(tjekbilKid(fixture("tjekbil", CAPTUR).body as TjekbilDmrResponse)).toBe(9000000000487315);
    expect(tjekbilKid(fixture("tjekbil", SHARAN).body as TjekbilDmrResponse)).toBe(9000000002522614);
  });
});

describe("tjekbil.dk pilnā karte (zelta VIN)", () => {
  it("Sharan bez mileagelogs: nobraukums tikai no apskatēm, imports 2017", () => {
    const mapped = mapTjekbilPayload({ dmr: fixture("tjekbil", SHARAN).body as TjekbilDmrResponse });
    expect(mapped.found).toBe(true);
    expect(mapped.mileage.map((r) => [r.date, r.odometer])).toEqual([
      ["2026-01-28", "188528"],
      ["2024-01-23", "153497"],
      ["2022-02-02", "119000"],
      ["2020-01-16", "87000"],
      ["2017-12-18", "29000"],
    ]);
    expect(mapped.incidents).toEqual([]);
    expect(mapped.ownersSummary).toBe("Īpašnieku skaits Dānijā: 2.");
    expect(mapped.notes).toEqual([]);
    expect(mapped.statusRecords).toContain("Reģistrācijas statuss: Noņemts no uzskaites (12.08.2026)");
    expect(mapped.statusRecords).toContain("Līzings: 18.12.2017 - 21.10.2019 (3 periodi)");
    const firstReg = mapped.timeline.find((r) => r.event === "Pirmā reģistrācija");
    // Pirmā reģistrācija ārzemēs (muitas apskate 2017), tāpēc bez valsts.
    expect(firstReg).toEqual({ date: "2013-12-18", odometer: "", country: "", event: "Pirmā reģistrācija" });
    expect(mapped.timeline.filter((r) => /apskate/i.test(r.event)).length).toBe(6);
  });

  it("Captur ar mileagelogs: nobraukuma rindas, neizturētās apskates, piezīmes", () => {
    const mapped = mapTjekbilPayload({
      dmr: fixture("tjekbil", CAPTUR).body as TjekbilDmrResponse,
      mileagelogs: fixture("tjekbil", `${CAPTUR}.mileagelogs`).body as TjekbilMileageLog[],
    });
    // Tikai valsts reģistru rādījumi (origin 10/20/30). Lietotāja (0) un nedokumentētie (40) izlaisti.
    expect(mapped.mileage.map((r) => [r.date, r.odometer])).toEqual([
      ["2025-08-22", "385537"],
      ["2025-08-22", "385000"],
      ["2025-08-20", "385292"],
      ["2023-10-11", "358886"],
      ["2023-10-10", "358874"],
      ["2023-10-10", "358000"],
      ["2022-02-02", "320000"],
      ["2022-01-27", "320000"],
      ["2020-02-03", "271000"],
      ["2018-02-21", "83000"],
      ["2017-08-24", "171000"],
      ["2017-08-19", "171000"],
      ["2013-08-28", "0"],
    ]);
    expect(mapped.incidents.map((r) => r.date)).toEqual(["2023-10-10", "2022-01-27", "2017-08-19"]);
    expect(sp(mapped.notes)).toContain("Neizturētas apskates: 3.");
    expect(sp(mapped.notes)).toContain("tjekbil.dk atzīmē aizdomīgu odometra rindu.");
    expect(sp(mapped.notes)).toContain("Odometra pretruna: 171 000 km (19.08.2017), pēc tam 83 000 km (21.02.2018).");
    expect(mapped.statusRecords).toContain("Nākamā apskate (DK): 14.10.2027");
  });

  // KĻŪDA (atrasta ar zelta VIN): 2023-10-11 izturētā atkārtotā apskate (358 000 km) tiek
  // apvienota ar 2023-10-10 neizturēto (±3 dienu dublikātu logs), un 2023-10-11 rinda ar 358 000 km pazūd.
  // Pareizi: abas apskates ir atsevišķi notikumi, katram savs datums.
  it.fails("Captur: izturētā atkārtotā apskate 2023-10-11 saglabā savu datumu", () => {
    const mapped = mapTjekbilPayload({
      dmr: fixture("tjekbil", CAPTUR).body as TjekbilDmrResponse,
      mileagelogs: fixture("tjekbil", `${CAPTUR}.mileagelogs`).body as TjekbilMileageLog[],
    });
    expect(mapped.mileage.some((r) => r.date === "2023-10-11" && r.odometer === "358000")).toBe(true);
  });

  // KĻŪDA (atrasta ar zelta VIN): mileagelogs ieraksts ar origin 0 (lietotāja ievadīts tjekbil.dk,
  // ir createdBy) ar 86 km tiek rādīts kā "DMR" rādījums un rada viltus "Odometra pretruna" piezīmi.
  // Pareizi: lietotāja ievadīts rādījums nav DMR avots un nedrīkst radīt odometra pretrunu.
  it("Captur: lietotāja ievadīts 86 km rādījums netiek uzdots par DMR un nerada pretrunu", () => {
    const mapped = mapTjekbilPayload({
      dmr: fixture("tjekbil", CAPTUR).body as TjekbilDmrResponse,
      mileagelogs: fixture("tjekbil", `${CAPTUR}.mileagelogs`).body as TjekbilMileageLog[],
    });
    expect(mapped.mileage.some((r) => r.odometer === "86" && r.origin === "DMR")).toBe(false);
    expect(sp(mapped.notes).some((n) => n.includes("pēc tam 86 km"))).toBe(false);
    // 2000 km 2019. gadā (origin 40, nedokumentēts) arī nerada pretrunu pēc 83 000 km.
    expect(sp(mapped.notes).some((n) => n.includes("pēc tam 2 000 km"))).toBe(false);
    expect(mapped.mileage.every((r) => r.origin !== "DMR")).toBe(true);
  });
});

describe("esyn.dk (zelta VIN)", () => {
  it("Sharan: chassis + chassismake -> 8 apskates, pēdējā ar precīzu odometru", () => {
    const chassis = parseEsynChassis(...asResponse(fixture("esyn", `${SHARAN}.chassis`)), SHARAN);
    expect(chassis).toEqual({
      ok: true,
      vehicle: { make: "VOLKSWAGEN", model: "SHARAN", plate: "", chassis: SHARAN },
    });
    if (!chassis.ok) return;
    const [, listText] = asResponse(fixture("esyn", `${SHARAN}.chassismake`));
    const inspections = parseEsynInspections(listText);
    expect(inspections.count).toBe(8);
    const summary = esynVehicleSummary(chassis.vehicle, inspections);
    expect(summary.status).toBe("found");
    expect(sp(summary.summary)).toBe("VOLKSWAGEN SHARAN. 8 apskates, pēdējā 2026-09-15, izturēta, 198 579 km");
    expect(sp(summary.mileage?.[0])).toEqual({ date: "2026-09-15", odometer: "198 579 km" });
    // Vecās apskates bez exactOdometer: tūkstoši * 1000.
    expect(sp(summary.mileage?.at(-1))).toEqual({ date: "2017-12-18", odometer: "29 000 km" });
  });

  it("Captur: 10 apskates ar OOM/BET verdiktiem", () => {
    const chassis = parseEsynChassis(...asResponse(fixture("esyn", `${CAPTUR}.chassis`)), CAPTUR);
    expect(chassis.ok).toBe(true);
    if (!chassis.ok) return;
    expect(chassis.vehicle).toEqual({ make: "Renault", model: "Captur", plate: "AB12345", chassis: CAPTUR });
    const inspections = parseEsynInspections(asResponse(fixture("esyn", `${CAPTUR}.chassismake`))[1]);
    expect(inspections.count).toBe(10);
    expect(sp(inspections.inspections?.map((r) => [r.date, r.result, r.odometer]))).toEqual([
      ["2025-08-22", "izturēta", "385 537 km"],
      ["2025-08-20", "nav izturēta", "385 292 km"],
      ["2023-10-11", "izturēta", "358 886 km"],
      ["2023-10-10", "nav izturēta", "358 874 km"],
      ["2022-02-02", "izturēta", "320 000 km"],
      ["2022-01-27", "nav izturēta", "320 000 km"],
      ["2020-02-03", "nosacīti", "271 000 km"],
      ["2018-02-21", "izturēta", "83 000 km"],
      ["2017-08-24", "izturēta", "171 000 km"],
      ["2017-08-19", "nav izturēta", "171 000 km"],
    ]);
    expect(sp(esynVehicleSummary(chassis.vehicle, inspections).summary)).toBe(
      "Renault Captur, AB12345. 10 apskates, pēdējā 2025-08-22, izturēta, 385 537 km",
    );
  });

  it("Volvo: 404 ar dāņu kļūdas tekstu = nav reģistrā", () => {
    const f = fixture("esyn", `${VOLVO_MISS}.chassis`);
    expect(f._meta.status).toBe(404);
    expect(parseEsynChassis(...asResponse(f), VOLVO_MISS)).toEqual({
      ok: false,
      status: "none",
      summary: "Nav Dānijas apskašu reģistrā",
    });
  });
});
