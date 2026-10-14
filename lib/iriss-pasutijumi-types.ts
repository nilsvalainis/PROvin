/**
 * IRISS admin — pasūtījumu ieraksti (JSON uz disku, neatkarīgi no PROVIN Stripe pasūtījumiem).
 */

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
};

/** Maks. attēlu / pielikumu skaits vienā piedāvājumā (JSON PATCH ~12 MB ierobežojums). */
export const IRISS_MAX_OFFER_ATTACHMENTS = 60;

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
  attachments: IrissOfferAttachment[];
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

export type IrissDzintarzemeTameCommissionVariant = "A" | "B";

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
  tameDepositPercent: number;
  tameTransportStr: string;
  tameChemicalStr: string;
  tamePolishingStr: string;
  tamePaintingStr: string;
  tameExtras: IrissDzintarzemeTameExtraDraft[];
};

export function defaultIrissDzintarzemeTameDraft(): IrissDzintarzemeTameDraft {
  return {
    tameBrandModel: "",
    tameVin: "",
    tameAutoPriceStr: "",
    tameApplyVatAuto: false,
    tameCommissionVariant: "A",
    tameDepositPercent: 20,
    tameTransportStr: "",
    tameChemicalStr: "",
    tamePolishingStr: "",
    tamePaintingStr: "",
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
  const variant = o.tameCommissionVariant === "B" ? "B" : "A";
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
    tameDepositPercent: dep,
    tameTransportStr: clipStr(o.tameTransportStr, 32),
    tameChemicalStr: clipStr(o.tameChemicalStr, 32),
    tamePolishingStr: clipStr(o.tamePolishingStr, 32),
    tamePaintingStr: clipStr(o.tamePaintingStr, 32),
    tameExtras: extras,
  };
}

export type IrissPasutijumsRecord = {
  id: string;
  createdAt: string;
  updatedAt: string;
  pinnedAt: string;
  /** Optimistic concurrency. Vecie JSON bez lauka = 0. */
  workspaceRevision: number;
  /** Saraksta / darba plūsmas statuss. */
  listStatus: IrissPasutijumsListStatus;
  clientFirstName: string;
  clientLastName: string;
  phone: string;
  email: string;
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
  /** „Citi” — vairākas rindas; tukšās pirms saglabāšanas var apvienot. */
  listingLinksOther: string[];
  /** Dzintarzeme Auto izmaksu tāmes lauki (admin autosaglabāšana). */
  dzintarzemeTameDraft: IrissDzintarzemeTameDraft;
  /** Piedāvājumi klientam (var būt vairāki). */
  offers: IrissOfferRecord[];
};

export type IrissPasutijumsListRow = {
  id: string;
  createdAt: string;
  updatedAt: string;
  pinnedAt: string;
  listStatus: IrissPasutijumsListStatus;
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
  listingLinksOther: string[];
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
    listingLinksOther: [""],
    dzintarzemeTameDraft: defaultIrissDzintarzemeTameDraft(),
    offers: [],
  };
}
