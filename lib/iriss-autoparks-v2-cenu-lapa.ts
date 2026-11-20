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
  type V2PriceSheetState,
  type V2SafetyKey,
} from "@/lib/iriss-autoparks-v2";
import { fmtKm, fmtDateLv } from "@/lib/iriss-autoparks-v2-format";
import { hasTradeAct } from "@/lib/iriss-autoparks-registry";

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
  /** Tehniskie dati lapā; tukšās un paslēptās rindas izlaistas (Nils 27.10, 20.11). */
  rows: Array<{ label: string; value: string }>;
  /** Redaktoram: visas rindas ar vērtību (arī paslēptās) un to redzamība. */
  allRows: PriceSheetRow[];
  /** Drošības sistēmas - vienmēr 4 rindas, spilveni pēdējā (Nils 27.10/28.10). */
  safetyRows: Array<{ label: string; present: string; checked: string }>;
  /** Admin forma: ķeksīšu stāvoklis (noklusējums - viss ieķeksēts). */
  safetyState: V2PriceSheetSafety;
  /** Apliecinājums lapā: "tehniski atbilst izmantošanai ceļu satiksmē". */
  roadworthy: boolean;
  /** Lapas stāvoklis (Nils 20.11, variants A): parastā / «DRĪZUMĀ» / «REZERVĒTS» cenas vietā. */
  state: V2PriceSheetState;
  /** Manuālā izvēle: null = automātiski. */
  stateMode: V2PriceSheetState | null;
  /** Ko dotu «Automātiski» (redaktoram). */
  stateAuto: V2PriceSheetState;
  /** Drošība «Gaida pārbaudi» + teikums «pārbaude tiks veikta pirms pārdošanas» (ja nav apliecinājuma). */
  pendingCheck: boolean;
  /** Drīzumā/Rezervēts lapā rādīt cenas rindu zem līnijām (false = variants D). */
  showPlannedPrice: boolean;
};

export const PRICE_SHEET_STATE_LV: Record<V2PriceSheetState, string> = {
  normal: "Parastā",
  soon: "Drīzumā",
  reserved: "Rezervēts",
};

/**
 * Automātiskais stāvoklis (Nils 20.11): Autoparka statuss «Rezervēts» -> Rezervēts (prioritāte);
 * citādi, ja auto NAV pieņemts tirdzniecībā (CSDD akts nr. vai datums) -> Drīzumā; citādi parastā lapa.
 */
export function priceSheetStateAuto(car: Pick<AutoparksCar, "registry" | "status">): V2PriceSheetState {
  if (car.status === "reserved") return "reserved";
  return hasTradeAct(car.registry) ? "normal" : "soon";
}

export function priceSheetState(car: Pick<AutoparksCar, "registry" | "status">, v2: Pick<AutoparksCarV2, "priceSheet">): V2PriceSheetState {
  return v2.priceSheet.sheetState ?? priceSheetStateAuto(car);
}

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

export type PriceSheetRow = { key: string; label: string; value: string; shown: boolean; csdd: boolean };

/**
 * «Dati lapai» (Nils 27.10, 20.11): visi cenu lapai jēgpilnie lauki no Pamatdatiem un CSDD reģistra.
 * Tukšās rindas nerāda; katru var paslēpt/parādīt (`priceSheet.rowVisibility`). Rindas, kas lapā nebija līdz 20.11
 * (numurs, dzinējs, krāsa u.c.), pēc noklusējuma paslēptas, lai esošās lapas nemainās; «Tirdzniecībā pieņemts» - redzama.
 */
export function priceSheetAllRows(car: AutoparksCar, basics: AutoparksV2Basics, visibility: Record<string, boolean> = {}): PriceSheetRow[] {
  const r = car.registry;
  const makeModel = (r?.makeModel || `${basics.make} ${basics.model}`).replace(/\s+/g, " ").trim().toUpperCase();
  const reg = basics.registry;
  const ex = basics.extras;
  const engine = basics.engine.value || engineLabel(basics.displacementCm3.value, basics.powerKw.value, r?.fuel ?? "");
  // [atslēga, nosaukums, vērtība, noklusējumā redzama, no CSDD]
  const rows: Array<[string, string, string, boolean, boolean]> = [
    ["makeModel", "Marka/modelis", makeModel, true, Boolean(r?.makeModel)],
    ["firstReg", "Pirmās reģistrācijas datums", fmtDateLv(basics.firstRegDate.value), true, basics.firstRegDate.csdd],
    ["mileage", "Odometra rādījums", fmtKm(basics.mileageKm.value), true, basics.mileageKm.csdd],
    ["vehicleType", "Transportlīdzekļa veids", r?.vehicleType ?? "", true, true],
    ["fuel", "Degvielas tips", r?.fuel ?? "", true, true],
    ["gearbox", "Ātrumkārbas tips", basics.gearbox.value, true, basics.gearbox.csdd],
    ["engine", "Dzinējs", engine, false, basics.displacementCm3.csdd || basics.powerKw.csdd],
    ["seats", "Sēdvietu skaits", r?.seats ? String(r.seats) : "", true, true],
    ["grossMass", "Pilna masa", r?.grossMassKg ? `${group(r.grossMassKg)} kg` : "", true, true],
    ["co2", "Izmešu daudzums (CO2)", r?.co2GKm ? `${group(r.co2GKm)} g/km` : "", true, true],
    ["color", "Krāsa", basics.color, false, false],
    ["tyres", "Riepu izmērs", basics.tyreSize.value, false, false],
    ["owners", "Īpašnieku skaits", ex.ownersCount != null && ex.ownersCount > 0 ? String(ex.ownersCount) : "", false, false],
    ["keys", "Atslēgu skaits", ex.keysCount != null && ex.keysCount > 0 ? String(ex.keysCount) : "", false, false],
    ["inspection", "Tehniskā apskate līdz", fmtDateLv(ex.inspectionUntil) || ex.inspectionUntil, false, false],
    ["plate", "Reģistrācijas numurs", basics.plate, false, false],
    ["vin", "Identifikācijas numurs", basics.vin, true, false],
    // Tirdzniecībā pieņemts (Nils 20.11): CSDD reģistra akta datums (akta nr. reģistra nolasījumā bieži nav).
    ["tradeAccepted", "Tirdzniecībā pieņemts", reg.status === "accepted" ? fmtDateLv(reg.actDate) || reg.actDate : "", true, true],
    ["tradeActNo", "Akta numurs", r?.tradeActNo ?? "", true, true],
  ];
  return rows
    .filter(([, , v]) => v.trim())
    .map(([key, label, value, def, csdd]) => ({ key, label, value, shown: visibility[key] ?? def, csdd }));
}

/** Drošības tabula (Nils 28.10): pēc noklusējuma viss "Ir" un "Pārbaudīts" kā CSDD paraugā; Nils maina pats. */
export function priceSheetSafetyRows(state: V2PriceSheetSafety, soon = false): Array<{ label: string; present: string; checked: string }> {
  // Drīzumā (Nils 20.11): nepārbaudītai sistēmai «Gaida pārbaudi», nevis «Nav pārbaudīts».
  const notChecked = soon ? "Gaida pārbaudi" : "Nav pārbaudīts";
  return PRICE_SHEET_SAFETY_LABELS.map(({ key, label }) => {
    const it = state.items[key];
    return { label, present: it.present ? "Ir" : "Nav", checked: it.present ? (it.checked ? "Pārbaudīts" : notChecked) : "" };
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
  const allRows = priceSheetAllRows(car, basics, ps.rowVisibility ?? {});
  const stateAuto = priceSheetStateAuto(car);
  const state = priceSheetState(car, v2);
  // Drošība kā Drīzumā («Gaida pārbaudi», teikums par pārbaudi): Drīzumā vienmēr; Rezervēts - ja auto vēl nav pieņemts tirdzniecībā.
  const waitSafety = state === "soon" || (state === "reserved" && !hasTradeAct(car.registry));
  return {
    displayName: ps.displayName || car.displayName || title,
    equipmentLine,
    highlights: priceSheetHighlights(equipmentLine),
    priceEur: listPriceEur,
    vatNote: vatMode === "gross" || vatMode === "net" ? "cena ar PVN" : "",
    rows: allRows.filter((r) => r.shown).map(({ label, value }) => ({ label, value })),
    allRows,
    safetyRows: priceSheetSafetyRows(safetyState, waitSafety),
    safetyState,
    roadworthy: safetyState.roadworthy,
    state,
    stateMode: ps.sheetState ?? null,
    stateAuto,
    pendingCheck: waitSafety,
    showPlannedPrice: ps.showPlannedPrice !== false,
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
