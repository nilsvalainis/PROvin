/**
 * Autoparks v2 dati: atsevišķs fails `autoparks-v2.json` (nevis `autoparks.json`), lai v1 normalizators
 * nekad neizmestu v2 laukus un atgriešanās uz v1 būtu droša. v1 laukus v2 tikai lasa.
 * Saite ar v1: `cars[carId]` = v1 `AutoparksCar.id`. Faili paliek v1 `files` sarakstā, v2 glabā tikai `fileId`.
 */

import {
  AUTOPARKS_OWNER_LV,
  AUTOPARKS_STATUS_LV,
  autoparksOwner,
  type AutoparksCar,
  type AutoparksStatus,
} from "@/lib/iriss-autoparks";
import { registryStatusInTrade } from "@/lib/iriss-autoparks-registry";

export const AUTOPARKS_V2_FILE = "autoparks-v2.json";

/** Statusu secība v2 (saraksta sadaļas un statusa lapa, T6). */
export const AUTOPARKS_V2_STATUS_ORDER: readonly AutoparksStatus[] = [
  "ordered",
  "in_transit",
  "prep_waiting",
  "in_service",
  "for_sale",
  "reserved",
  "sold",
];

export const AUTOPARKS_V2_STATUS_COLOR: Record<AutoparksStatus, string> = {
  ordered: "#0891b2",
  in_transit: "#0d9488",
  prep_waiting: "#d97706",
  in_service: "#6366f1",
  for_sale: "#2563eb",
  reserved: "#16a34a",
  sold: "#8e8e93",
};

export const V2_SOURCES = ["csdd", "csdd_reg", "vin", "invoice", "listing", "manual", "ai"] as const;
export type V2Source = (typeof V2_SOURCES)[number];

export const V2_VAT_MODES = ["margin", "net", "gross", ""] as const;
export type V2VatMode = (typeof V2_VAT_MODES)[number];

/** 19:31-14: PVN / margin / neto. */
export const V2_VAT_MODE_LV: Record<V2VatMode, string> = {
  margin: "Margin",
  net: "Neto",
  gross: "PVN",
  "": "",
};

export type V2Tech = {
  firstRegDate: string;
  displacementCm3: number | null;
  powerKw: number | null;
  tyreSize: string;
  /** Kad pēdējo reizi jautāts CSDD tehniskajiem datiem (lai nejautātu katrā atvēršanā). */
  csddCheckedAt: string;
};

export type V2Purchase = {
  auction: string;
  auctionNo: string;
  purchaseDate: string;
  /** null = ņem v1 `purchasePriceEur`. */
  purchasePriceEur: number | null;
  transportEur: number | null;
  vat: { mode: V2VatMode; source: string; at: string };
};

export type V2Problem = {
  id: string;
  text: string;
  fixedByService: boolean;
  confirmedByUs: boolean;
  confirmedBy: string;
  at: string;
};

/** AI ieteikums no rēķina PDF (F10). Pašizmaksā nonāk tikai pēc apstiprināšanas (`amountEur`). */
export type V2InvoiceAi = {
  amountEur: number | null;
  currency: string;
  withVat: boolean | null;
  date: string;
  confidence: number | null;
  at: string;
  model: string;
  error: string;
};

export type V2Invoice = {
  id: string;
  fileId: string;
  /** "+ Lapa": papildu skenējumi tam pašam rēķinam (atsevišķi PDF, vecais fails netiek pārrakstīts). */
  extraFileIds: string[];
  pages: number;
  /** Skenēšanas diena (YYYY-MM-DD). */
  date: string;
  /** Apstiprinātā summa (ar PVN, 20:17). null = vēl nav. */
  amountEur: number | null;
  amountBy: string;
  amountAt: string;
  ai: V2InvoiceAi | null;
};

export type V2Expense = { id: string; text: string; amountEur: number | null; date: string; fileIds: string[] };

export type V2Service = {
  diagFileIds: string[];
  problems: V2Problem[];
  notes: string;
  invoices: V2Invoice[];
};

/** v2 labotie v1 lauki: v1 vērtība netiek pārrakstīta, v2 rāda šo, ja aizpildīts. */
export const V2_FIELD_KEYS = ["plate", "location", "arrivedAt"] as const;
export type V2FieldKey = (typeof V2_FIELD_KEYS)[number];

export type AutoparksCarV2 = {
  fields: Record<V2FieldKey, string>;
  tech: V2Tech;
  sources: Record<string, V2Source>;
  purchase: V2Purchase;
  numberCheck: { fileId: string; scannedAt: string; extraFileIds: string[] };
  mainPhoto: { dropboxId: string; thumbBlobPath: string } | null;
  /** Kad pēdējo reizi skatīta STOCK mape galvenajai bildei. */
  photoCheckedAt: string;
  service: V2Service;
  expenses: V2Expense[];
};

export type V2HistoryRow = {
  id: string;
  carId: string;
  at: string;
  actorId: string;
  actorName: string;
  field: string;
  from: string;
  to: string;
  undoOf?: string;
};

export type AutoparksV2State = {
  version: 1;
  cars: Record<string, AutoparksCarV2>;
  history: V2HistoryRow[];
};

export const V2_HISTORY_PER_CAR = 500;
/** Klientam 5 s; serverim + 2 s tīkla rezerve. */
export const V2_STATUS_UNDO_CLIENT_MS = 5_000;
export const V2_STATUS_UNDO_SERVER_MS = 7_000;

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function str(v: unknown, max = 400): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

/** Teksts ar rindām (problēmas, piezīmes): saglabā jaunas rindas. */
function multiline(v: unknown, max: number): string {
  return typeof v === "string" ? v.replace(/\r\n/g, "\n").slice(0, max).trim() : "";
}

export function v2Num(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v.replace(/[\s €]/g, "").replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function strList(v: unknown, max = 200): string[] {
  return Array.isArray(v) ? [...new Set(v.map((x) => str(x, 80)).filter(Boolean))].slice(0, max) : [];
}

function list<T>(raw: unknown, parse: (row: unknown) => T | null, max = 500): T[] {
  return Array.isArray(raw) ? raw.map(parse).filter((x): x is T => x !== null).slice(0, max) : [];
}

export function emptyCarV2(): AutoparksCarV2 {
  return {
    fields: { plate: "", location: "", arrivedAt: "" },
    tech: { firstRegDate: "", displacementCm3: null, powerKw: null, tyreSize: "", csddCheckedAt: "" },
    sources: {},
    purchase: { auction: "", auctionNo: "", purchaseDate: "", purchasePriceEur: null, transportEur: null, vat: { mode: "", source: "", at: "" } },
    numberCheck: { fileId: "", scannedAt: "", extraFileIds: [] },
    mainPhoto: null,
    photoCheckedAt: "",
    service: { diagFileIds: [], problems: [], notes: "", invoices: [] },
    expenses: [],
  };
}

export function emptyAutoparksV2State(): AutoparksV2State {
  return { version: 1, cars: {}, history: [] };
}

function normalizeProblem(raw: unknown): V2Problem | null {
  if (!isObj(raw)) return null;
  const id = str(raw.id, 80);
  if (!id) return null;
  return {
    id,
    text: multiline(raw.text, 4000),
    fixedByService: raw.fixedByService === true,
    confirmedByUs: raw.confirmedByUs === true,
    confirmedBy: str(raw.confirmedBy, 80),
    at: str(raw.at, 40),
  };
}

function normalizeAi(raw: unknown): V2InvoiceAi | null {
  if (!isObj(raw)) return null;
  return {
    amountEur: v2Num(raw.amountEur),
    currency: str(raw.currency, 8),
    withVat: typeof raw.withVat === "boolean" ? raw.withVat : null,
    date: str(raw.date, 10),
    confidence: v2Num(raw.confidence),
    at: str(raw.at, 40),
    model: str(raw.model, 60),
    error: str(raw.error, 120),
  };
}

function normalizeInvoice(raw: unknown): V2Invoice | null {
  if (!isObj(raw)) return null;
  const id = str(raw.id, 80);
  const fileId = str(raw.fileId, 80);
  if (!id || !fileId) return null;
  const pages = v2Num(raw.pages);
  return {
    id,
    fileId,
    extraFileIds: strList(raw.extraFileIds, 20),
    pages: pages != null && pages > 0 ? Math.round(pages) : 1,
    date: str(raw.date, 10),
    amountEur: v2Num(raw.amountEur),
    amountBy: str(raw.amountBy, 80),
    amountAt: str(raw.amountAt, 40),
    ai: normalizeAi(raw.ai),
  };
}

function normalizeExpense(raw: unknown): V2Expense | null {
  if (!isObj(raw)) return null;
  const id = str(raw.id, 80);
  if (!id) return null;
  return { id, text: str(raw.text, 300), amountEur: v2Num(raw.amountEur), date: str(raw.date, 10), fileIds: strList(raw.fileIds, 20) };
}

function normalizeSources(raw: unknown): Record<string, V2Source> {
  const out: Record<string, V2Source> = {};
  if (!isObj(raw)) return out;
  for (const [k, v] of Object.entries(raw)) {
    if (/^[a-zA-Z0-9_.]{1,40}$/.test(k) && typeof v === "string" && (V2_SOURCES as readonly string[]).includes(v)) out[k] = v as V2Source;
  }
  return out;
}

export function normalizeCarV2(raw: unknown): AutoparksCarV2 {
  const base = emptyCarV2();
  if (!isObj(raw)) return base;
  const tech = isObj(raw.tech) ? raw.tech : {};
  const purchase = isObj(raw.purchase) ? raw.purchase : {};
  const vat = isObj(purchase.vat) ? purchase.vat : {};
  const service = isObj(raw.service) ? raw.service : {};
  const nc = isObj(raw.numberCheck) ? raw.numberCheck : {};
  const photo = isObj(raw.mainPhoto) ? raw.mainPhoto : null;
  const fields = isObj(raw.fields) ? raw.fields : {};
  const mode = typeof vat.mode === "string" && (V2_VAT_MODES as readonly string[]).includes(vat.mode) ? (vat.mode as V2VatMode) : "";
  return {
    fields: { plate: str(fields.plate, 16).toUpperCase(), location: str(fields.location, 120), arrivedAt: str(fields.arrivedAt, 10) },
    tech: {
      firstRegDate: str(tech.firstRegDate, 10),
      displacementCm3: v2Num(tech.displacementCm3),
      powerKw: v2Num(tech.powerKw),
      tyreSize: str(tech.tyreSize, 40),
      csddCheckedAt: str(tech.csddCheckedAt, 40),
    },
    sources: normalizeSources(raw.sources),
    purchase: {
      auction: str(purchase.auction, 80),
      auctionNo: str(purchase.auctionNo, 60),
      purchaseDate: str(purchase.purchaseDate, 10),
      purchasePriceEur: v2Num(purchase.purchasePriceEur),
      transportEur: v2Num(purchase.transportEur),
      vat: { mode, source: str(vat.source, 40), at: str(vat.at, 40) },
    },
    numberCheck: { fileId: str(nc.fileId, 80), scannedAt: str(nc.scannedAt, 40), extraFileIds: strList(nc.extraFileIds, 20) },
    mainPhoto: photo && str(photo.dropboxId, 120) ? { dropboxId: str(photo.dropboxId, 120), thumbBlobPath: str(photo.thumbBlobPath, 400) } : null,
    photoCheckedAt: str(raw.photoCheckedAt, 40),
    service: {
      diagFileIds: strList(service.diagFileIds, 50),
      problems: list(service.problems, normalizeProblem, 100),
      notes: multiline(service.notes, 8000),
      invoices: list(service.invoices, normalizeInvoice, 100),
    },
    expenses: list(raw.expenses, normalizeExpense, 200),
  };
}

function normalizeHistoryRow(raw: unknown): V2HistoryRow | null {
  if (!isObj(raw)) return null;
  const id = str(raw.id, 80);
  const carId = str(raw.carId, 80);
  if (!id || !carId) return null;
  const undoOf = str(raw.undoOf, 80);
  return {
    id,
    carId,
    at: str(raw.at, 40),
    actorId: str(raw.actorId, 80),
    actorName: str(raw.actorName, 80),
    field: str(raw.field, 60),
    from: str(raw.from, 300),
    to: str(raw.to, 300),
    ...(undoOf ? { undoOf } : {}),
  };
}

export function normalizeAutoparksV2State(raw: unknown): AutoparksV2State {
  if (!isObj(raw)) return emptyAutoparksV2State();
  const cars: Record<string, AutoparksCarV2> = {};
  if (isObj(raw.cars)) {
    for (const [id, car] of Object.entries(raw.cars)) {
      if (/^[a-zA-Z0-9_-]{1,80}$/.test(id)) cars[id] = normalizeCarV2(car);
    }
  }
  return { version: 1, cars, history: capHistory(list(raw.history, normalizeHistoryRow, 200_000)) };
}

/** Vēsture: ne vairāk kā 500 rindas uz auto (vecākās izkrīt), kopējā secība saglabājas. */
export function capHistory(rows: readonly V2HistoryRow[]): V2HistoryRow[] {
  const keep = new Map<string, number>();
  const out: V2HistoryRow[] = [];
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    const r = rows[i]!;
    const n = keep.get(r.carId) ?? 0;
    if (n >= V2_HISTORY_PER_CAR) continue;
    keep.set(r.carId, n + 1);
    out.push(r);
  }
  return out.reverse();
}

export function carV2Of(state: AutoparksV2State, carId: string): AutoparksCarV2 {
  return state.cars[carId] ?? emptyCarV2();
}

/** CSDD reģistra statuss kabinetā (T8). */
export type V2RegistryStatus = "none" | "accepted" | "removed";

export const V2_REGISTRY_STATUS_LV: Record<V2RegistryStatus, string> = {
  none: "Nav pieņemts",
  accepted: "Pieņemts",
  removed: "Noņemts",
};

export function v2RegistryStatus(car: Pick<AutoparksCar, "registry">): V2RegistryStatus {
  const reg = car.registry;
  if (!reg) return "none";
  if (reg.removedAt || (reg.status && !registryStatusInTrade(reg.status))) return reg.tradeActNo || reg.removedAt ? "removed" : "none";
  return reg.tradeActNo ? "accepted" : "none";
}

/** Rinda ar avota punktu: `csdd` = zaļš punkts (19:53-7). */
export type V2Value<T> = { value: T; csdd: boolean };

export type AutoparksV2Basics = {
  id: string;
  title: string;
  year: string;
  color: string;
  vin: string;
  plate: string;
  status: AutoparksStatus;
  statusLabel: string;
  owner: "IRISS" | "DZA";
  ownerLabel: string;
  location: string;
  arrivedAt: string;
  archived: boolean;
  /** 19:31-13: CSDD reģistra odometrs galvenais; v1 `mileageKm` netiek mainīts. */
  mileageKm: V2Value<number | null>;
  firstRegDate: V2Value<string>;
  displacementCm3: V2Value<number | null>;
  powerKw: V2Value<number | null>;
  tyreSize: V2Value<string>;
  registry: { status: V2RegistryStatus; actNo: string; actDate: string; known: boolean };
  hasPhoto: boolean;
};

export function autoparksV2Title(car: Pick<AutoparksCar, "make" | "model" | "registry">): string {
  const own = `${car.make} ${car.model}`.replace(/\s+/g, " ").trim();
  return own || (car.registry?.makeModel ?? "").trim() || "Auto";
}

export function autoparksV2Basics(car: AutoparksCar, v2: AutoparksCarV2): AutoparksV2Basics {
  const reg = car.registry;
  const regOdo = reg?.odometerKm ?? null;
  const regFirst = reg?.firstRegDate ?? "";
  const owner = autoparksOwner(car);
  const csdd = (key: string) => v2.sources[key] === "csdd" || v2.sources[key] === "csdd_reg" || v2.sources[key] === "vin";
  return {
    id: car.id,
    title: autoparksV2Title(car),
    year: car.year,
    color: car.color,
    vin: car.vin,
    plate: v2.fields.plate || car.plate,
    status: car.status,
    statusLabel: AUTOPARKS_STATUS_LV[car.status],
    owner,
    ownerLabel: AUTOPARKS_OWNER_LV[owner],
    location: v2.fields.location || car.location,
    arrivedAt: v2.fields.arrivedAt || car.arrivedAt,
    archived: Boolean(car.archivedAt),
    mileageKm: regOdo != null ? { value: regOdo, csdd: true } : { value: car.mileageKm, csdd: false },
    firstRegDate: v2.tech.firstRegDate
      ? { value: v2.tech.firstRegDate, csdd: csdd("tech.firstRegDate") }
      : { value: regFirst, csdd: Boolean(regFirst) },
    displacementCm3: { value: v2.tech.displacementCm3, csdd: v2.tech.displacementCm3 != null && csdd("tech.displacementCm3") },
    powerKw: { value: v2.tech.powerKw, csdd: v2.tech.powerKw != null && csdd("tech.powerKw") },
    tyreSize: { value: v2.tech.tyreSize, csdd: false },
    registry: {
      status: v2RegistryStatus(car),
      actNo: reg?.tradeActNo ?? "",
      actDate: reg?.tradeActDate ?? "",
      known: Boolean(reg?.importedAt || reg?.tradeActNo || reg?.removedAt),
    },
    hasPhoto: Boolean(v2.mainPhoto),
  };
}

/**
 * Statusa atsaukšana (T10): tikai tā pati persona, tikai pēdējā statusa maiņa, tikai loga laikā un tikai,
 * ja statuss joprojām ir tas, uz ko mainīja (citādi kāds cits jau mainīja - nekas netiek pārrakstīts).
 */
export function decideStatusUndo(input: {
  history: readonly V2HistoryRow[];
  rowId: string;
  actorId: string;
  currentStatus: AutoparksStatus;
  nowMs: number;
}): { ok: true; row: V2HistoryRow; revertTo: AutoparksStatus } | { ok: false; reason: "not_found" | "expired" | "changed" | "not_owner" } {
  const row = input.history.find((r) => r.id === input.rowId);
  if (!row || row.field !== "status" || row.undoOf) return { ok: false, reason: "not_found" };
  if (row.actorId !== input.actorId) return { ok: false, reason: "not_owner" };
  const at = Date.parse(row.at);
  if (!Number.isFinite(at) || input.nowMs - at > V2_STATUS_UNDO_SERVER_MS || input.nowMs < at - 60_000) return { ok: false, reason: "expired" };
  const later = input.history.some((r) => r.carId === row.carId && r.field === "status" && r.at > row.at);
  if (later || input.currentStatus !== row.to) return { ok: false, reason: "changed" };
  return { ok: true, row, revertTo: row.from as AutoparksStatus };
}
