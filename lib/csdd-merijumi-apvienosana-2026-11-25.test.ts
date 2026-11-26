/**
 * Nils 25.11: pēc maksas SMS izziņas PDF «Tehniskie mērījumi TA 15.05.2026» zaudēja CO2 un atgāzu cietās daļiņas,
 * bet parādījās dūmainība no CITAS (vecākas, 17.07.2024) TA. Dati izdomāti (numurs/VIN fiktīvi).
 */
import { describe, expect, it } from "vitest";

import { emptyCsddFields } from "@/lib/admin-source-blocks";
import { mergeCsddMeasurements, parseCsddMeasurements, type CsddMeasurements } from "@/lib/csdd-bloki";
import { extractCsddMeasurementsText } from "@/lib/csdd-measurements-carry";
import { buildCsddLocalParseFromText } from "@/lib/csdd-pdf-ingest";
import { applyCsddPasteToForm, parseCsddPaste } from "@/lib/csdd-paste-parse";
import { applyCsddPaidReportToForm } from "@/lib/ecsdd-paid-logic";

/** e.csdd Smart-ID relejs (tadati): pēdējā TA mērījumi + bremzes. */
const ECSDD_TADATI = [
  "Tehniskie dati",
  "Pārbaudes veids:\tPamatpārbaude",
  "Reģistrācijas statuss:\tUzskaitē",
  "Marka, modelis:\tBMW X6 XDRIVE30D",
  "Reģistrācijas numurs:\tZZ0001",
  "Pirmās reģistrācijas datums:\t29.06.2016",
  "Emisiju standarts:\tEuro 6 W",
  "Nākamās apskates datums:\t21.05.2027",
  "Odometra rādījums:\t180180",
  "Novērtējums:\t0 - Teicamā tehniskā stāvoklī",
  "CO2:\t157",
  "Atgāzu cietās daļiņas (cm-3):\t1 700",
  "Degvielas veids:\tDīzeļdegviela",
  "Degvielas patēriņš:\t6.0 litri/100 km",
  "- pilsētā\t6.7 litri/100 km",
  "- ārpus pilsētas\t5.5 litri/100 km",
  "Motora maksimālā jauda (kW):\t190",
  "",
  "Bremžu vērtējums",
  "Ass\tKreisais\tLabais\tBremžu tips",
  "1\t3.28\t3.52\tD",
  "2\t3.18\t3.26\tD",
  "2\t2.65\t3.27\tS",
  "D - Darba bremzes; S - Stāvbremzes",
  "",
  "Nobraukuma vēsture LV",
  "Datums:\tOdometrs\tNobraukums",
  "15.05.2026\t180180\t18987",
  "16.06.2025\t161193\t25925",
  "17.07.2024\t135268\t14562",
].join("\n");

/** Maksas SMS izziņas PDF teksts: pēdējā TA bez mērījumiem, vēsturē daļiņas (2025) un dūmainība (2024). */
const PAID_PDF = [
  "Reģistrācijas dati",
  "Reģistrācijas numurs ZZ0001",
  "Statuss Uzskaitē",
  "Marka Modelis BMW X6 XDRIVE30D",
  "Degviela Dīzeļdegviela",
  "VIN WBAZZZ00000000001",
  "Izlaiduma gads 2016",
  "Nobraukuma vēsture",
  "Nobraukums, datums",
  "180180- 15.05.2026",
  "161193- 16.06.2025",
  "135268- 17.07.2024",
  "Pēdējā tehniskā apskate",
  "TA Uzlīme",
  "TA datums 15.05.2026",
  "Nākošā TA 21.05.2027",
  "Odometra rādījums 180180",
  "Novērtējums 0 - Teicamā tehniskā stāvoklī",
  "CO (%)",
  "CO paaugst.(%)",
  "HC (ppm)",
  "Lambda",
  "Dūmainības koeficients (m-1):",
  "Tehnisko apskašu vēsture",
  "Apskates datums 16.06.2025",
  "Apskates tips pamatpārbaude",
  "Novērtējums 0 - Teicamā tehniskā stāvoklī",
  "Atgāzu cietās daļiņas (cm-3): 7000",
  "Apskates datums 17.07.2024",
  "Apskates tips pamatpārbaude",
  "Novērtējums 0 - Teicamā tehniskā stāvoklī",
  "Dūmainības koeficients (m-1): 0.04",
  "Informācija sagatavota elektroniski 25.11.2026 13:50:00.",
].join("\n");

function formFromEcsdd() {
  return applyCsddPasteToForm({ ...emptyCsddFields(), rawUnprocessedData: ECSDD_TADATI }, ECSDD_TADATI, parseCsddPaste(ECSDD_TADATI));
}

describe("CSDD tehniskie mērījumi: e.csdd + maksas izziņa (Nils 25.11)", () => {
  it("e.csdd vien: CO2, patēriņš (arī pilsētā), daļiņas, bremzes", () => {
    const f = formFromEcsdd();
    const m = parseCsddMeasurements({ ...f, prevInspectionDate: f.prevInspectionDate || "2026-05-15" });
    expect(m.co2).toBe("157");
    expect(m.consumption).toBe("6.0");
    expect(m.consumptionCity).toBe("6.7");
    expect(m.brakes).toHaveLength(3);
  });

  it("pēc maksas izziņas: CO2 / patēriņš / bremzes / daļiņas paliek, nav dūmainības no citas TA", () => {
    const before = { ...formFromEcsdd(), prevInspectionDate: "2026-05-15" };
    const parsed = buildCsddLocalParseFromText(PAID_PDF, "e.csdd maksas izziņa");
    const after = applyCsddPaidReportToForm(before, parsed.fields, parsed.rawUnprocessedData || PAID_PDF);

    expect(after.rawUnprocessedData).toContain("Tehnisko apskašu vēsture");
    expect(after.measurementsCarry?.taDate).toBe("15.05.2026");
    expect(after.measurementsCarry?.text).toContain("CO2:\t157");
    expect(after.measurementsCarry?.text).not.toContain("Nobraukuma");

    const m = parseCsddMeasurements(after);
    expect(m.taDate).toBe("15.05.2026");
    expect(m.co2).toBe("157");
    expect(m.consumption).toBe("6.0");
    expect(m.euro).toBeTruthy();
    expect(m.particles).toBe("1 700");
    // 0.04 ir 17.07.2024 TA mērījums - zem «TA 15.05.2026» to nerāda.
    expect(m.smoke).toBe("");
    expect(m.brakes.map((b) => b.right)).toEqual(["3.52", "3.26", "3.27"]);
  });

  it("otrs PDF imports pēc tam carry nezaudē", () => {
    const before = { ...formFromEcsdd(), prevInspectionDate: "2026-05-15" };
    const parsed = buildCsddLocalParseFromText(PAID_PDF, "x");
    const once = applyCsddPaidReportToForm(before, parsed.fields, PAID_PDF);
    const twice = applyCsddPaidReportToForm(once, parsed.fields, PAID_PDF);
    expect(twice.measurementsCarry).toEqual(once.measurementsCarry);
    expect(parseCsddMeasurements(twice).co2).toBe("157");
  });

  it("carry teksts neņem TA vēstures rindas", () => {
    expect(extractCsddMeasurementsText(PAID_PDF)).toBe("");
    const t = extractCsddMeasurementsText(ECSDD_TADATI);
    expect(t).toMatch(/Atgāzu cietās daļiņas \(cm-3\):\s+1 700/);
    expect(t).toContain("Bremžu vērtējums");
    expect(t).not.toMatch(/Odometra|Novērtējums|15\.05\.2026/);
  });
});

describe("mergeCsddMeasurements", () => {
  const base: CsddMeasurements = {
    taDate: "",
    co2: "",
    co2Cycle: "",
    consumption: "",
    consumptionCycle: "",
    consumptionCity: "",
    euro: "",
    co: "",
    coHigh: "",
    hc: "",
    lambda: "",
    smoke: "",
    particles: "",
    brakes: [],
  };

  it("tukšs nekad nepārraksta aizpildītu; atšķirīgas vērtības - jaunākās TA", () => {
    const newer = { ...base, taDate: "15.05.2026", co2: "157", smoke: "" };
    const older = { ...base, taDate: "17.07.2024", co2: "160", consumption: "6.1", smoke: "0.04" };
    const m = mergeCsddMeasurements(newer, older);
    expect(m.taDate).toBe("15.05.2026");
    expect(m.co2).toBe("157");
    expect(m.consumption).toBe("6.1");
    // Vecākas TA mērījums netiek rādīts pie jaunākas TA.
    expect(m.smoke).toBe("");

    const m2 = mergeCsddMeasurements(older, newer);
    expect(m2.taDate).toBe("15.05.2026");
    expect(m2.co2).toBe("157");
    expect(m2.smoke).toBe("");
  });

  it("tā pati TA: lauki papildina viens otru", () => {
    const a = { ...base, taDate: "15.05.2026", particles: "1 700" };
    const b = { ...base, taDate: "15.05.2026", co2: "157", hc: "5" };
    const m = mergeCsddMeasurements(a, b);
    expect([m.particles, m.co2, m.hc]).toEqual(["1 700", "157", "5"]);
  });
});
