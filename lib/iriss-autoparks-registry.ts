/**
 * CSDD Transportlīdzekļu tirdzniecības reģistra dati Autoparka kartītei (cenu lapai).
 * Avots: Aivars (Grok) nolasa reģistru pārlūkā un ieliek JSON Dropbox; serveris to importē pēc VIN.
 * Shēma: docs/csdd-registrs-imports.md. Personas datus (īpašnieks, personas kods, adrese) neglabā -
 * imports paņem tikai zināmos laukus, visu pārējo izmet.
 */

import type { AutoparksCar } from "@/lib/iriss-autoparks";

export const REGISTRY_SCHEMA_ID = "iriss-csdd-tirdzn-registrs/v1";

/** Drošības sistēmas stāvoklis: "" nezināms, "yes" ir, "yes_checked" ir un pārbaudīta, "no" nav. */
export const REGISTRY_SAFETY_STATES = ["", "yes", "yes_checked", "no"] as const;
export type RegistrySafetyState = (typeof REGISTRY_SAFETY_STATES)[number];

export const REGISTRY_SAFETY_LV: Record<RegistrySafetyState, string> = {
  "": "-",
  yes: "Ir",
  yes_checked: "Ir, pārbaudīta",
  no: "Nav",
};

export const REGISTRY_TEXT_KEYS = ["makeModel", "firstRegDate", "vehicleType", "fuel", "gearbox", "tradeActNo", "tradeActDate", "status"] as const;
export const REGISTRY_NUMBER_KEYS = ["odometerKm", "seats", "grossMassKg", "co2GKm"] as const;
export const REGISTRY_SAFETY_KEYS = ["airbags", "esp", "eps", "abs"] as const;
export const REGISTRY_KEYS = [...REGISTRY_TEXT_KEYS, ...REGISTRY_NUMBER_KEYS, ...REGISTRY_SAFETY_KEYS] as const;

export type RegistryTextKey = (typeof REGISTRY_TEXT_KEYS)[number];
export type RegistryNumberKey = (typeof REGISTRY_NUMBER_KEYS)[number];
export type RegistrySafetyKey = (typeof REGISTRY_SAFETY_KEYS)[number];
export type RegistryKey = (typeof REGISTRY_KEYS)[number];

export type RegistryValues = Record<RegistryTextKey, string> & Record<RegistryNumberKey, number | null> & Record<RegistrySafetyKey, RegistrySafetyState>;

export type AutoparksRegistry = RegistryValues & {
  /** Kad pēdējo reizi kāds lauks aizpildīts no reģistra faila (ISO). */
  importedAt: string;
  /** Dropbox faila nosaukums, no kura nāk dati. */
  importFile: string;
  /** Faila `generatedAt` - kad Aivars nolasīja reģistru. */
  registryDate: string;
  /** Lauki, ko Nils labojis ar roku. Imports tos nepārraksta. */
  manual: RegistryKey[];
  /**
   * Kad pilnā reģistra nolasījumā (snapshot) šī VIN vairs nebija vai statuss bija "pārdots/izņemts" (ISO).
   * Tukšs = pēdējā nolasījumā pieņemts tirdzniecībā (vai nav zināms). Tikai reģistra lauks, ar roku nelabo.
   */
  removedAt: string;
};

export const REGISTRY_FIELD_LV: Record<RegistryKey, string> = {
  makeModel: "Marka, modelis",
  firstRegDate: "1. reģistrācija",
  odometerKm: "Odometrs, km",
  vehicleType: "TL veids",
  fuel: "Degviela",
  gearbox: "Ātrumkārba",
  seats: "Sēdvietas",
  grossMassKg: "Pilna masa, kg",
  co2GKm: "CO2, g/km",
  tradeActNo: "Akta nr.",
  tradeActDate: "Akta datums",
  airbags: "Drošības spilveni",
  esp: "ESP",
  eps: "EPS",
  abs: "ABS",
  status: "Statuss reģistrā",
};

const TEXT_MAX: Record<RegistryTextKey, number> = {
  makeModel: 120,
  firstRegDate: 10,
  vehicleType: 80,
  fuel: 40,
  gearbox: 40,
  tradeActNo: 40,
  tradeActDate: 10,
  status: 60,
};

const DATE_KEYS: ReadonlySet<RegistryKey> = new Set(["firstRegDate", "tradeActDate"]);

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function str(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

/** Skaitlis no `123456`, `"123 456"`, `"149,5"`. Negatīvs vai nesaprotams = null. */
export function registryNumber(v: unknown): number | null {
  let n: number | null = null;
  if (typeof v === "number") n = v;
  else if (typeof v === "string" && v.trim()) n = Number(v.replace(/[\s ]/g, "").replace(",", "."));
  return n != null && Number.isFinite(n) && n >= 0 ? n : null;
}

/** Datums `YYYY-MM-DD`; pieņem arī CSDD formātu `DD.MM.YYYY`. Citādi tukšs. */
export function registryDate(v: unknown): string {
  const s = typeof v === "string" ? v.trim() : "";
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const lv = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (lv) return `${lv[3]}-${lv[2]!.padStart(2, "0")}-${lv[1]!.padStart(2, "0")}`;
  return "";
}

function textValue(key: RegistryTextKey, v: unknown): string {
  return DATE_KEYS.has(key) ? registryDate(v) : str(v, TEXT_MAX[key]);
}

export function isRegistrySafetyState(v: unknown): v is RegistrySafetyState {
  return typeof v === "string" && (REGISTRY_SAFETY_STATES as readonly string[]).includes(v);
}

export function isRegistryKey(v: unknown): v is RegistryKey {
  return typeof v === "string" && (REGISTRY_KEYS as readonly string[]).includes(v);
}

/** Faila formāts `{ "present": true, "checked": true }` -> kartītes stāvoklis. */
export function safetyFromFile(v: unknown): RegistrySafetyState {
  if (isRegistrySafetyState(v)) return v;
  if (!isObj(v)) return "";
  if (v.present === false) return "no";
  if (v.present === true) return v.checked === true ? "yes_checked" : "yes";
  return "";
}

export function emptyRegistryValues(): RegistryValues {
  return {
    makeModel: "",
    firstRegDate: "",
    vehicleType: "",
    fuel: "",
    gearbox: "",
    tradeActNo: "",
    tradeActDate: "",
    status: "",
    odometerKm: null,
    seats: null,
    grossMassKg: null,
    co2GKm: null,
    airbags: "",
    esp: "",
    eps: "",
    abs: "",
  };
}

export function emptyAutoparksRegistry(): AutoparksRegistry {
  return { ...emptyRegistryValues(), importedAt: "", importFile: "", registryDate: "", manual: [], removedAt: "" };
}

/** Krātuves ieraksts -> droša forma. Nezināmus laukus izmet. */
export function normalizeAutoparksRegistry(raw: unknown): AutoparksRegistry | undefined {
  if (!isObj(raw)) return undefined;
  const out = emptyAutoparksRegistry();
  for (const k of REGISTRY_TEXT_KEYS) out[k] = textValue(k, raw[k]);
  for (const k of REGISTRY_NUMBER_KEYS) out[k] = registryNumber(raw[k]);
  for (const k of REGISTRY_SAFETY_KEYS) out[k] = isRegistrySafetyState(raw[k]) ? raw[k] : "";
  out.importedAt = str(raw.importedAt, 40);
  out.importFile = str(raw.importFile, 200);
  out.registryDate = str(raw.registryDate, 40);
  out.manual = Array.isArray(raw.manual) ? [...new Set(raw.manual.filter(isRegistryKey))] : [];
  out.removedAt = str(raw.removedAt, 40);
  return out;
}

export function normalizeRegistryVin(v: unknown): string {
  return typeof v === "string" ? v.replace(/[\s-]/g, "").toUpperCase().slice(0, 32) : "";
}

/** Vai reģistra statuss nozīmē, ka auto PAŠLAIK ir pieņemts tirdzniecībā (sk. `TRADE_REMOVED_STATUS`). Tukšs = jā. */
export function registryStatusInTrade(status: string | undefined | null): boolean {
  return !TRADE_REMOVED_STATUS.test(status ?? "");
}

/** Firmas, kuru auto ir reģistrā (tās pašas kā Autoparka `owner`). */
export const REGISTRY_OWNERS = ["IRISS", "DZA"] as const;
export type RegistryOwner = (typeof REGISTRY_OWNERS)[number];

function registryOwner(v: unknown): RegistryOwner | undefined {
  return typeof v === "string" && (REGISTRY_OWNERS as readonly string[]).includes(v.trim().toUpperCase())
    ? (v.trim().toUpperCase() as RegistryOwner)
    : undefined;
}

/** Viens auto no faila: tikai whitelist lauki. `owner` - neobligāts (Hetzner nolasījums to vienmēr ieliek). */
export type RegistryFileVehicle = { vin: string; values: Partial<RegistryValues>; owner?: RegistryOwner };

/**
 * `snapshot` - fails ir PILNS šo firmu pieņemto auto saraksts (automātiskais nolasījums no reģistra).
 * Tikai tad imports drīkst pievienot jaunus auto un atzīmēt trūkstošos kā izņemtus.
 * Aivara rokas failos (bez `snapshot`) imports tikai papildina esošās kartītes, kā līdz šim.
 */
export type RegistrySnapshot = { complete: true; owners: RegistryOwner[] };

export type RegistryFile = { generatedAt: string; vehicles: RegistryFileVehicle[]; snapshot?: RegistrySnapshot };

export type RegistryParseResult = { ok: true; file: RegistryFile; skipped: number } | { ok: false; error: string };

function vehicleFromFile(raw: unknown): RegistryFileVehicle | null {
  if (!isObj(raw)) return null;
  const vin = normalizeRegistryVin(raw.vin);
  if (vin.length < 11) return null;
  const act = isObj(raw.tradeAct) ? raw.tradeAct : {};
  const safety = isObj(raw.safety) ? raw.safety : {};
  const src: Record<RegistryTextKey, unknown> = {
    makeModel: raw.makeModel,
    firstRegDate: raw.firstRegistrationDate,
    vehicleType: raw.vehicleType,
    fuel: raw.fuel,
    gearbox: raw.gearbox,
    tradeActNo: act.number,
    tradeActDate: act.date,
    status: raw.status,
  };
  const values: Partial<RegistryValues> = {};
  for (const k of REGISTRY_TEXT_KEYS) {
    const v = textValue(k, src[k]);
    if (v) values[k] = v;
  }
  const nums: Record<RegistryNumberKey, unknown> = { odometerKm: raw.odometerKm, seats: raw.seats, grossMassKg: raw.grossMassKg, co2GKm: raw.co2GKm };
  for (const k of REGISTRY_NUMBER_KEYS) {
    const v = registryNumber(nums[k]);
    if (v != null) values[k] = v;
  }
  for (const k of REGISTRY_SAFETY_KEYS) {
    const v = safetyFromFile(safety[k]);
    if (v) values[k] = v;
  }
  const owner = registryOwner(raw.owner);
  return owner ? { vin, values, owner } : { vin, values };
}

function snapshotFromFile(raw: unknown): RegistrySnapshot | undefined {
  if (!isObj(raw) || raw.complete !== true || !Array.isArray(raw.owners)) return undefined;
  const owners = [...new Set(raw.owners.map(registryOwner).filter((o): o is RegistryOwner => Boolean(o)))];
  return owners.length ? { complete: true, owners } : undefined;
}

/** Nolasa Aivara JSON failu. Nezināmi lauki (piem. personas dati) tiek ignorēti un nekur neglabājas. */
export function parseRegistryFile(raw: unknown): RegistryParseResult {
  if (!isObj(raw)) return { ok: false, error: "not_object" };
  if (raw.schema !== REGISTRY_SCHEMA_ID) return { ok: false, error: "wrong_schema" };
  if (!Array.isArray(raw.vehicles)) return { ok: false, error: "no_vehicles" };
  const byVin = new Map<string, RegistryFileVehicle>();
  let skipped = 0;
  for (const row of raw.vehicles.slice(0, 2000)) {
    const v = vehicleFromFile(row);
    if (v) byVin.set(v.vin, v);
    else skipped += 1;
  }
  const snapshot = snapshotFromFile(raw.snapshot);
  const file: RegistryFile = { generatedAt: str(raw.generatedAt, 40), vehicles: [...byVin.values()] };
  return { ok: true, file: snapshot ? { ...file, snapshot } : file, skipped };
}

/**
 * Ieliek reģistra vērtības kartītē. Ar roku labotos laukus (`manual`) nepārraksta,
 * un tukša vērtība failā esošo nenodzēš. Atgriež jauno reģistru un mainītos laukus.
 */
export function mergeRegistryValues(
  prev: AutoparksRegistry | undefined,
  incoming: Partial<RegistryValues>,
  meta: { importedAt: string; importFile: string; registryDate: string },
): { registry: AutoparksRegistry; changed: RegistryKey[] } {
  const base = prev ?? emptyAutoparksRegistry();
  const next: AutoparksRegistry = { ...base, manual: [...base.manual] };
  const manual = new Set(base.manual);
  const changed: RegistryKey[] = [];
  for (const k of REGISTRY_KEYS) {
    if (manual.has(k)) continue;
    const v = incoming[k];
    if (v === undefined || v === null || v === "") continue;
    if (base[k] !== v) {
      (next as Record<RegistryKey, unknown>)[k] = v;
      changed.push(k);
    }
  }
  const touched = REGISTRY_KEYS.some((k) => !manual.has(k) && incoming[k] !== undefined && incoming[k] !== null && incoming[k] !== "");
  if (touched) {
    next.importedAt = meta.importedAt;
    next.importFile = meta.importFile;
    next.registryDate = meta.registryDate;
  }
  return { registry: next, changed };
}

/** API ievade ar roku labotiem reģistra laukiem. Nezināmās atslēgas izmet. */
export function parseRegistryPatch(raw: unknown): Partial<RegistryValues> {
  if (!isObj(raw)) return {};
  const out: Partial<RegistryValues> = {};
  for (const k of REGISTRY_TEXT_KEYS) if (typeof raw[k] === "string") out[k] = textValue(k, raw[k]);
  for (const k of REGISTRY_NUMBER_KEYS) {
    if (raw[k] === null || raw[k] === "") out[k] = null;
    else if (raw[k] !== undefined) out[k] = registryNumber(raw[k]);
  }
  for (const k of REGISTRY_SAFETY_KEYS) if (isRegistrySafetyState(raw[k])) out[k] = raw[k];
  return out;
}

/**
 * Nila labojums: vērtība tiek saglabāta un lauks atzīmēts kā "labots" (imports to vairs neaiztiek).
 * Ja lauku iztukšo - atzīmi noņem, un nākamais imports to atkal aizpilda no reģistra.
 */
export function applyManualRegistryPatch(prev: AutoparksRegistry | undefined, patch: Partial<RegistryValues>): AutoparksRegistry {
  const next: AutoparksRegistry = { ...(prev ?? emptyAutoparksRegistry()) };
  const manual = new Set(next.manual);
  for (const k of REGISTRY_KEYS) {
    if (!(k in patch)) continue;
    const v = patch[k];
    const isNum = (REGISTRY_NUMBER_KEYS as readonly string[]).includes(k);
    (next as Record<RegistryKey, unknown>)[k] = v ?? (isNum ? null : "");
    if (v === undefined || v === null || v === "") manual.delete(k);
    else manual.add(k);
  }
  next.manual = REGISTRY_KEYS.filter((k) => manual.has(k));
  return next;
}

/** Lauka avota atzīme kartītē. */
export function registryFieldSource(reg: AutoparksRegistry | undefined, key: RegistryKey): "manual" | "csdd" | "" {
  if (!reg) return "";
  if (reg.manual.includes(key)) return "manual";
  const v = reg[key];
  return reg.importedAt && v !== "" && v !== null ? "csdd" : "";
}

/**
 * Reģistra statuss, kas nozīmē, ka auto vairs nav tirdzniecībā (noņemts, izslēgts, pārdots, anulēts).
 * Tukšs statuss (vecs imports) vai "Tirdzniecībā" = pieņemts.
 */
const TRADE_REMOVED_STATUS = /no[nņ]em|izsl[eē]g|p[aā]rdot|anul|dz[eē]st|iz[nņ]em|atsauk|sold|removed/i;

export type TradeAcceptedCarInput = Pick<AutoparksCar, "status" | "archivedAt" | "registry">;

/**
 * VIENĪGAIS avots: vai auto pašlaik ir CSDD tirdzniecības reģistrā pieņemts tirdzniecībā.
 * Nosacījumi: ir tirdzniecības akta nr., Autoparkā nav "Pārdots", nav arhīvā, reģistra statuss nav noņemts/pārdots,
 * un pēdējā pilnajā reģistra nolasījumā (Hetzner cron) auto nav atzīmēts kā izņemts (`registry.removedAt`).
 * Lieto pavadzīmju auto saraksts un ikdienas reģistra sinhronizācija - citur šo filtru nedublēt.
 */
export function isTradeAcceptedCar(car: TradeAcceptedCarInput): boolean {
  if (car.archivedAt) return false;
  if (car.status === "sold") return false;
  const reg = car.registry;
  if (!reg?.tradeActNo?.trim()) return false;
  if (reg.removedAt) return false;
  return registryStatusInTrade(reg.status);
}

/** Autoparka auto, kas pašlaik pieņemti tirdzniecībā (secība kā krātuvē). Sk. `isTradeAcceptedCar`. */
export function listTradeAcceptedCars<T extends TradeAcceptedCarInput>(cars: ReadonlyArray<T>): T[] {
  return cars.filter(isTradeAcceptedCar);
}
