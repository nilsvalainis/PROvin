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
    // 21.11: neizturēta apskate ir TA notikums laika joslā, ne negadījums.
    expect(mapped.incidents).toEqual([]);
    expect(
      mapped.timeline.filter((r) => /^Tehniskā apskate: Neizturēta/.test(r.event)).map((r) => r.date),
    ).toEqual(["2023-10-10", "2022-01-27", "2017-08-19"]);
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

describe("tjekbil.dk apskašu rezultātu tulkojumi (zelta VIN)", () => {
  const DANISH_RESULT = /godkend|middel|omsyn|uden ændring|registreringssyn|periodisk syn/i;

  it("Captur: Betinget godkendt un Registreringssyn uden ændring ir latviski", () => {
    const mapped = mapTjekbilPayload({
      dmr: fixture("tjekbil", CAPTUR).body as TjekbilDmrResponse,
      mileagelogs: fixture("tjekbil", `${CAPTUR}.mileagelogs`).body as TjekbilMileageLog[],
    });
    const inspections = mapped.timeline.filter((r) => /apskate/i.test(r.event));
    expect(inspections.find((r) => r.date === "2020-02-03")?.event).toBe(
      "Periodiskā apskate: Nosacīti izturēta · Applus Danmark A/S",
    );
    expect(inspections.find((r) => r.date === "2018-02-21")?.event).toBe(
      "Reģistrācijas apskate bez izmaiņām: Izturēta · Jysk-Bilsyn ApS",
    );
    expect(mapped.mileage.find((r) => r.date === "2020-02-03")?.origin).toContain("nosacīti izturēta");
    // Nosacīti izturēta apskate nav neizturēta - incidentos tās nav.
    expect(mapped.incidents.some((r) => r.date === "2020-02-03")).toBe(false);
  });

  it("Captur un Sharan: apskašu rindās un nobraukuma avotos nepaliek dāņu rezultātu termini", () => {
    for (const vin of [CAPTUR, SHARAN]) {
      const mapped = mapTjekbilPayload({ dmr: fixture("tjekbil", vin).body as TjekbilDmrResponse });
      for (const row of mapped.timeline.filter((r) => /apskate/i.test(r.event))) {
        // Aiz " · " ir apskates stacijas nosaukums (īpašvārds), to netulkojam.
        expect(row.event.split(" · ")[0]).not.toMatch(DANISH_RESULT);
      }
      for (const row of mapped.mileage) {
        expect((row.origin ?? "").replace(/\(synsrapport\)/g, "")).not.toMatch(DANISH_RESULT);
      }
      for (const row of mapped.incidents) expect((row.note ?? "").split(" - ")[0]).not.toMatch(DANISH_RESULT);
    }
  });

  it("Sharan: muitas apskates vērtējums Middel ir latviski", () => {
    const mapped = mapTjekbilPayload({ dmr: fixture("tjekbil", SHARAN).body as TjekbilDmrResponse });
    expect(mapped.timeline.find((r) => /Muitas apskate/.test(r.event))?.event).toBe(
      "Muitas apskate (imports): Stāvoklis vidējs · LK Invest, Kolding ApS",
    );
    expect(mapped.statusRecords).toContain("Stāvoklis pēc importa: Vidējs");
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
      ["2020-02-03", "nosacīti izturēta", "271 000 km"],
      ["2018-02-21", "izturēta", "83 000 km"],
      ["2017-08-24", "izturēta", "171 000 km"],
      ["2017-08-19", "nav izturēta", "171 000 km"],
    ]);
    expect(sp(esynVehicleSummary(chassis.vehicle, inspections).summary)).toBe(
      "Renault Captur, AB12345. 10 apskates, pēdējā 2025-08-22, izturēta, 385 537 km",
    );
  });

  it("Sharan: muitas apskates kods MID ir iztulkots, neviens verdikts nepaliek kā kods", () => {
    const inspections = parseEsynInspections(asResponse(fixture("esyn", `${SHARAN}.chassismake`))[1]);
    const results = inspections.inspections?.map((r) => [r.date, r.result]) ?? [];
    expect(results).toContainEqual(["2026-09-15", "muitas apskate - stāvoklis vidējs"]);
    expect(results).toContainEqual(["2017-12-18", "muitas apskate - stāvoklis vidējs"]);
    expect(results.filter(([, result]) => result === "izturēta").length).toBe(6);
    for (const vin of [SHARAN, CAPTUR]) {
      const parsed = parseEsynInspections(asResponse(fixture("esyn", `${vin}.chassismake`))[1]);
      for (const row of parsed.inspections ?? []) expect(row.result).not.toMatch(/^[A-Z]{2,4}$/);
      expect(parsed.detail ?? "").not.toMatch(/\b(GOD|OOM|BET|MID)\b/);
    }
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

describe("tjekbil.dk neizturēto apskašu trūkumi latviski (zelta VIN)", () => {
  const HEAD = "Tehniskā apskate: Neizturēta (periodiskā apskate), jāveic atkārtota apskate";

  it("Captur: trīs neizturētas apskates laika joslā ar pilnībā latviskiem trūkumu aprakstiem (ne negadījumi)", () => {
    const mapped = mapTjekbilPayload({
      dmr: fixture("tjekbil", CAPTUR).body as TjekbilDmrResponse,
      mileagelogs: fixture("tjekbil", `${CAPTUR}.mileagelogs`).body as TjekbilMileageLog[],
    });
    expect(mapped.incidents).toEqual([]);
    const failed = mapped.timeline.filter((r) => /^Tehniskā apskate: Neizturēta/.test(r.event));
    const faults = (date: string) => failed.find((r) => r.date === date)?.event.split(" · Trūkumi: ")[1];
    expect(failed.every((r) => r.event.startsWith(HEAD))).toBe(true);
    expect(faults("2023-10-10")).toBe(
      "Šasija vai rāmis un pie tā piestiprinātās daļas: stāvoklis, pārmērīga korozija, kas ietekmē savienojumu stiprību, priekšā, būtisks trūkums" +
        " | Asis un balstiekārta: balstiekārtas šarnīri, pārmērīgs nodilums šarnīra tapā un/vai buksēs vai balstiekārtas šarnīros, 1. ass, kreisā puse, būtisks trūkums",
    );
    expect(faults("2022-01-27")).toBe(
      "Asis un balstiekārta: balstiekārtas šarnīri, pārmērīgs nodilums šarnīra tapā un/vai buksēs vai balstiekārtas šarnīros, 1. ass, labā puse, priekšā, būtisks trūkums" +
        " | Asis un balstiekārta: atsperes un stabilizators, atsperes detaļa ir bojāta vai lūzusi, 1. ass, kreisā puse, priekšā, būtisks trūkums" +
        " | Bremžu iekārta, darba bremze: darbības rādītāji, nepietiekama bremzēšanas iedarbība uz vienu vai vairākiem riteņiem, 2. ass, labā puse, aizmugurē, būtisks trūkums" +
        " | Bremžu iekārta, stāvbremze: darbības rādītāji, bremze nedarbojas vienā pusē, vai bremžu pārbaudē uz ceļa transportlīdzeklis bremzējot stipri novirzās no kursa, 2. ass, labā puse, aizmugurē, būtisks trūkums",
    );
    expect(faults("2017-08-19")).toBe("Nesošie elementi: lodbalsts priekšējā piekarē, brīvkustība, pārāk liela, labā puse");
  });

  it("Captur: tas pats iznākums vienādi nosaukts hronoloģijā, nobraukuma avotā un esyn zondē", () => {
    const mapped = mapTjekbilPayload({
      dmr: fixture("tjekbil", CAPTUR).body as TjekbilDmrResponse,
      mileagelogs: fixture("tjekbil", `${CAPTUR}.mileagelogs`).body as TjekbilMileageLog[],
    });
    expect(
      mapped.timeline.find((r) => r.date === "2022-01-27" && /apskate/i.test(r.event))?.event.split(" · Trūkumi: ")[0],
    ).toBe(`${HEAD} · Applus Danmark A/S`);
    expect(mapped.mileage.find((r) => r.date === "2022-01-27")?.origin).toContain(
      "nav izturēta, jāveic atkārtota apskate",
    );
    // Neizturēto apskašu skaits balstās uz dāņu avota tekstu, ne tulkojumu.
    expect(mapped.notes).toContain("Neizturētas apskates: 3.");
  });

  it("Sharan: neizturētu apskašu nav - incidentu saraksts tukšs", () => {
    const mapped = mapTjekbilPayload({ dmr: fixture("tjekbil", SHARAN).body as TjekbilDmrResponse });
    expect(mapped.incidents).toEqual([]);
    expect(mapped.notes.some((n) => /Neizturētas apskates/.test(n))).toBe(false);
  });
});
