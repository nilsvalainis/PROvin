/**
 * IRISS admin — pasūtījumu ieraksti (JSON uz disku, neatkarīgi no PROVIN Stripe pasūtījumiem).
 */

import type { IrissCriteriaV1 } from "@/lib/iriss-criteria-types";

export type IrissOfferAttachment = {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  /** Tukšs, ja attēls ir Blob (`blobPath`). Vecie ieraksti var saturēt dataUrl. */
  dataUrl: string;
  /** Vercel Blob / FS ceļš. Migrācija atstāj dataUrl, ja augšupielāde neizdodas. */
  blobPath?: string;
  blobUrl?: string;
  /** Mazā JPEG miniatūra režģim. Pilnais attēls paliek `blobPath` / `dataUrl`. */
  thumbDataUrl?: string;
  thumbBlobPath?: string;
  thumbUrl?: string;
};

/** Maks. attēlu / pielikumu skaits vienā piedāvājumā (JSON PATCH ~12 MB ierobežojums). */
export const IRISS_MAX_OFFER_ATTACHMENTS = 60;

export const IRISS_GENERATED_DOCUMENT_KINDS = ["contract", "cost_estimate"] as const;
export type IrissGeneratedDocumentKind = (typeof IRISS_GENERATED_DOCUMENT_KINDS)[number];

export const IRISS_GENERATED_DOCUMENT_KIND_LV: Record<IrissGeneratedDocumentKind, string> = {
  contract: "Pasūtījuma līgums",
  cost_estimate: "Izmaksu tāme",
};

export type IrissGeneratedDocument = {
  id: string;
  kind: IrissGeneratedDocumentKind;
  name: string;
  mimeType: string;
  size: number;
  createdAt: string;
  blobPath: string;
  blobUrl?: string;
};

export const IRISS_GOOGLE_CONTACT_STATUSES = ["saved", "error", "unconfigured"] as const;
export type IrissGoogleContactStatus = (typeof IRISS_GOOGLE_CONTACT_STATUSES)[number];

export type IrissOfferRecord = {
  id: string;
  title: string;
  brandModel: string;
  /** VIN, ja zināms. Tukšs vecajos JSON. */
  vin: string;
  /** Legacy lauks (saglabājam atpakaļsaderībai). */
  year: string;
  /** Legacy lauks (saglabājam atpakaļsaderībai). */
  mileage: string;
  /** Legacy lauks (saglabājam atpakaļsaderībai). */
  priceGermany: string;
  /** Legacy lauks (saglabājam atpakaļsaderībai). */
  comment: string;
  /** Pamatinformācija (jaunā struktūra). */
  firstRegistration: string;
  odometerReading: string;
  transmission: string;
  location: string;
  fuel: string;
  driveType: string;
  powerKw: string;
  engineDisplacement: string;
  color: string;
  bodyTypeOffer: string;
  doorCount: string;
  emissionClass: string;
  originCountry: string;
  auctionPlatform: string;
  auctionStockNumber: string;
  auctionEndAt: string;
  vatStatus: string;
  damageGrade: string;
  equipmentHighlights: string;
  estimatedTotalPrice: string;
  keyCount: string;
  /** Vispārējais novērtējums — checkbox lauki. */
  hasFullServiceHistory: boolean;
  hasFactoryPaint: boolean;
  hasNoRustBody: boolean;
  hasSecondWheelSet: boolean;
  specialNotes: string;
  visualAssessment: string;
  technicalAssessment: string;
  summary: string;
  /** Cenu bloks. */
  carPrice: string;
  deliveryPrice: string;
  commissionFee: string;
  offerValidDays: string;
  /** Derīgs līdz (YYYY-MM-DD, Europe/Riga dienas beigas). Tukšs vecajos JSON. */
  validUntil: string;
  attachments: IrissOfferAttachment[];
  /** Vāka foto id. Tukšs: pirmais attēls. */
  coverAttachmentId?: string;
  createdAt: string;
  updatedAt: string;
};

/** Saraksta statuss (vizuālais + filtrs) — saglabāts pasūtījuma JSON. */
export const IRISS_PASUTIJUMS_LIST_STATUSES = [
  "active",
  "searching",
  "offered",
  "reserved",
  "completed",
  "inactive",
] as const;

export type IrissPasutijumsListStatus = (typeof IRISS_PASUTIJUMS_LIST_STATUSES)[number];

export const IRISS_PASUTIJUMS_LIST_STATUS_LV: Record<IrissPasutijumsListStatus, string> = {
  active: "Aktīvs",
  searching: "Meklē",
  offered: "Piedāvāts",
  reserved: "Rezervēts",
  completed: "Izpildīts",
  inactive: "Neaktīvs",
};

/** Admin statusa izvēle un filtri — tikai šie četri (saglabātajos JSON var palikt searching/offered). */
export const IRISS_PASUTIJUMS_PICKER_STATUSES = ["active", "reserved", "completed", "inactive"] as const;

export type IrissPasutijumsPickerStatus = (typeof IRISS_PASUTIJUMS_PICKER_STATUSES)[number];

export const IRISS_PASUTIJUMS_PICKER_STATUS_LV: Record<IrissPasutijumsPickerStatus, string> = {
  active: "Aktīvs",
  reserved: "Rezervēts",
  completed: "Izpildīts",
  inactive: "Neaktīvs",
};

/** Read-time: searching/offered → Aktīvs; pārējie 1:1. */
export function canonicalIrissPasutijumsListStatus(st: IrissPasutijumsListStatus): IrissPasutijumsPickerStatus {
  if (st === "reserved" || st === "completed" || st === "inactive") return st;
  return "active";
}

export function displayIrissPasutijumsListStatusLabel(st: IrissPasutijumsListStatus): string {
  return IRISS_PASUTIJUMS_PICKER_STATUS_LV[canonicalIrissPasutijumsListStatus(st)];
}

export const IRISS_PASUTIJUMS_WORKING_STATUSES: readonly IrissPasutijumsListStatus[] = [
  "active",
  "searching",
  "offered",
  "reserved",
];

export function isIrissPasutijumsListStatus(v: unknown): v is IrissPasutijumsListStatus {
  return typeof v === "string" && (IRISS_PASUTIJUMS_LIST_STATUSES as readonly string[]).includes(v);
}

export function parseIrissPasutijumsListStatus(v: unknown): IrissPasutijumsListStatus {
  const s = typeof v === "string" ? v.trim().toLowerCase() : "";
  if (isIrissPasutijumsListStatus(s)) return s;
  return "active";
}

export function isIrissPasutijumsWorkingStatus(s: IrissPasutijumsListStatus): boolean {
  return (IRISS_PASUTIJUMS_WORKING_STATUSES as readonly string[]).includes(s);
}

export type IrissDzintarzemeTameCommissionVariant = "A" | "B" | "C";

export type IrissDzintarzemeTameExtraDraft = {
  id: string;
  label: string;
  netStr: string;
};

/** Dzintarzeme Auto tāmes forma — autosaglabājas ar pasūtījumu (`PATCH`). */
export type IrissDzintarzemeTameDraft = {
  /** Ja tukšs, tāmes PDF / lauki izmanto pasūtījuma `brandModel`. */
  tameBrandModel: string;
  tameVin: string;
  tameAutoPriceStr: string;
  tameApplyVatAuto: boolean;
  tameCommissionVariant: IrissDzintarzemeTameCommissionVariant;
  /** C variants: fiksēta komisija EUR (neto). */
  tameCommissionManualEurStr: string;
  /** C variants: papildu % no atlikuma pēc iemaksas. */
  tameCommissionManualPercentStr: string;
  tameDepositPercent: number;
  tameTransportStr: string;
  tameChemicalStr: string;
  tamePolishingStr: string;
  tamePaintingStr: string;
  tameLeasingValuationStr: string;
  tameExtras: IrissDzintarzemeTameExtraDraft[];
};

export function defaultIrissDzintarzemeTameDraft(): IrissDzintarzemeTameDraft {
  return {
    tameBrandModel: "",
    tameVin: "",
    tameAutoPriceStr: "",
    tameApplyVatAuto: false,
    tameCommissionVariant: "A",
    tameCommissionManualEurStr: "",
    tameCommissionManualPercentStr: "",
    tameDepositPercent: 20,
    tameTransportStr: "",
    tameChemicalStr: "",
    tamePolishingStr: "",
    tamePaintingStr: "",
    tameLeasingValuationStr: "",
    tameExtras: [],
  };
}

function clipStr(v: unknown, max: number): string {
  const t = typeof v === "string" ? v : "";
  return t.length > max ? t.slice(0, max) : t;
}

export function normalizeIrissDzintarzemeTameDraft(raw: unknown): IrissDzintarzemeTameDraft {
  const d = defaultIrissDzintarzemeTameDraft();
  if (!raw || typeof raw !== "object") return d;
  const o = raw as Record<string, unknown>;
  const depRaw = typeof o.tameDepositPercent === "number" ? o.tameDepositPercent : Number.parseInt(String(o.tameDepositPercent ?? ""), 10);
  const dep = Number.isFinite(depRaw) ? Math.min(100, Math.max(0, Math.round(depRaw))) : d.tameDepositPercent;
  const variantRaw = o.tameCommissionVariant;
  const variant: IrissDzintarzemeTameCommissionVariant =
    variantRaw === "B" || variantRaw === "C" ? variantRaw : "A";
  const extrasRaw = o.tameExtras;
  const extras: IrissDzintarzemeTameExtraDraft[] = [];
  if (Array.isArray(extrasRaw)) {
    for (const row of extrasRaw.slice(0, 24)) {
      if (!row || typeof row !== "object") continue;
      const r = row as Record<string, unknown>;
      const idRaw = typeof r.id === "string" ? r.id.trim() : "";
      const id = idRaw.length > 0 ? idRaw.slice(0, 48) : `gen-${extras.length}`;
      extras.push({
        id,
        label: clipStr(r.label, 200),
        netStr: clipStr(r.netStr, 32),
      });
    }
  }
  return {
    tameBrandModel: clipStr(o.tameBrandModel, 400),
    tameVin: clipStr(o.tameVin, 32),
    tameAutoPriceStr: clipStr(o.tameAutoPriceStr, 32),
    tameApplyVatAuto: Boolean(o.tameApplyVatAuto),
    tameCommissionVariant: variant,
    tameCommissionManualEurStr: clipStr(o.tameCommissionManualEurStr, 32),
    tameCommissionManualPercentStr: clipStr(o.tameCommissionManualPercentStr, 32),
    tameDepositPercent: dep,
    tameTransportStr: clipStr(o.tameTransportStr, 32),
    tameChemicalStr: clipStr(o.tameChemicalStr, 32),
    tamePolishingStr: clipStr(o.tamePolishingStr, 32),
    tamePaintingStr: clipStr(o.tamePaintingStr, 32),
    tameLeasingValuationStr: clipStr(o.tameLeasingValuationStr, 32),
    tameExtras: extras,
  };
}

export type IrissStatusHistoryEntry = {
  from: IrissPasutijumsListStatus;
  to: IrissPasutijumsListStatus;
  at: string;
  by: string;
  reason?: string;
};

export type IrissPasutijumsRecord = {
  id: string;
  createdAt: string;
  updatedAt: string;
  pinnedAt: string;
  /** Optimistic concurrency. Vecie JSON bez lauka = 0. */
  workspaceRevision: number;
  /** Saraksta / darba plūsmas statuss. */
  listStatus: IrissPasutijumsListStatus;
  /** Kad listStatus pēdējoreiz mainīts (ISO). Vecie JSON var būt tukši. */
  statusChangedAt?: string;
  /** Statusu vēsture. Aditīvs lauks, vecie JSON bez tā. */
  statusHistory?: IrissStatusHistoryEntry[];
  /** Neaktīvs iemesls (neobligāts). */
  inactiveReason?: string;
  /** Mīkstā dzēšana. Tukšs / nav = redzams sarakstā. */
  deletedAt?: string;
  /** Tombstones: lauks → iztukšošanas laiks ms. Tukšais uzvar, ja jaunāks. */
  clearedFields?: Record<string, number>;
  /** Lauka pēdējās izmaiņas ms. Konflikta merge ņem jaunāko. */
  fieldUpdatedAt?: Record<string, number>;
  clientFirstName: string;
  clientLastName: string;
  phone: string;
  email: string;
  /** Google People API kontakts (idempotents). Tukšs, ja nav sinhronizēts. */
  googleContactResourceName?: string;
  googleContactStatus?: IrissGoogleContactStatus;
  googleContactUpdatedAt?: string;
  googleContactError?: string;
  orderDate: string;
  brandModel: string;
  /** VIN, ja zināms. Tukšs vecajos JSON. */
  vin: string;
  productionYears: string;
  totalBudget: string;
  engineType: string;
  transmission: string;
  bodyType: string;
  driveType: string;
  seatCount: string;
  maxMileage: string;
  preferredColors: string;
  nonPreferredColors: string;
  interiorFinish: string;
  /** Jauda (kW) specifikācijā, ne tikai no teksta. */
  powerKw: string;
  damageTolerance: string;
  preferredCountries: string;
  /** Klienta finansējuma % no kopējā budžeta (0 = nav izvēlēts). */
  clientFinancingPercent: number;
  /** Darījuma detaļas — PDF attēlo tikai ieķeksētos (vērtība "Jā"). */
  dealLeasingOrCredit: boolean;
  dealClientFinancing100: boolean;
  dealClientFinancing20: boolean;
  dealVat21Required: boolean;
  dealServiceStartDeposit: boolean;
  dealEkki: boolean;
  equipmentRequired: string;
  equipmentDesired: string;
  notes: string;
  /**
   * Sludinājumu platformu saites (masīvi; vecais JSON var būt viena virkne).
   * Kārtība saglabājas. Tukša forma: `[""]`.
   */
  listingLinkMobile: string[];
  listingLinkAutobid: string[];
  listingLinkOpenline: string[];
  listingLinkAuto1: string[];
  listingLinkEcarstrade: string[];
  /** „Citi” — vairākas rindas; tukšās pirms saglabāšanas var apvienot. */
  listingLinksOther: string[];
  /** Dzintarzeme Auto izmaksu tāmes lauki (admin autosaglabāšana). */
  dzintarzemeTameDraft: IrissDzintarzemeTameDraft;
  /** Piedāvājumi klientam (var būt vairāki). */
  offers: IrissOfferRecord[];
  /** Ģenerētie PDF (līgums, tāme). Jaunākie pirmie. */
  generatedDocuments?: IrissGeneratedDocument[];
  /**
   * Aditīvi kritēriji ar vairākiem filtriem. Vecie JSON šo lauku nesatur.
   * Migrācija to neraksta. Teksta lauki un saišu masīvi paliek. Krāsa šajā shēmā nav.
   */
  criteria?: IrissCriteriaV1;
};

export type IrissPasutijumsListRow = {
  id: string;
  createdAt: string;
  updatedAt: string;
  pinnedAt: string;
  listStatus: IrissPasutijumsListStatus;
  /** Mīkstā dzēšana. Tukšs / nav = redzams parastajā sarakstā. */
  deletedAt?: string;
  clientFirstName: string;
  clientLastName: string;
  orderDate: string;
  brandModel: string;
  vin: string;
  totalBudget: string;
  phone: string;
  productionYears: string;
  engineType: string;
  transmission: string;
  bodyType: string;
  driveType: string;
  seatCount: string;
  maxMileage: string;
  preferredColors: string;
  nonPreferredColors: string;
  interiorFinish: string;
  dealLeasingOrCredit: boolean;
  dealClientFinancing100: boolean;
  dealClientFinancing20: boolean;
  dealVat21Required: boolean;
  dealServiceStartDeposit: boolean;
  dealEkki: boolean;
  equipmentRequired: string;
  equipmentDesired: string;
  notes: string;
  email: string;
  /**
   * Gatava etiķete sarakstam (`120 kW`), rēķināta no dzinēja/aprīkojuma teksta.
   * Tukšs, ja jauda nav nolasāma.
   */
  powerKwLabel: string;
  listingLinkMobile: string[];
  listingLinkAutobid: string[];
  listingLinkOpenline: string[];
  listingLinkAuto1: string[];
  listingLinkEcarstrade: string[];
  listingLinksOther: string[];
  /** Jaunākā piedāvājuma validUntil (YYYY-MM-DD). Tukšs vecajos JSON. */
  latestOfferValidUntil?: string;
  hasExpiredOffer?: boolean;
};

/** Saraksta kārtība (Blob/FS JSON) — piespraustie un pārējie atsevišķi. */
export type IrissPasutijumiListOrder = { pinnedOrder: string[]; unpinnedOrder: string[] };

export const IRISS_DEAL_DETAIL_OPTIONS = [
  { key: "dealLeasingOrCredit", label: "Līzings, kredīts" },
  { key: "dealClientFinancing100", label: "Klienta finansējums 100%" },
  { key: "dealClientFinancing20", label: "Klienta finansējums 20%" },
  { key: "dealVat21Required", label: "Obligāta cena ar PVN 21%" },
  { key: "dealServiceStartDeposit", label: "Depozīts (pakalpojuma uzsākšanai)" },
  { key: "dealEkki", label: "EKKI" },
] as const satisfies ReadonlyArray<{ key: keyof IrissPasutijumsRecord; label: string }>;

export function emptyIrissOfferRecord(id: string, nowIso: string, title = "Piedāvājums 1"): IrissOfferRecord {
  return {
    id,
    title,
    brandModel: "",
    vin: "",
    year: "",
    mileage: "",
    priceGermany: "",
    comment: "",
    firstRegistration: "",
    odometerReading: "",
    transmission: "",
    location: "",
    fuel: "",
    driveType: "",
    powerKw: "",
    engineDisplacement: "",
    color: "",
    bodyTypeOffer: "",
    doorCount: "",
    emissionClass: "",
    originCountry: "",
    auctionPlatform: "",
    auctionStockNumber: "",
    auctionEndAt: "",
    vatStatus: "",
    damageGrade: "",
    equipmentHighlights: "",
    estimatedTotalPrice: "",
    keyCount: "",
    hasFullServiceHistory: false,
    hasFactoryPaint: false,
    hasNoRustBody: false,
    hasSecondWheelSet: false,
    specialNotes: "",
    visualAssessment: "",
    technicalAssessment: "",
    summary: "",
    carPrice: "",
    deliveryPrice: "",
    commissionFee: "",
    offerValidDays: "",
    validUntil: "",
    attachments: [],
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

export function emptyIrissPasutijums(id: string, nowIso: string): IrissPasutijumsRecord {
  const d = nowIso.slice(0, 10);
  return {
    id,
    createdAt: nowIso,
    updatedAt: nowIso,
    pinnedAt: "",
    workspaceRevision: 0,
    listStatus: "active",
    clientFirstName: "",
    clientLastName: "",
    phone: "",
    email: "",
    orderDate: d,
    brandModel: "",
    vin: "",
    productionYears: "",
    totalBudget: "",
    engineType: "",
    transmission: "",
    bodyType: "",
    driveType: "",
    seatCount: "",
    maxMileage: "",
    preferredColors: "",
    nonPreferredColors: "",
    interiorFinish: "",
    powerKw: "",
    damageTolerance: "",
    preferredCountries: "",
    clientFinancingPercent: 0,
    dealLeasingOrCredit: false,
    dealClientFinancing100: false,
    dealClientFinancing20: false,
    dealVat21Required: false,
    dealServiceStartDeposit: false,
    dealEkki: false,
    equipmentRequired: "",
    equipmentDesired: "",
    notes: "",
    listingLinkMobile: [""],
    listingLinkAutobid: [""],
    listingLinkOpenline: [""],
    listingLinkAuto1: [""],
    listingLinkEcarstrade: [""],
    listingLinksOther: [""],
    dzintarzemeTameDraft: defaultIrissDzintarzemeTameDraft(),
    offers: [],
    generatedDocuments: [],
  };
}
