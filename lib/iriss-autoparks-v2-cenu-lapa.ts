/**
 * Cenu lapa (D4): Nosaukums, Aprīkojums, Pārdošanas cena, Cena (cenu lapai) + dati no Pamatdatiem.
 * Nav pašizmaksas un iepirkuma cenas (19:53-3). Labojumi glabājas v2; v1 vērtības tikai lasa.
 */
import type { AutoparksCar } from "@/lib/iriss-autoparks";
import {
  defaultV2PriceSheetSafety,
  type AutoparksCarV2,
  type AutoparksV2Basics,
  type V2PriceSheetSafety,
  type V2SafetyKey,
} from "@/lib/iriss-autoparks-v2";
import { fmtKm, fmtDateLv } from "@/lib/iriss-autoparks-v2-format";

export type V2PriceSheet = {
  displayName: string;
  equipmentLine: string;
  salePriceEur: number | null;
  listPriceEur: number | null;
  year: string;
  firstRegDate: { value: string; csdd: boolean };
  mileage: { value: string; csdd: boolean };
  engine: { value: string; csdd: boolean };
  gearbox: string;
  safety: string;
  owner: "IRISS" | "DZA";
  ownerLabel: string;
  /** L7 (Nils 27.10): aprīkojuma ieraksti (līdz 8) no `equipmentLine`. */
  highlights: string[];
  /** Vienīgā cena lapā (Nils 27.10: pietiek ar vienu). */
  priceEur: number | null;
  /** "cena ar PVN" tikai, ja auto ir PVN režīmā (margin - tukšs). */
  vatNote: string;
  /** Tehniskie dati; tukšās rindas izlaistas (Nils 27.10). */
  rows: Array<{ label: string; value: string }>;
  /** Drošības sistēmas - vienmēr 4 rindas, spilveni pēdējā (Nils 27.10/28.10). */
  safetyRows: Array<{ label: string; present: string; checked: string }>;
  /** Admin forma: ķeksīšu stāvoklis (noklusējums - viss ieķeksēts). */
  safetyState: V2PriceSheetSafety;
  /** Apliecinājums lapā: "tehniski atbilst izmantošanai ceļu satiksmē". */
  roadworthy: boolean;
};

export const PRICE_SHEET_SAFETY_LABELS: ReadonlyArray<{ key: V2SafetyKey; label: string; short: string }> = [
  { key: "esp", label: "Elektroniskā stabilitātes sistēma (ESP)", short: "ESP" },
  { key: "eps", label: "Elektriskais stūres pastiprinātājs (EPS)", short: "EPS" },
  { key: "abs", label: "Bremžu antibloķēšanas sistēma (ABS)", short: "ABS" },
  { key: "airbags", label: "Drošības spilveni", short: "Spilveni" },
];

export const PRICE_SHEET_MAX_HIGHLIGHTS = 8;

/** "A / B · C" -> ["A","B","C"] (līdz 8, bez tukšajiem un dublikātiem). */
export function priceSheetHighlights(line: string): string[] {
  const out: string[] = [];
  for (const part of line.split(/\s*[/·\n]\s*/)) {
    const v = part.trim();
    if (v && !out.includes(v)) out.push(v);
    if (out.length >= PRICE_SHEET_MAX_HIGHLIGHTS) break;
  }
  return out;
}

export function priceSheetHighlightsLine(items: readonly string[]): string {
  return priceSheetHighlights(items.join(" / ")).join(" / ");
}

/**
 * Nosaukuma burta izmērs (px), lai garš nosaukums paliek vienā rindā A4 platumā (Nils 27.10: obligāti).
 * 650 px pieejamais platums, Inter 200 ar 4 px atstarpi ~0,72 em uz zīmi; robežas 26-50 px.
 */
export function priceSheetTitlePx(title: string): number {
  const n = Math.max(1, title.trim().length);
  return Math.max(26, Math.min(50, Math.floor(650 / (n * 0.72))));
}

const group = (n: number) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");

function priceSheetRows(car: AutoparksCar, basics: AutoparksV2Basics): Array<{ label: string; value: string }> {
  const r = car.registry;
  const makeModel = (r?.makeModel || `${basics.make} ${basics.model}`).replace(/\s+/g, " ").trim().toUpperCase();
  const rows: Array<[string, string]> = [
    ["Marka/modelis", makeModel],
    ["Pirmās reģistrācijas datums", fmtDateLv(basics.firstRegDate.value)],
    ["Odometra rādījums", fmtKm(basics.mileageKm.value)],
    ["Transportlīdzekļa veids", r?.vehicleType ?? ""],
    ["Degvielas tips", r?.fuel ?? ""],
    ["Ātrumkārbas tips", basics.gearbox.value],
    ["Sēdvietu skaits", r?.seats ? String(r.seats) : ""],
    ["Pilna masa", r?.grossMassKg ? `${group(r.grossMassKg)} kg` : ""],
    ["Izmešu daudzums (CO2)", r?.co2GKm ? `${group(r.co2GKm)} g/km` : ""],
    ["Identifikācijas numurs", basics.vin],
    ["Akta numurs", r?.tradeActNo ?? ""],
  ];
  return rows.filter(([, v]) => v.trim()).map(([label, value]) => ({ label, value }));
}

/** Drošības tabula (Nils 28.10): pēc noklusējuma viss "Ir" un "Pārbaudīts" kā CSDD paraugā; Nils maina pats. */
export function priceSheetSafetyRows(state: V2PriceSheetSafety): Array<{ label: string; present: string; checked: string }> {
  return PRICE_SHEET_SAFETY_LABELS.map(({ key, label }) => {
    const it = state.items[key];
    return { label, present: it.present ? "Ir" : "Nav", checked: it.present ? (it.checked ? "Pārbaudīts" : "Nav pārbaudīts") : "" };
  });
}

function safetyLabel(car: AutoparksCar): string {
  const r = car.registry;
  if (!r) return "";
  const vals = [r.airbags, r.esp, r.abs];
  if (vals.every((v) => v === "yes" || v === "yes_checked")) return "Ir";
  if (vals.some((v) => v === "no")) return "Daļēji";
  return "";
}

export function engineLabel(cm3: number | null, kw: number | null, fuel = ""): string {
  const parts: string[] = [];
  if (cm3 != null && cm3 > 0) parts.push(`${(Math.round(cm3 / 100) / 10).toFixed(1)}${fuel ? ` ${fuel}` : ""}`);
  if (kw != null && kw > 0) parts.push(`${Math.round(kw)} kW`);
  return parts.join(" · ");
}

export function autoparksV2PriceSheet(car: AutoparksCar, v2: AutoparksCarV2, basics: AutoparksV2Basics): V2PriceSheet {
  const ps = v2.priceSheet;
  const title = `${car.make} ${car.model}`.trim().toUpperCase();
  const equipmentLine = ps.equipmentLine || car.equipmentLine || "";
  const listPriceEur = ps.listPriceEur ?? car.listPriceEur ?? ps.salePriceEur ?? car.salePriceEur ?? null;
  const vatMode = v2.purchase.vat.mode;
  const safetyState = ps.safety ?? defaultV2PriceSheetSafety();
  return {
    displayName: ps.displayName || car.displayName || title,
    equipmentLine,
    highlights: priceSheetHighlights(equipmentLine),
    priceEur: listPriceEur,
    vatNote: vatMode === "gross" || vatMode === "net" ? "cena ar PVN" : "",
    rows: priceSheetRows(car, basics),
    safetyRows: priceSheetSafetyRows(safetyState),
    safetyState,
    roadworthy: safetyState.roadworthy,
    salePriceEur: ps.salePriceEur ?? car.salePriceEur ?? null,
    listPriceEur,
    year: car.year,
    firstRegDate: { value: fmtDateLv(basics.firstRegDate.value), csdd: basics.firstRegDate.csdd },
    mileage: { value: fmtKm(basics.mileageKm.value), csdd: basics.mileageKm.csdd },
    engine: basics.engine.value
      ? { value: basics.engine.value, csdd: false }
      : {
          value: engineLabel(basics.displacementCm3.value, basics.powerKw.value, car.registry?.fuel ?? ""),
          csdd: basics.displacementCm3.csdd || basics.powerKw.csdd,
        },
    gearbox: basics.gearbox.value,
    safety: safetyLabel(car),
    owner: basics.owner,
    ownerLabel: basics.ownerLabel,
  };
}
