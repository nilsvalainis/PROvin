/** Auto kabinets A/B/C: dokumenti, pickup posms, sadaļu atvēršana. */

export const CABINET_SECTIONS = ["A", "B", "C"] as const;
export type CabinetSectionId = (typeof CABINET_SECTIONS)[number];

export const CABINET_PHASES = ["preAtvests", "postAtvests"] as const;
export type CabinetPhase = (typeof CABINET_PHASES)[number];

export const CABINET_PICKUP_STAGES = ["waiting", "planned", "in_transit", "arrived"] as const;
export type CabinetPickupStage = (typeof CABINET_PICKUP_STAGES)[number];

export const CABINET_DOC_TYPES = [
  "purchase_confirm",
  "car_invoice",
  "auction_invoice",
  "service_invoice",
  "pickup_pdf",
  "cmr",
  "transport_request_confirm",
  "transport_invoice",
  "csdd_status",
  "note",
  "other",
] as const;
export type CabinetDocType = (typeof CABINET_DOC_TYPES)[number];

export const CABINET_DOC_TYPE_LABEL: Record<CabinetDocType, string> = {
  purchase_confirm: "Pirkuma apstiprinājums",
  car_invoice: "Car Invoice",
  auction_invoice: "Auction Invoice",
  service_invoice: "Servisa rēķins",
  pickup_pdf: "Pickup dokuments",
  cmr: "CMR",
  transport_request_confirm: "Auto1 Transport Request Confirmation",
  transport_invoice: "Auto1 Transport Invoice",
  csdd_status: "CSDD pārbaude",
  note: "Piezīmes",
  other: "Dokuments",
};

/** Dokumentu veidi, kam vienotajā "Dokumenti" sadaļā vienmēr ir sava rinda (arī tad, ja vēl nav augšupielādēts). */
export const CABINET_SLOT_DOC_TYPES = [
  "purchase_confirm",
  "car_invoice",
  "pickup_pdf",
  "cmr",
  "transport_request_confirm",
  "transport_invoice",
  "service_invoice",
  "csdd_status",
] as const;

export function cabinetDocumentsSummary(docs: readonly CabinetDocument[]): string {
  const live = liveCabinetDocuments(docs as CabinetDocument[]);
  const present = new Set(live.map((d) => d.type));
  const count = CABINET_SLOT_DOC_TYPES.filter((t) => present.has(t)).length;
  return `${count} no ${CABINET_SLOT_DOC_TYPES.length} augšupielādēti`;
}

/** Servisa rēķinu pirms atvešanas drīkst pievienot brīvi (A), pēc atvešanas - C sadaļā, kur to redz arī loģistika. */
export function serviceInvoiceUploadSection(arrived: boolean): CabinetSectionId {
  return arrived ? "C" : "A";
}

export const CABINET_SECTION_LABEL: Record<CabinetSectionId, string> = {
  A: "Iegādes dokumenti",
  B: "Pick up līdz atvešanai",
  C: "Pēc atvešanas",
};

/** Mazie grupu virsraksti vienotajā "Dokumenti" sadaļā (kompaktais maketis j34). */
export const CABINET_DOC_GROUP_LABEL: Record<CabinetSectionId, string> = {
  A: "Iegāde",
  B: "Pickup / transports",
  C: "Rēķini",
};

export const CABINET_PICKUP_STAGE_LV: Record<CabinetPickupStage, string> = {
  waiting: "Gaida",
  planned: "Ieplānots",
  in_transit: "Ceļā",
  arrived: "Atvests",
};

export const CABINET_SECTION_DEFAULTS: Record<CabinetPhase, Record<CabinetSectionId, boolean>> = {
  preAtvests: { A: true, B: true, C: false },
  postAtvests: { A: false, B: false, C: true },
};

export const CABINET_LOCAL_PREFS_KEY = "iriss.logistics.cabinet.prefs";

export type CabinetDocument = {
  id: string;
  carId: string;
  section: CabinetSectionId;
  type: CabinetDocType;
  typeLabel: string;
  title: string;
  docNumber: string;
  source: string;
  sourceUrl: string;
  blobPath: string;
  /** Dropbox /STOCK `doc/` ceļš, ja dokuments tur sinhronizēts (J30 F1). Tukšs = nav/nebija iespējams. */
  dropboxPath: string;
  sha256: string;
  uploadedBy: string;
  createdAt: string;
  deletedAt: string;
  deletedBy: string;
};

export type CabinetPickup = {
  carId: string;
  stage: CabinetPickupStage;
  pickupCode: string;
  pickupDate: string;
  arrivedAt: string;
  notes: string;
  updatedAt: string;
  updatedBy: string;
};

export type CabinetAccessDocType = CabinetDocType | "invoices";

export type CabinetAccessRule = {
  id: string;
  userId: string;
  role: string;
  carId: string;
  section: CabinetSectionId | "";
  docType: CabinetAccessDocType | "";
  allow: boolean;
  updatedAt: string;
  updatedBy: string;
};

export type CabinetPreferenceValue = "open" | "closed";

export type CabinetUserPreference = {
  userId: string;
  key: string;
  value: CabinetPreferenceValue;
  updatedAt: string;
};

export function isCabinetSectionId(v: unknown): v is CabinetSectionId {
  return v === "A" || v === "B" || v === "C";
}

export function isCabinetPhase(v: unknown): v is CabinetPhase {
  return v === "preAtvests" || v === "postAtvests";
}

export function isCabinetPickupStage(v: unknown): v is CabinetPickupStage {
  return typeof v === "string" && (CABINET_PICKUP_STAGES as readonly string[]).includes(v);
}

export function isCabinetDocType(v: unknown): v is CabinetDocType {
  return typeof v === "string" && (CABINET_DOC_TYPES as readonly string[]).includes(v);
}

export function cabinetPrefKey(section: CabinetSectionId, phase: CabinetPhase): string {
  return `cabinet.section.${section}.${phase}`;
}

export function cabinetPhaseForStage(stage: CabinetPickupStage): CabinetPhase {
  return stage === "arrived" ? "postAtvests" : "preAtvests";
}

export function resolveCabinetSectionOpen(
  prefs: Record<string, string>,
  section: CabinetSectionId,
  stage: CabinetPickupStage,
): boolean {
  const phase = cabinetPhaseForStage(stage);
  const raw = prefs[cabinetPrefKey(section, phase)]?.trim();
  if (raw === "open") return true;
  if (raw === "closed") return false;
  return CABINET_SECTION_DEFAULTS[phase][section];
}

export function defaultPickupStageFromOrderStatus(status: string): CabinetPickupStage {
  if (status === "delivered" || status === "archived") return "arrived";
  if (status === "picked_up" || status === "in_transit_to_warehouse" || status === "waiting_transport") {
    return "in_transit";
  }
  if (status === "scheduled" || status === "pickup_confirmed") return "planned";
  return "waiting";
}

const AUTO1_INVOICE_PATH = /\/finance\/invoice\/download-invoice\/(\d+)/i;

export function auto1InvoiceNumberFromUrl(url: string): string {
  const m = url.trim().match(AUTO1_INVOICE_PATH);
  return m?.[1] ?? "";
}

export function logisticsDocumentTitle(input: {
  type: CabinetDocType;
  typeLabel?: string;
  docNumber?: string;
  sourceUrl?: string;
}): string {
  const label = (input.typeLabel ?? CABINET_DOC_TYPE_LABEL[input.type]).trim() || CABINET_DOC_TYPE_LABEL[input.type];
  const nr = (input.docNumber ?? "").trim() || auto1InvoiceNumberFromUrl(input.sourceUrl ?? "");
  return nr ? `${label}: ${nr}` : label;
}

export function cabinetDocTypeForSection(section: CabinetSectionId, type: CabinetDocType): boolean {
  if (section === "A") return type === "purchase_confirm" || type === "car_invoice" || type === "auction_invoice" || type === "service_invoice" || type === "other";
  if (section === "B")
    return type === "pickup_pdf" || type === "cmr" || type === "transport_request_confirm" || type === "transport_invoice" || type === "other";
  return type === "service_invoice" || type === "csdd_status" || type === "note" || type === "other";
}

export function cabinetDocumentSourceChip(source: string, auction = ""): string {
  const s = source.trim();
  if (!s || s === "upload" || s === "manual") return "";
  const low = s.toLowerCase();
  if (low === "email" || low === "e-pasts") return "No e-pasta";
  if (low === "auto1" || low === "auction" || low === "izsole") {
    return auction ? `No izsoles - ${auction}` : "No izsoles";
  }
  if (/^no /i.test(s)) return s;
  return `No ${s}`;
}

export function liveCabinetDocuments(docs: CabinetDocument[]): CabinetDocument[] {
  return docs.filter((d) => !d.deletedAt);
}

export function cabinetSectionSummary(section: CabinetSectionId, docs: CabinetDocument[]): string {
  const live = liveCabinetDocuments(docs).filter((d) => d.section === section);
  if (section === "A") {
    const expected = 4;
    return `${live.length} no ${expected} augšupielādēti`;
  }
  if (live.length === 0) return "";
  return `${live.length} ${live.length === 1 ? "dokuments" : "dokumenti"}`;
}

export function readCabinetPrefsFromStorage(raw: string | null): Record<string, string> {
  if (!raw?.trim()) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === "string" && (v === "open" || v === "closed")) out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}
