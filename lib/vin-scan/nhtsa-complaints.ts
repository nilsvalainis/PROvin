/**
 * NHTSA īpašnieku sūdzības (api.nhtsa.gov/complaints/complaintsByVehicle, oficiāls bezmaksas API bez atslēgas).
 * Vaicājums ir pēc markas/modeļa/gada, nevis pēc VIN: tās ir šī modeļa «tipiskās kaites / sūdzības» ASV tirgū.
 * Tīrs parsētājs bez tīkla. Sūdzību teksti un citu auto VIN daļas rezultātā netiek pārnesti.
 */
import type { VinScanParse } from "@/lib/vin-scan/types";

export const NHTSA_COMPLAINTS_API = "https://api.nhtsa.gov/complaints/complaintsByVehicle";

export function nhtsaComplaintsApiUrl(make: string, model: string, year: string): string {
  const q = new URLSearchParams({ make: make.trim(), model: model.trim(), modelYear: year.trim() });
  return `${NHTSA_COMPLAINTS_API}?${q.toString()}`;
}

/** Publiskā NHTSA lapa operatoram (sūdzības, atsaukumi, izmeklēšanas pēc modeļa). */
export function nhtsaVehiclePageUrl(make: string, model: string, year: string): string {
  const slug = (s: string) => encodeURIComponent(s.trim().toUpperCase());
  if (!make || !model || !year) return "https://www.nhtsa.gov/recalls";
  return `https://www.nhtsa.gov/vehicle/${slug(year)}/${slug(make)}/${slug(model)}`;
}

const COMPONENT_LV: Record<string, string> = {
  ENGINE: "Dzinējs",
  "ENGINE AND ENGINE COOLING": "Dzinējs un dzesēšana",
  "ELECTRICAL SYSTEM": "Elektrosistēma",
  "POWER TRAIN": "Transmisija",
  "AIR BAGS": "Drošības spilveni",
  STEERING: "Stūres iekārta",
  "SERVICE BRAKES": "Bremzes",
  "SERVICE BRAKES, HYDRAULIC": "Bremzes (hidrauliskās)",
  "PARKING BRAKE": "Stāvbremze",
  SUSPENSION: "Balstiekārta",
  "FUEL/PROPULSION SYSTEM": "Degvielas sistēma",
  "FUEL SYSTEM, GASOLINE": "Degvielas sistēma (benzīns)",
  "FUEL SYSTEM, DIESEL": "Degvielas sistēma (dīzelis)",
  "HYBRID PROPULSION SYSTEM": "Hibrīda piedziņa",
  "ELECTRIC PROPULSION SYSTEM": "Elektriskā piedziņa",
  "EXTERIOR LIGHTING": "Ārējais apgaismojums",
  "VISIBILITY/WIPER": "Redzamība / tīrītāji",
  VISIBILITY: "Redzamība",
  STRUCTURE: "Virsbūve",
  "SEAT BELTS": "Drošības jostas",
  SEATS: "Sēdekļi",
  WHEELS: "Riteņi",
  TIRES: "Riepas",
  "ELECTRONIC STABILITY CONTROL (ESC)": "Stabilitātes kontrole (ESC)",
  "VEHICLE SPEED CONTROL": "Ātruma kontrole",
  "FORWARD COLLISION AVOIDANCE": "Sadursmju novēršana",
  "LANE DEPARTURE": "Joslas kontrole",
  "BACK OVER PREVENTION": "Atpakaļgaitas kamera / sensori",
  "LATCHES/LOCKS/LINKAGES": "Slēdzenes un aizslēgi",
  "UNKNOWN OR OTHER": "Cits / nezināms",
  EQUIPMENT: "Aprīkojums",
};

export function nhtsaComponentLv(raw: string): string {
  const key = raw.trim().toUpperCase();
  return COMPONENT_LV[key] ?? raw.trim();
}

type ComplaintRow = {
  crash: boolean;
  fire: boolean;
  injuries: number;
  deaths: number;
  components: string[];
  date: string;
};

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function rowFrom(v: unknown): ComplaintRow {
  const o = asRecord(v);
  // Komponentes atdala «,» bez atstarpes («STEERING,POWER TRAIN»); «SERVICE BRAKES, HYDRAULIC» ir viena.
  const comps = typeof o.components === "string" ? o.components.split(/,(?!\s)/).map((c) => c.trim()).filter(Boolean) : [];
  const num = (x: unknown) => (typeof x === "number" && Number.isFinite(x) ? x : 0);
  return {
    crash: o.crash === true,
    fire: o.fire === true,
    injuries: num(o.numberOfInjuries),
    deaths: num(o.numberOfDeaths),
    components: comps,
    date: typeof o.dateComplaintFiled === "string" ? o.dateComplaintFiled : "",
  };
}

/** MM/DD/YYYY -> YYYY, salīdzināšanai. */
function yearOf(date: string): string {
  return /(\d{4})\s*$/.exec(date)?.[1] ?? "";
}

/** Cik sūdzībās minēta katra komponente (viena sūdzība vienu komponenti skaita vienreiz). */
function componentCounts(rows: ComplaintRow[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const seen = new Set<string>();
    for (const c of row.components) {
      const name = nhtsaComponentLv(c);
      if (seen.has(name)) continue;
      seen.add(name);
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
  }
  return counts;
}

export type NhtsaComplaintsVehicle = { make: string; model: string; year: string };

/**
 * found: sūdzības ir (kopskaits, biežākās komponentes, avārijas/ugunsgrēki). none: 0 sūdzību.
 * `usMarket=false`: modeļa nosaukums nāk no ES reģistra; trāpījums ir ASV tirgus modelis un var neattiekties.
 */
export function parseNhtsaComplaints(
  status: number,
  text: string,
  vehicle: NhtsaComplaintsVehicle,
  opts: { usMarket: boolean } = { usMarket: true },
): VinScanParse {
  const label = [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ").trim();
  const openUrl = nhtsaVehiclePageUrl(vehicle.make, vehicle.model, vehicle.year);
  if (status !== 200 && status !== 400) {
    return { status: "unknown", summary: `NHTSA sūdzības: HTTP ${status}`, openUrl };
  }
  let data: unknown;
  try {
    data = JSON.parse(text) as unknown;
  } catch {
    return { status: "unknown", summary: "NHTSA sūdzību atbilde nav JSON", openUrl };
  }
  const rec = asRecord(data);
  const results = Array.isArray(rec.results) ? rec.results : Array.isArray(rec.Results) ? rec.Results : [];
  const rows = results.map(rowFrom);
  const vehicleOut = { make: vehicle.make, model: vehicle.model, year: vehicle.year };
  if (rows.length === 0) {
    if (!opts.usMarket) {
      return {
        status: "skipped",
        summary: `NHTSA: ${label || "šis modelis"} ASV sūdzību datubāzē nav (nav ASV tirgus modelis)`,
        openUrl,
      };
    }
    return { status: "none", summary: `NHTSA sūdzību nav (${label})`, openUrl, vehicle: vehicleOut };
  }
  const counts = [...componentCounts(rows).entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "lv"));
  const top = counts.slice(0, 4).map(([name, n]) => `${name} ${n}`);
  const crashes = rows.filter((r) => r.crash).length;
  const fires = rows.filter((r) => r.fire).length;
  const injuries = rows.reduce((s, r) => s + r.injuries, 0);
  const deaths = rows.reduce((s, r) => s + r.deaths, 0);
  const severe = [
    crashes ? `avārijas ${crashes}` : "",
    fires ? `ugunsgrēki ${fires}` : "",
    injuries ? `cietušie ${injuries}` : "",
    deaths ? `bojāgājušie ${deaths}` : "",
  ].filter(Boolean);
  const years = rows.map((r) => yearOf(r.date)).filter(Boolean).sort();
  const span = years.length ? (years[0] === years[years.length - 1] ? years[0] : `${years[0]}-${years[years.length - 1]}`) : "";
  const prefix = opts.usMarket ? "Tipiskās kaites / sūdzības" : "Tipiskās kaites / sūdzības (ASV tirgus modelis, var neattiekties)";
  const summary = [`${prefix}: ${rows.length}`, top.join(", "), severe.join(", ")].filter(Boolean).join(" · ");
  const detail = [
    label ? `Modelis: ${label} (NHTSA, ASV)` : "",
    span ? `Sūdzības iesniegtas: ${span}` : "",
    counts.length ? `Pa mezgliem: ${counts.map(([name, n]) => `${name} ${n}`).join("; ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  return { status: "found", summary, detail, openUrl, vehicle: vehicleOut };
}
