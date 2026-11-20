/**
 * Cenu lapa (D4): Nosaukums, Aprīkojums, Pārdošanas cena, Cena (cenu lapai) + dati no Pamatdatiem.
 * Nav pašizmaksas un iepirkuma cenas (19:53-3). Labojumi glabājas v2; v1 vērtības tikai lasa.
 */
import type { AutoparksCar } from "@/lib/iriss-autoparks";
import {
  defaultV2PriceSheetSafety,
  V2_REGISTRY_STATUS_LV,
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
  /** 20.11: auto «Pārdots» un lapas stāvoklis nav izvēlēts ar roku - pārdošanas lapu nedrukā (poga neaktīva, čips «Pārdots»). */
  sold: boolean;
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
 * Cenu lapai auto pieņemts tirdzniecībā: CSDD reģistra akts (nr. vai datums) VAI Pamatdatos ar roku ievadīts
 * akta numurs (Nils 20.11 - konsekventi ar «Trūkst», «Drīzumā» un «tehniski atbilst» noklusējumu).
 */
export function priceSheetAccepted(car: Pick<AutoparksCar, "registry">, v2?: { tech?: { tradeActNo?: string } } | null): boolean {
  return hasTradeAct(car.registry) || Boolean(v2?.tech?.tradeActNo?.trim());
}

/**
 * Automātiskais stāvoklis (Nils 20.11): Autoparka statuss «Rezervēts» -> Rezervēts (prioritāte);
 * citādi, ja auto NAV pieņemts tirdzniecībā (`priceSheetAccepted`) -> Drīzumā; citādi parastā lapa.
 */
export function priceSheetStateAuto(car: Pick<AutoparksCar, "registry" | "status">, v2?: { tech?: { tradeActNo?: string } } | null): V2PriceSheetState {
  if (car.status === "reserved") return "reserved";
  return priceSheetAccepted(car, v2) ? "normal" : "soon";
}

/**
 * Pārdotam auto pārdošanas lapu automātiski nedrukā; manuāla stāvokļa izvēle to atļauj.
 * Pārdots = statuss «Pārdots» vai arhīvs ar iemeslu «sold» (20.11 audits).
 */
export function priceSheetSold(
  car: Pick<AutoparksCar, "status"> & { archivedAt?: string; archiveReason?: string },
  ps: Pick<AutoparksCarV2["priceSheet"], "sheetState">,
): boolean {
  const sold = car.status === "sold" || (Boolean(car.archivedAt) && car.archiveReason === "sold");
  return sold && ps.sheetState == null;
}

export function priceSheetState(
  car: Pick<AutoparksCar, "registry" | "status">,
  v2: Pick<AutoparksCarV2, "priceSheet"> & { tech?: { tradeActNo?: string } },
): V2PriceSheetState {
  return v2.priceSheet.sheetState ?? priceSheetStateAuto(car, v2);
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

export type PriceSheetRow = {
  key: string;
  label: string;
  value: string;
  shown: boolean;
  csdd: boolean;
  /** Obligāts lauks (vecais DZA paraugs, Nils 20.11; tikai, ja ir akta numurs): tukšs redaktorā sarkans «Trūkst», A4 lapā nerāda. */
  required: boolean;
};

/** Obligātie cenu lapas lauki secībā kā vecajā DZA paraugā (Nils 20.11). */
export const PRICE_SHEET_REQUIRED_KEYS = [
  "makeModel",
  "firstReg",
  "mileage",
  "vehicleType",
  "fuel",
  "gearbox",
  "power",
  "seats",
  "grossMass",
  "co2",
  "vin",
  "tradeActNo",
] as const;

/**
 * «Dati lapai» (Nils 27.10, 20.11): visi cenu lapai jēgpilnie lauki no Pamatdatiem, CSDD tehniskajiem datiem un
 * CSDD reģistra. Secība kā vecajā DZA paraugā. Obligātie (`PRICE_SHEET_REQUIRED_KEYS`) pēc noklusējuma redzami;
 * ja ir akta numurs, tie sarakstā ir arī tukši («Trūkst»). Pārējās tukšās rindas sarakstā nerāda. Katru var paslēpt/parādīt
 * (`priceSheet.rowVisibility`) - saglabātā izvēle vienmēr noteicošā.
 */
export function priceSheetAllRows(car: AutoparksCar, basics: AutoparksV2Basics, visibility: Record<string, boolean> = {}): PriceSheetRow[] {
  const r = car.registry;
  const makeModel = (r?.makeModel || `${basics.make} ${basics.model}`).replace(/\s+/g, " ").trim().toUpperCase();
  const reg = basics.registry;
  const ex = basics.extras;
  const sale = basics.sale;
  const manualEngine = basics.engine.value;
  const engine = manualEngine || engineLabel(basics.displacementCm3.value, basics.powerKw.value, sale?.fuel.value ?? r?.fuel ?? "");
  const num = (v: number | null | undefined) => (v == null ? "" : group(v));
  const accepted = reg.status === "accepted";
  const actNo = sale?.tradeActNo ?? { value: reg.actNo, csdd: Boolean(reg.actNo) };
  // [atslēga, nosaukums, vērtība, noklusējumā redzama, no CSDD]
  const rows: Array<[string, string, string, boolean, boolean]> = [
    ["makeModel", "Marka/modelis", makeModel, true, Boolean(r?.makeModel)],
    ["firstReg", "Pirmās reģistrācijas datums", fmtDateLv(basics.firstRegDate.value), true, basics.firstRegDate.csdd],
    ["mileage", "Odometra rādījums", fmtKm(basics.mileageKm.value), true, basics.mileageKm.csdd],
    ["vehicleType", "Transportlīdzekļa veids", sale?.vehicleType.value ?? "", true, sale?.vehicleType.csdd ?? false],
    ["fuel", "Degvielas tips", sale?.fuel.value ?? "", true, sale?.fuel.csdd ?? false],
    ["gearbox", "Ātrumkārbas tips", basics.gearbox.value, true, basics.gearbox.csdd],
    // Tilpums nav obligāts, bet pārdošanai noderīgs - pēc noklusējuma redzams (Nils 20.11).
    ["displacement", "Dzinēja tilpums (cm³)", num(basics.displacementCm3.value), true, basics.displacementCm3.csdd],
    ["power", "Jauda (kW)", num(basics.powerKw.value), true, basics.powerKw.csdd],
    ["seats", "Sēdvietu skaits", num(sale?.seats.value), true, sale?.seats.csdd ?? false],
    ["grossMass", "Pilna masa (kg)", num(sale?.grossMassKg.value), true, sale?.grossMassKg.csdd ?? false],
    ["co2", "Oglekļa dioksīda (CO2) izmešu daudzums (g/km)", num(sale?.co2GKm.value), true, sale?.co2GKm.csdd ?? false],
    ["vin", "Identifikācijas numurs", basics.vin, true, false],
    ["tradeActNo", "Akta par pieņemšanu tirdzniecībā numurs", actNo.value, true, actNo.csdd],
    // Ja akta numura nav, bet ir datums - rāda datumu (Nils 20.11); ar numuru datums pēc noklusējuma paslēpts.
    ["tradeAccepted", "Pieņemts tirdzniecībā", accepted ? fmtDateLv(reg.actDate) || reg.actDate : "", !actNo.value, true],
    // Papildu (pēc noklusējuma paslēpti): no Pamatdatiem / CSDD.
    // Dzinējs: ar roku ievadīts apraksts redzams; aprēķinātais (tilpums + jauda) - paslēpts, jo tās ir atsevišķas rindas.
    ["engine", "Dzinējs", engine, Boolean(manualEngine), basics.displacementCm3.csdd || basics.powerKw.csdd],
    ["color", "Krāsa", basics.color, false, false],
    ["tyres", "Riepu izmērs", basics.tyreSize.value, false, false],
    ["secondWheels", "Otrs disku komplekts", ex.secondWheels, false, false],
    ["owners", "Īpašnieku skaits", ex.ownersCount != null && ex.ownersCount > 0 ? String(ex.ownersCount) : "", false, false],
    ["keys", "Atslēgu skaits", ex.keysCount != null && ex.keysCount > 0 ? String(ex.keysCount) : "", false, false],
    ["inspection", "Tehniskā apskate līdz", fmtDateLv(ex.inspectionUntil) || ex.inspectionUntil, false, false],
    ["plate", "Reģistrācijas numurs", basics.plate, false, false],
    ["owner", "Īpašnieks", basics.ownerLabel, false, false],
    ["tradeStatus", "Tirdzniecības statuss", reg.known ? V2_REGISTRY_STATUS_LV[reg.status] : "", false, true],
  ];
  // Lapa pilnvērtīga tikai ar akta numuru (Nils 20.11): tad visi obligātie lauki jābūt («Trūkst» redaktorā);
  // kamēr numura nav (Drīzumā u.c.), dati drīkst būt nepilnīgi - tukšos vienkārši izlaiž, bez brīdinājuma.
  // Vērtības tikai no avotiem (Pamatdati / CSDD tehniskie dati / CSDD reģistrs) - nekas netiek minēts vai pieņemts.
  const required = new Set<string>(actNo.value.trim() ? PRICE_SHEET_REQUIRED_KEYS : []);
  return rows
    .filter(([key, , v]) => v.trim() || required.has(key))
    .map(([key, label, value, def, csdd]) => ({ key, label, value, shown: visibility[key] ?? def, csdd, required: required.has(key) }));
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
  // Efektīvie Pamatdati (ar roku labotā marka/modelis un gads), nevis v1 lauki.
  const title = `${basics.make} ${basics.model}`.replace(/\s+/g, " ").trim().toUpperCase();
  const equipmentLine = ps.equipmentLine || car.equipmentLine || "";
  const listPriceEur = ps.listPriceEur ?? car.listPriceEur ?? ps.salePriceEur ?? car.salePriceEur ?? null;
  const vatMode = v2.purchase.vat.mode;
  const accepted = priceSheetAccepted(car, v2);
  // Bez saglabātas izvēles: pieņemtam tirdzniecībā «tehniski atbilst» ieslēgts (Nils 20.11); saglabātā izvēle uzvar.
  const safetyState = ps.safety ?? defaultV2PriceSheetSafety(accepted);
  const allRows = priceSheetAllRows(car, basics, ps.rowVisibility ?? {});
  const stateAuto = priceSheetStateAuto(car, v2);
  const state = priceSheetState(car, v2);
  // Drošība kā Drīzumā («Gaida pārbaudi», teikums par pārbaudi): Drīzumā vienmēr; Rezervēts - ja auto vēl nav pieņemts tirdzniecībā.
  const waitSafety = state === "soon" || (state === "reserved" && !accepted);
  return {
    displayName: ps.displayName || car.displayName || title,
    equipmentLine,
    highlights: priceSheetHighlights(equipmentLine),
    priceEur: listPriceEur,
    vatNote: vatMode === "gross" || vatMode === "net" ? "cena ar PVN" : "",
    rows: allRows.filter((r) => r.shown && r.value.trim()).map(({ label, value }) => ({ label, value })),
    allRows,
    safetyRows: priceSheetSafetyRows(safetyState, waitSafety),
    safetyState,
    roadworthy: safetyState.roadworthy,
    state,
    stateMode: ps.sheetState ?? null,
    stateAuto,
    sold: priceSheetSold(car, ps),
    pendingCheck: waitSafety,
    showPlannedPrice: ps.showPlannedPrice !== false,
    salePriceEur: ps.salePriceEur ?? car.salePriceEur ?? null,
    listPriceEur,
    year: basics.year,
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
