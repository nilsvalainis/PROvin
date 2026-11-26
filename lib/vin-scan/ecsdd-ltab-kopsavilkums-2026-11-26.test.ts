import { describe, expect, it } from "vitest";

import { buildAtraFacts } from "@/lib/atra-parbaude-facts";
import type { CsddTechData, CsddTechDataResult } from "@/lib/csdd-tech-data";
import { emptyCsddTechData } from "@/lib/csdd-tech-data";
import { LTAB_SKIP_REASON_LV, resolveLtabQueryTarget } from "@/lib/ltab-query-target";
import { ECSDD_RAW_LONG_HISTORY, ECSDD_RAW_LV_ABROAD } from "@/lib/vin-scan/__fixtures__/ecsdd-smartid-2026-11-26";
import { buildEcsddFacts, ecsddInspectionLine, ECSDD_FACT_ROW_ID, withEcsddFactRow } from "@/lib/vin-scan/ecsdd-facts";
import { vinScanLtabCsddContext } from "@/lib/vin-scan/ltab-csdd-context";
import {
  buildVinScanV4Attention,
  vinScanV4LastOdometerLine,
  vinScanV4LtabContradiction,
  vinScanV4MileageRows,
} from "@/lib/vin-scan/v4-view";

/** 26.11 (Nils): «LTAB ir pretruna!» + e.csdd ielasīts, bet kopsavilkumā «Nav datu» / «- km» / «lasa…». */

const VIN = "WBAXX00000AB12345";

function api(patch: Partial<CsddTechData>): CsddTechDataResult {
  return {
    found: true,
    message: "ok",
    data: {
      ...emptyCsddTechData(),
      vin: VIN,
      make: "BMW",
      model: "330",
      year: "2004",
      firstRegistrationIso: "2004-11-02",
      inspectionValidUntilIso: "2026-12-04",
      insuranceEndIso: "2027-02-23",
      ...patch,
    },
  };
}

function facts(rows: Parameters<typeof buildAtraFacts>[0]["rows"]) {
  return buildAtraFacts({ vin: VIN, plate: "", title: "", year: "", rows, dealer: null, csdd: null, hasListing: false });
}

describe("LTAB: CSDD API rāda LV numuru -> LTAB nedrīkst teikt «nav reģistrēts Latvijā»", () => {
  it("VIN SCAN ar numuru: agrāk tikai VIN + numurs bez statusa -> not_registered_lv (kļūda)", () => {
    const { csdd } = vinScanLtabCsddContext({ vin: VIN, plate: "AB1234", api: null });
    const t = resolveLtabQueryTarget(csdd, VIN);
    // Bez CSDD atbildes nezinām - tas nav «nav LV».
    expect(t).toEqual({ kind: "skip", reason: "no_csdd_data" });
    expect(t.kind === "skip" && LTAB_SKIP_REASON_LV[t.reason]).not.toMatch(/nav reģistrēts Latvijā/);
  });

  it("CSDD API momentuzņēmums ar LV numuru -> LTAB palaižas ar šo numuru", () => {
    const { csdd, plate } = vinScanLtabCsddContext({ vin: VIN, plate: "AB1234", api: api({ registrationNumber: "AB1234" }) });
    expect(plate).toBe("AB1234");
    expect(resolveLtabQueryTarget(csdd, VIN)).toEqual({ kind: "plate", plate: "AB1234", source: "registry" });
  });

  it("skenēts tikai pēc VIN: numuru ņem no CSDD API", () => {
    const { csdd, plate } = vinScanLtabCsddContext({ vin: VIN, plate: "", api: api({ registrationNumber: "AB1234" }) });
    expect(plate).toBe("AB1234");
    expect(resolveLtabQueryTarget(csdd, VIN)).toMatchObject({ kind: "plate", plate: "AB1234" });
  });

  it("CSDD API nesasniedzams, bet e.csdd jau ielasīts («Uzskaitē») -> LTAB palaižas", () => {
    const { csdd, plate } = vinScanLtabCsddContext({ vin: VIN, plate: "", api: { found: false, message: "CSDD pieprasījums noildza" }, ecsddRawText: ECSDD_RAW_LV_ABROAD });
    expect(plate).toBe("AB1234");
    expect(resolveLtabQueryTarget(csdd, VIN)).toEqual({ kind: "plate", plate: "AB1234", source: "csdd_form" });
  });

  it("CSDD API cita auto VIN -> izlaiž (vin_mismatch), nevis «nav LV»", () => {
    const { csdd } = vinScanLtabCsddContext({ vin: VIN, plate: "AB1234", api: api({ registrationNumber: "AB1234", vin: "WVWZZZ1KZAW000001" }) });
    expect(resolveLtabQueryTarget(csdd, VIN)).toEqual({ kind: "skip", reason: "vin_mismatch" });
  });

  it("noņemts no uzskaites e.csdd tekstā -> izlaiž", () => {
    const raw = ECSDD_RAW_LV_ABROAD.replace("Reģistrācijas statuss:\tUzskaitē", "Reģistrācijas statuss:\tNoņemts no uzskaites");
    const { csdd } = vinScanLtabCsddContext({ vin: VIN, plate: "AB1234", api: api({ registrationNumber: "AB1234" }), ecsddRawText: raw });
    expect(resolveLtabQueryTarget(csdd, VIN)).toEqual({ kind: "skip", reason: "not_registered_lv" });
  });
});

describe("Konsekvence: CSDD «reģistrēts LV» pret citu avotu «nav reģistrēts Latvijā»", () => {
  const msg = LTAB_SKIP_REASON_LV.not_registered_lv;

  it("CSDD API numurs -> LTAB teksts tiek aizvietots", () => {
    expect(vinScanV4LtabContradiction(msg, { apiPlate: "AB1234" })).toMatch(/^CSDD: reģistrēts Latvijā \(AB1234\)/);
  });

  it("e.csdd «Uzskaitē» bez API -> arī pretruna", () => {
    const e = buildEcsddFacts(ECSDD_RAW_LV_ABROAD)!;
    expect(vinScanV4LtabContradiction(msg, { ecsddRegistered: e.registeredLv, ecsddPlate: e.plate })).toMatch(/AB1234/);
  });

  it("nav CSDD reģistrācijas vai e.csdd saka noņemts -> paliek kā ir", () => {
    expect(vinScanV4LtabContradiction(msg, {})).toBeNull();
    expect(vinScanV4LtabContradiction(msg, { apiPlate: "AB1234", ecsddRegistered: false })).toBeNull();
    expect(vinScanV4LtabContradiction("Negadījumi nav reģistrēti", { apiPlate: "AB1234" })).toBeNull();
  });
});

describe("e.csdd (2. solis) -> «Galvenā informācija»", () => {
  it("1. gadījums: LV + ārvalstu nobraukums, CSNg «Nav», statuss Uzskaitē", () => {
    const e = buildEcsddFacts(ECSDD_RAW_LV_ABROAD)!;
    expect(e.registeredLv).toBe(true);
    expect(e.plate).toBe("AB1234");
    expect(e.nextInspectionIso).toBe("2026-12-04");
    expect(e.csng).toEqual({ checked: true, items: [] });
    const f = facts(withEcsddFactRow([], ECSDD_RAW_LV_ABROAD));
    expect(f.mileage.points.map((p) => [p.date, p.km, p.country])).toEqual([
      ["2019-05-22", 348958, "DE"],
      ["2026-04-24", 499579, "LV"],
    ]);
    expect(vinScanV4LastOdometerLine(f.mileage.last)).toBe("499 579 km · 24.04.2026 · e.csdd");
    expect(f.countries).toEqual(["DE", "LV"]);
  });

  it("2. gadījums: visas 23 «Nobraukuma vēsture LV» rindas, pēdējais 489 009 km 24.02.2026", () => {
    const f = facts(withEcsddFactRow([], ECSDD_RAW_LONG_HISTORY));
    expect(f.mileage.points).toHaveLength(23);
    expect(vinScanV4LastOdometerLine(f.mileage.last)).toBe("489 009 km · 24.02.2026 · e.csdd");
    expect(f.mileage.drop).toBeNull();
    const rows = vinScanV4MileageRows(f.mileage.points);
    expect(rows[0]).toMatchObject({ date: "24.02.2026", km: 489009, diff: 2413, drop: false });
    expect(rows[1]).toMatchObject({ date: "28.01.2026", km: 486596, diff: 30469 });
    expect(rows[rows.length - 1]).toMatchObject({ date: "15.06.2010", km: 121083, diff: null });
  });

  it("2. gadījums: TA defekti - jaunākā apskate un iepriekšējā; defekti nonāk «Uzmanību»", () => {
    const e = buildEcsddFacts(ECSDD_RAW_LONG_HISTORY)!;
    expect(e.inspections[0]).toMatchObject({ date: "24.02.2026", rating: "1 - Ar pieļaujamiem defektiem", odometer: "489009" });
    expect(e.inspections[0]!.defects.map((d) => d.code)).toEqual(["6.1.1.", "8.4.1."]);
    const prev = e.inspections.find((i) => i.date === "28.01.2026")!;
    expect(prev.defects).toHaveLength(7);
    expect(prev.defects.filter((d) => d.rating === "2")).toHaveLength(5);
    expect(ecsddInspectionLine(e)).toBe("24.02.2026 · 1 - Ar pieļaujamiem defektiem · 2 defekti");
    expect(e.nextInspectionIso).toBe("2027-02-24");
    const f = facts(withEcsddFactRow([], ECSDD_RAW_LONG_HISTORY));
    expect(f.inspection.count).toBeGreaterThanOrEqual(2);
    expect(f.inspection.sources).toContain("e.csdd");
    // «Uzmanību» kartītei AdminVinScanV4 pievieno katru jaunākās apskates defektu kā karogu.
    const flags = buildVinScanV4Attention(
      f,
      e.inspections[0]!.defects.map((d) => ({ text: `TA defekts (${d.rating}): ${d.description}`, source: "e.csdd" })),
    );
    expect(flags.map((x) => x.text)).toContain("TA defekts (1): Virspusēja rāmja vai nesošā elementa korozija.");
  });

  it("tas pats rādījums no diviem avotiem: viens punkts, avoti apvienoti", () => {
    const rows = withEcsddFactRow(
      [{ id: "autodna_precheck", label: "AutoDNA", country: "", status: "found", summary: "", mileage: [{ date: "24.02.2026", odometer: "489009" }] }],
      ECSDD_RAW_LONG_HISTORY,
    );
    const f = facts(rows);
    expect(f.mileage.points).toHaveLength(23);
    expect(f.mileage.last?.source).toBe("AutoDNA · e.csdd");
  });

  it("kritums pret iepriekšējo maksimumu tiek atzīmēts tabulā", () => {
    const f = facts(
      withEcsddFactRow(
        [{ id: "auction", label: "Izsole", country: "DE", status: "found", summary: "", mileage: [{ date: "01.03.2026", odometer: "300000" }] }],
        ECSDD_RAW_LONG_HISTORY,
      ),
    );
    const rows = vinScanV4MileageRows(f.mileage.points);
    expect(rows[0]).toMatchObject({ date: "01.03.2026", km: 300000, drop: true });
    expect(rows[0]!.diff).toBeLessThan(0);
    expect(f.mileage.drop?.km).toBe(189009);
  });

  it("bez e.csdd teksta nav rindas un nav «- km»", () => {
    expect(buildEcsddFacts("")).toBeNull();
    expect(withEcsddFactRow([], null)).toEqual([]);
    expect(vinScanV4LastOdometerLine(null)).toBe("");
    const rows = withEcsddFactRow([], ECSDD_RAW_LV_ABROAD);
    expect(rows.filter((r) => r.id === ECSDD_FACT_ROW_ID)).toHaveLength(1);
    expect(withEcsddFactRow(rows, ECSDD_RAW_LV_ABROAD).filter((r) => r.id === ECSDD_FACT_ROW_ID)).toHaveLength(1);
  });
});
