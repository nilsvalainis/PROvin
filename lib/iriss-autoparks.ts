/** IRISS Autoparks: mūsu auto pēc atvešanas. Pozīcija = auto istaba ar posmiem, failiem, piezīmēm un tāmi. */

export const AUTOPARKS_STATUSES = ["prep_waiting", "in_service", "for_sale", "reserved", "sold"] as const;
export type AutoparksStatus = (typeof AUTOPARKS_STATUSES)[number];

export const AUTOPARKS_STATUS_LV: Record<AutoparksStatus, string> = {
  prep_waiting: "Gaida sagatavošanu",
  in_service: "Servisā",
  for_sale: "Pārdošanā",
  reserved: "Rezervēts",
  sold: "Pārdots",
};

/** Īsie nosaukumi segmentiem un čipiem telefonā. */
export const AUTOPARKS_STATUS_SHORT_LV: Record<AutoparksStatus, string> = {
  prep_waiting: "Gaida",
  in_service: "Servisā",
  for_sale: "Pārdošanā",
  reserved: "Rezervēts",
  sold: "Pārdots",
};

/** Istabas posmi (sadaļas) secībā, kā auto iet cauri uzņēmumam. */
export const AUTOPARKS_STAGES = ["purchase", "transport", "service", "sale"] as const;
export type AutoparksStage = (typeof AUTOPARKS_STAGES)[number];

export const AUTOPARKS_STAGE_LV: Record<AutoparksStage, string> = {
  purchase: "Iegāde",
  transport: "Transports",
  service: "Serviss",
  sale: "Pārdošana",
};

export const AUTOPARKS_STAGE_HINT_LV: Record<AutoparksStage, string> = {
  purchase: "Pirkuma rēķini, izsoles dokumenti",
  transport: "CMR, pārvadājuma rēķini",
  service: "Servisa rēķini, tāmes, darbi",
  sale: "Līgumi, rezervācijas, pārdošana",
};

export const AUTOPARKS_FILE_KINDS = ["invoice", "estimate", "contract", "photo", "other"] as const;
export type AutoparksFileKind = (typeof AUTOPARKS_FILE_KINDS)[number];

export const AUTOPARKS_FILE_KIND_LV: Record<AutoparksFileKind, string> = {
  invoice: "Rēķins",
  estimate: "Tāme",
  contract: "Līgums",
  photo: "Foto",
  other: "Dokuments",
};

export type AutoparksCar = {
  id: string;
  orderId: string;
  vin: string;
  make: string;
  model: string;
  year: string;
  plate: string;
  color: string;
  mileageKm: number | null;
  status: AutoparksStatus;
  statusChangedAt: string;
  location: string;
  purchasePriceEur: number | null;
  salePriceEur: number | null;
  arrivedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type AutoparksFile = {
  id: string;
  carId: string;
  stage: AutoparksStage;
  kind: AutoparksFileKind;
  title: string;
  fileName: string;
  contentType: string;
  size: number;
  blobPath: string;
  sha256: string;
  /** Telefonā nobildēts un pārvērsts PDF. */
  scanned: boolean;
  uploadedBy: string;
  uploadedByName: string;
  createdAt: string;
  deletedAt: string;
};

export type AutoparksNote = {
  id: string;
  carId: string;
  stage: AutoparksStage;
  text: string;
  authorId: string;
  authorName: string;
  createdAt: string;
};

export type AutoparksWorkItem = {
  id: string;
  carId: string;
  title: string;
  qty: number;
  priceEur: number | null;
  done: boolean;
  createdAt: string;
};

export type AutoparksEvent = {
  id: string;
  carId: string;
  at: string;
  actorName: string;
  text: string;
};

export type AutoparksState = {
  version: 1;
  cars: AutoparksCar[];
  files: AutoparksFile[];
  notes: AutoparksNote[];
  work: AutoparksWorkItem[];
  events: AutoparksEvent[];
};

export type AutoparksRoom = {
  car: AutoparksCar;
  files: AutoparksFile[];
  notes: AutoparksNote[];
  work: AutoparksWorkItem[];
  events: AutoparksEvent[];
};

/** Saraksta rinda: auto + skaiti, lai sarakstā nav jālādē visa istaba. */
export type AutoparksListRow = AutoparksCar & {
  fileCount: number;
  stageFileCounts: Record<AutoparksStage, number>;
  noteCount: number;
  workOpen: number;
};

export function isAutoparksStatus(v: unknown): v is AutoparksStatus {
  return typeof v === "string" && (AUTOPARKS_STATUSES as readonly string[]).includes(v);
}

export function isAutoparksStage(v: unknown): v is AutoparksStage {
  return typeof v === "string" && (AUTOPARKS_STAGES as readonly string[]).includes(v);
}

export function isAutoparksFileKind(v: unknown): v is AutoparksFileKind {
  return typeof v === "string" && (AUTOPARKS_FILE_KINDS as readonly string[]).includes(v);
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function str(v: unknown, max = 400): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

function numOrNull(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v.replace(/\s/g, "").replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function emptyAutoparksState(): AutoparksState {
  return { version: 1, cars: [], files: [], notes: [], work: [], events: [] };
}

export function normalizeAutoparksCar(raw: unknown): AutoparksCar | null {
  if (!isObj(raw)) return null;
  const id = str(raw.id, 80);
  if (!id) return null;
  return {
    id,
    orderId: str(raw.orderId, 80),
    vin: str(raw.vin, 32).toUpperCase(),
    make: str(raw.make, 60),
    model: str(raw.model, 80),
    year: str(raw.year, 8),
    plate: str(raw.plate, 16).toUpperCase(),
    color: str(raw.color, 40),
    mileageKm: numOrNull(raw.mileageKm),
    status: isAutoparksStatus(raw.status) ? raw.status : "prep_waiting",
    statusChangedAt: str(raw.statusChangedAt, 40),
    location: str(raw.location, 120),
    purchasePriceEur: numOrNull(raw.purchasePriceEur),
    salePriceEur: numOrNull(raw.salePriceEur),
    arrivedAt: str(raw.arrivedAt, 40),
    createdAt: str(raw.createdAt, 40),
    updatedAt: str(raw.updatedAt, 40),
  };
}

export function normalizeAutoparksFile(raw: unknown): AutoparksFile | null {
  if (!isObj(raw)) return null;
  const id = str(raw.id, 80);
  const carId = str(raw.carId, 80);
  if (!id || !carId) return null;
  const size = numOrNull(raw.size);
  return {
    id,
    carId,
    stage: isAutoparksStage(raw.stage) ? raw.stage : "purchase",
    kind: isAutoparksFileKind(raw.kind) ? raw.kind : "other",
    title: str(raw.title, 160),
    fileName: str(raw.fileName, 200),
    contentType: str(raw.contentType, 100),
    size: size != null && size >= 0 ? Math.round(size) : 0,
    blobPath: str(raw.blobPath, 400),
    sha256: str(raw.sha256, 80),
    scanned: raw.scanned === true,
    uploadedBy: str(raw.uploadedBy, 80),
    uploadedByName: str(raw.uploadedByName, 80),
    createdAt: str(raw.createdAt, 40),
    deletedAt: str(raw.deletedAt, 40),
  };
}

export function normalizeAutoparksNote(raw: unknown): AutoparksNote | null {
  if (!isObj(raw)) return null;
  const id = str(raw.id, 80);
  const carId = str(raw.carId, 80);
  const text = str(raw.text, 4000);
  if (!id || !carId || !text) return null;
  return {
    id,
    carId,
    stage: isAutoparksStage(raw.stage) ? raw.stage : "service",
    text,
    authorId: str(raw.authorId, 80),
    authorName: str(raw.authorName, 80),
    createdAt: str(raw.createdAt, 40),
  };
}

export function normalizeAutoparksWorkItem(raw: unknown): AutoparksWorkItem | null {
  if (!isObj(raw)) return null;
  const id = str(raw.id, 80);
  const carId = str(raw.carId, 80);
  const title = str(raw.title, 200);
  if (!id || !carId || !title) return null;
  const qty = numOrNull(raw.qty);
  return {
    id,
    carId,
    title,
    qty: qty != null && qty > 0 ? qty : 1,
    priceEur: numOrNull(raw.priceEur),
    done: raw.done === true,
    createdAt: str(raw.createdAt, 40),
  };
}

export function normalizeAutoparksEvent(raw: unknown): AutoparksEvent | null {
  if (!isObj(raw)) return null;
  const id = str(raw.id, 80);
  const carId = str(raw.carId, 80);
  if (!id || !carId) return null;
  return { id, carId, at: str(raw.at, 40), actorName: str(raw.actorName, 80), text: str(raw.text, 300) };
}

function list<T>(raw: unknown, parse: (row: unknown) => T | null): T[] {
  return Array.isArray(raw) ? raw.map(parse).filter((x): x is T => x !== null) : [];
}

export function normalizeAutoparksState(raw: unknown): AutoparksState {
  if (!isObj(raw)) return emptyAutoparksState();
  return {
    version: 1,
    cars: list(raw.cars, normalizeAutoparksCar),
    files: list(raw.files, normalizeAutoparksFile),
    notes: list(raw.notes, normalizeAutoparksNote),
    work: list(raw.work, normalizeAutoparksWorkItem),
    events: list(raw.events, normalizeAutoparksEvent),
  };
}

export function autoparksCarTitle(car: Pick<AutoparksCar, "make" | "model" | "year">): string {
  const named = `${car.make} ${car.model}`.trim();
  if (!named) return "Auto";
  return car.year ? `${named} (${car.year})` : named;
}

export function liveAutoparksFiles(files: readonly AutoparksFile[]): AutoparksFile[] {
  return files.filter((f) => !f.deletedAt);
}

export function autoparksListRows(state: AutoparksState): AutoparksListRow[] {
  const files = liveAutoparksFiles(state.files);
  return state.cars.map((car) => {
    const own = files.filter((f) => f.carId === car.id);
    const stageFileCounts = { purchase: 0, transport: 0, service: 0, sale: 0 } as Record<AutoparksStage, number>;
    for (const f of own) stageFileCounts[f.stage] += 1;
    return {
      ...car,
      fileCount: own.length,
      stageFileCounts,
      noteCount: state.notes.filter((n) => n.carId === car.id).length,
      workOpen: state.work.filter((w) => w.carId === car.id && !w.done).length,
    };
  });
}

export function autoparksRoom(state: AutoparksState, carId: string): AutoparksRoom | null {
  const car = state.cars.find((c) => c.id === carId);
  if (!car) return null;
  const byNewest = (a: { createdAt: string }, b: { createdAt: string }) => b.createdAt.localeCompare(a.createdAt);
  return {
    car,
    files: liveAutoparksFiles(state.files).filter((f) => f.carId === carId).sort(byNewest),
    notes: state.notes.filter((n) => n.carId === carId).sort(byNewest),
    work: state.work.filter((w) => w.carId === carId).sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    events: state.events.filter((e) => e.carId === carId).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 40),
  };
}

/** Cik dienas auto ir Autoparkā (no atvešanas vai izveides). */
export function autoparksDaysInPark(car: Pick<AutoparksCar, "arrivedAt" | "createdAt">, now = new Date()): number {
  const from = Date.parse(car.arrivedAt || car.createdAt);
  if (!Number.isFinite(from)) return 0;
  return Math.max(0, Math.floor((now.getTime() - from) / 86_400_000));
}

export function autoparksStatusCounts(cars: ReadonlyArray<Pick<AutoparksCar, "status">>): Record<AutoparksStatus, number> {
  const out = { prep_waiting: 0, in_service: 0, for_sale: 0, reserved: 0, sold: 0 } as Record<AutoparksStatus, number>;
  for (const c of cars) out[c.status] += 1;
  return out;
}

export function autoparksWorkTotal(work: ReadonlyArray<Pick<AutoparksWorkItem, "qty" | "priceEur">>): number {
  let sum = 0;
  for (const w of work) if (w.priceEur != null) sum += w.priceEur * w.qty;
  return Math.round(sum * 100) / 100;
}

/** Summa formātā "4,50 €" ar atstarpēm tūkstošos. */
export function formatAutoparksEur(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "";
  const [int, dec] = Math.abs(n).toFixed(2).split(".");
  const grouped = int!.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${n < 0 ? "-" : ""}${grouped},${dec} €`;
}

export function formatAutoparksBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

/** Faila nosaukums lejupielādei: auto + posms + virsraksts, bez dīvainām zīmēm. */
export function autoparksDownloadName(car: Pick<AutoparksCar, "make" | "model" | "vin">, file: Pick<AutoparksFile, "title" | "stage" | "fileName">): string {
  const ext = file.fileName.match(/\.[a-z0-9]{2,5}$/i)?.[0]?.toLowerCase() ?? ".pdf";
  const base = [car.make, car.model, car.vin.slice(-6), AUTOPARKS_STAGE_LV[file.stage], file.title]
    .filter(Boolean)
    .join(" ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w.\- ]+/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 120);
  return `${base || "dokuments"}${ext}`;
}

/** Apvienotā PDF nosaukums: visa istaba vai viens posms. */
export function autoparksBundleName(car: Pick<AutoparksCar, "make" | "model" | "vin">, stage: AutoparksStage | null): string {
  const base = [car.make, car.model, car.vin.slice(-6), stage ? AUTOPARKS_STAGE_LV[stage] : "visi dokumenti"]
    .filter(Boolean)
    .join(" ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w.\- ]+/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 120);
  return `${base || "dokumenti"}.pdf`;
}

/** Ieteicamais posms jaunam failam pēc auto statusa. */
export function autoparksDefaultStage(status: AutoparksStatus): AutoparksStage {
  if (status === "prep_waiting" || status === "in_service") return "service";
  if (status === "for_sale" || status === "reserved" || status === "sold") return "sale";
  return "purchase";
}
