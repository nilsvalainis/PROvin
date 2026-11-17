/**
 * Čehijas reģistra (Datová kostka RSV, MD ČR) un UK DVSA MOT History API atbilžu parsēšana. Bez tīkla.
 *
 * CZ: GET https://api.dataovozidlech.cz/api/vehicletechnicaldata/v2?vin=..., galvene API_KEY.
 *     Dokumentācija: https://dataovozidlech.cz/data/RSV_Verejna_API_DK_v1_0.pdf (27 pieprasījumi minūtē uz atslēgu).
 * UK: GET https://history.mot.api.gov.uk/v1/trade/vehicles/registration/{reg},
 *     galvenes Authorization: Bearer + X-API-Key. https://documentation.history.mot.api.gov.uk/
 */
import type { VinScanInspection, VinScanParse } from "@/lib/vin-scan/types";

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : typeof v === "number" && Number.isFinite(v) ? String(v) : "";
}

function kmLv(n: number): string {
  return `${Math.round(n).toLocaleString("lv-LV")} km`;
}

function isoDay(v: unknown): string {
  return /^(\d{4}-\d{2}-\d{2})/.exec(str(v))?.[1] ?? "";
}

function parseJson(text: string): unknown | undefined {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

/* ---------------- CZ: Datová kostka RSV ---------------- */

const CZ_LIMIT_RE = /maxim[aá]ln[ií] po[cč]et po[zž]adavk/i;

export function parseCzRsv(status: number, text: string): VinScanParse {
  const data = parseJson(text);
  const rec = asRecord(data);
  const message = str(rec.Message);
  if (status === 429 || CZ_LIMIT_RE.test(message) || CZ_LIMIT_RE.test(text)) {
    return { status: "unknown", summary: "Čehijas reģistrs: atslēgas minūtes limits (27 pieprasījumi)" };
  }
  if (status === 401 || status === 403) {
    return { status: "config_missing", summary: "Čehijas reģistrs: API atslēga nav derīga" };
  }
  if (status === 404) return { status: "none", summary: "VIN nav Čehijas reģistrā" };
  if (status !== 200) return { status: "unknown", summary: `Čehijas reģistrs atbildēja ar HTTP ${status}` };
  if (data === undefined) return { status: "unknown", summary: "Čehijas reģistra atbilde nav JSON" };

  const row = asRecord(rec.Data);
  const make = str(row.TovarniZnacka);
  const model = str(row.ObchodniOznaceni) || str(row.Typ);
  if (!make && !model && !str(row.VIN)) return { status: "none", summary: "VIN nav Čehijas reģistrā" };

  const firstReg = isoDay(row.DatumPrvniRegistrace);
  const firstRegCz = isoDay(row.DatumPrvniRegistraceVCr);
  const year = firstReg.slice(0, 4);
  const owners = typeof row.PocetVlastniku === "number" ? row.PocetVlastniku : null;
  const operators = typeof row.PocetProvozovatelu === "number" ? row.PocetProvozovatelu : null;
  const stk = isoDay(row.PravidelnaTechnickaProhlidkaDo);
  const regStatus = str(row.StatusNazev);
  const imported = Boolean(firstReg && firstRegCz && firstReg !== firstRegCz);

  const bits = [
    [make, model].filter(Boolean).join(" "),
    firstReg ? `pirmā reģ. ${firstReg}` : "",
    imported ? `CZ no ${firstRegCz}` : "",
    owners != null ? `īpašnieki ${owners}` : "",
    regStatus,
  ].filter(Boolean);
  const detail = [
    regStatus ? `Statuss: ${regStatus}` : "",
    firstReg ? `Pirmā reģistrācija: ${firstReg}` : "",
    firstRegCz ? `Pirmā reģistrācija Čehijā: ${firstRegCz}` : "",
    owners != null ? `Īpašnieku skaits: ${owners}` : "",
    operators != null ? `Turētāju skaits: ${operators}` : "",
    stk ? `Tehniskā apskate derīga līdz: ${stk}` : "",
    str(row.Palivo) ? `Degviela: ${str(row.Palivo)}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return {
    status: "found",
    summary: bits.join(", "),
    detail,
    vehicle: make || model || year ? { make, model, year } : undefined,
    flags: { registrationCountry: "CZ" },
  };
}

/* ---------------- UK: DVSA MOT History API ---------------- */

const MILES_TO_KM = 1.609344;

export type DvsaMotDefectCounts = { dangerous: number; major: number; minor: number; advisory: number; prs: number };

export type DvsaMotTestRow = {
  date: string;
  result: string;
  passed: boolean | null;
  /** Kilometri (jūdzes pārrēķinātas). null, ja odometrs nav nolasīts. */
  km: number | null;
  defects: DvsaMotDefectCounts;
};

/** Jūdzes -> km. Vienība "mi"/"MI" = jūdzes, "km"/"KM" = kilometri. */
export function dvsaOdometerKm(value: unknown, unit: unknown, resultType: unknown): number | null {
  const type = str(resultType).toUpperCase();
  if (type && type !== "READ" && type !== "OK") return null;
  const n = Number(str(value).replace(/[^\d.]/g, ""));
  if (!Number.isFinite(n) || n <= 0) return null;
  return /^mi/i.test(str(unit)) ? Math.round(n * MILES_TO_KM) : Math.round(n);
}

function defectCounts(raw: unknown): DvsaMotDefectCounts {
  const out: DvsaMotDefectCounts = { dangerous: 0, major: 0, minor: 0, advisory: 0, prs: 0 };
  for (const item of Array.isArray(raw) ? raw : []) {
    const d = asRecord(item);
    const type = str(d.type).toUpperCase();
    if (d.dangerous === true || type === "DANGEROUS") out.dangerous += 1;
    else if (type === "MAJOR" || type === "FAIL") out.major += 1;
    else if (type === "MINOR") out.minor += 1;
    else if (type === "ADVISORY") out.advisory += 1;
    else if (type === "PRS") out.prs += 1;
  }
  return out;
}

export function formatDvsaDefects(c: DvsaMotDefectCounts): string {
  return [
    c.dangerous ? `${c.dangerous} bīstami` : "",
    c.major ? `${c.major} būtiski` : "",
    c.minor ? `${c.minor} nebūtiski` : "",
    c.prs ? `${c.prs} novērsti uz vietas` : "",
    c.advisory ? `${c.advisory} ieteikumi` : "",
  ]
    .filter(Boolean)
    .join(", ");
}

function motResultLv(raw: string): { text: string; passed: boolean | null } {
  const r = raw.toUpperCase();
  if (r === "PASSED" || r === "PASS") return { text: "izturēta", passed: true };
  if (r === "FAILED" || r === "FAIL") return { text: "nav izturēta", passed: false };
  return { text: raw ? raw.toLowerCase() : "nav rezultāta", passed: null };
}

export function dvsaMotTests(raw: unknown): DvsaMotTestRow[] {
  const tests = asRecord(raw).motTests;
  return (Array.isArray(tests) ? tests : [])
    .map((item) => {
      const t = asRecord(item);
      const date = isoDay(t.completedDate);
      const { text, passed } = motResultLv(str(t.testResult));
      return {
        date,
        result: text,
        passed,
        km: dvsaOdometerKm(t.odometerValue, t.odometerUnit, t.odometerResultType),
        defects: defectCounts(t.defects),
      };
    })
    .filter((row) => row.date)
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function parseDvsaMot(status: number, text: string): VinScanParse {
  if (status === 404) return { status: "none", summary: "UK numurs nav MOT vēsturē" };
  if (status === 401 || status === 403) {
    return { status: "config_missing", summary: "UK MOT: piekļuve noraidīta (pārbaudi DVSA atslēgas)" };
  }
  if (status === 429) return { status: "unknown", summary: "UK MOT: pieprasījumu limits" };
  if (status !== 200) return { status: "unknown", summary: `UK MOT atbildēja ar HTTP ${status}` };
  const data = parseJson(text);
  if (data === undefined) return { status: "unknown", summary: "UK MOT atbilde nav JSON" };
  const vehicle = asRecord(Array.isArray(data) ? data[0] : data);
  const make = str(vehicle.make);
  const model = str(vehicle.model);
  const year = (isoDay(vehicle.manufactureDate) || isoDay(vehicle.firstUsedDate) || isoDay(vehicle.registrationDate)).slice(0, 4);
  const tests = dvsaMotTests(vehicle);
  if (!make && !model && !str(vehicle.registration) && tests.length === 0) {
    return { status: "none", summary: "UK numurs nav MOT vēsturē" };
  }

  const inspections: VinScanInspection[] = tests.map((t) => {
    const defects = formatDvsaDefects(t.defects);
    return {
      date: t.date,
      result: defects ? `${t.result} (${defects})` : t.result,
      odometer: t.km != null ? kmLv(t.km) : "",
    };
  });
  const mileage = tests.filter((t) => t.km != null).map((t) => ({ date: t.date, odometer: kmLv(t.km!) }));
  const failed = tests.filter((t) => t.passed === false).length;
  const latest = inspections[0];
  const name = [make, model].filter(Boolean).join(" ");
  const testsPart = tests.length
    ? `${tests.length} MOT apskates${failed ? ` (${failed} neizturētas)` : ""}, pēdējā ${[latest!.date, tests[0]!.result, latest!.odometer].filter(Boolean).join(", ")}`
    : "MOT apskašu nav";

  return {
    status: "found",
    summary: [name, testsPart].filter(Boolean).join(". "),
    detail: inspections.map((r) => [r.date, r.result, r.odometer].filter(Boolean).join(", ")).join("\n"),
    vehicle: make || model || year ? { make, model, year } : undefined,
    mileage,
    inspections,
    flags: { registrationCountry: "UK" },
  };
}
