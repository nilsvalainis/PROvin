/**
 * j70: IRISS sadaļa «Piedāvājumi» (tikai Admin). Atsevišķs ieraksts, nejaucas ar Pasūtījumu `offers[]`.
 * 1 auto = 1 piedāvājums. Vecie dati netiek pārnesti (Nila atbilde 14).
 * Glabājas tajā pašā IRISS krātuvē (`piedavajumi/<id>.json`), JSON tiek normalizēts lasot.
 */

import type { IrissPdAuto1Blocks } from "@/lib/iriss-piedavajumi-auto1";

export const IRISS_PD_STATUSES = ["requested", "draft", "sent", "approved", "declined", "expired"] as const;
export type IrissPdStatus = (typeof IRISS_PD_STATUSES)[number];

export const IRISS_PD_STATUS_LV: Record<IrissPdStatus, string> = {
  requested: "Pieprasīts",
  draft: "Melnraksts",
  sent: "Nosūtīts",
  approved: "Apstiprināts",
  declined: "Noraidīts",
  expired: "Beidzies termiņš",
};

/** Saraksta filtru čipiem īsāks teksts (maketā «Beidzies»). */
export const IRISS_PD_STATUS_FILTER_LV: Record<IrissPdStatus, string> = {
  ...IRISS_PD_STATUS_LV,
  expired: "Beidzies",
};

export const IRISS_PD_STATUS_HINT_LV: Record<IrissPdStatus, string> = {
  requested: "Klients pieprasīja - admins aizpilda",
  draft: "Admins veido, klientam nav redzams",
  sent: "Klientam pieejams, gaida atbildi",
  approved: "Automātiski Pasūtījums «Rezervēts»",
  declined: "Klients atteicās vai admins atzīmēja",
  expired: "Pēc manuālā termiņa - «Izveidot jaunu uz šī bāzes»",
};

/** Statusi, kuros auto ir «aizņemts» (1 auto = 1 piedāvājums). */
export const IRISS_PD_TAKEN_STATUSES: readonly IrissPdStatus[] = ["requested", "draft", "sent", "approved"];
/** Statusi, kuros termiņš var beigties automātiski. */
export const IRISS_PD_OPEN_STATUSES: readonly IrissPdStatus[] = ["requested", "draft", "sent"];

export const IRISS_PD_SOURCES = ["autoparks", "auto1", "autobid", "openlane", "mobilede", "manual"] as const;
export type IrissPdSource = (typeof IRISS_PD_SOURCES)[number];

export const IRISS_PD_SOURCE_LV: Record<IrissPdSource, string> = {
  autoparks: "Autoparks",
  auto1: "Auto1",
  autobid: "Autobid",
  openlane: "Openlane",
  mobilede: "mobile.de",
  manual: "Ar roku",
};

/** Auto1 bloki (maketa 05/06 numerācija 1-5). */
export const IRISS_PD_BLOCK_IDS = ["paint", "tech", "equipment", "damage", "vin"] as const;
export type IrissPdBlockId = (typeof IRISS_PD_BLOCK_IDS)[number];

export const IRISS_PD_BLOCK_LV: Record<IrissPdBlockId, string> = {
  paint: "Ārpuses krāsas karte",
  tech: "Tehniskie dati",
  equipment: "Aprīkojums · Serviss · Tehniskā apskate",
  damage: "Bojājumu kopsavilkums",
  vin: "Dati pēc VIN",
};

export type IrissPdToggle = { pdf: boolean; link: boolean };
export type IrissPdVisibility = { group: IrissPdToggle; blocks: Record<IrissPdBlockId, IrissPdToggle> };

export type IrissPdPhoto =
  /** Autoparka /STOCK bilde (Dropbox id), `ref` = "autoparks:<id>". */
  | { kind: "dropbox"; ref: string; id: string }
  /** Izsoles bilde (https). Klientam vienmēr caur mūsu starpniekceļu - izsoles adrese netiek rādīta. */
  | { kind: "url"; url: string };

export type IrissPdVehicle = {
  title: string;
  vin: string;
  year: string;
  firstRegistration: string;
  mileageKm: string;
  fuel: string;
  transmission: string;
  powerKw: string;
  engine: string;
  color: string;
  body: string;
};

export type IrissPdClient = {
  name: string;
  phone: string;
  email: string;
  /** IRISS pasūtījuma (klienta) id. Tad piedāvājums redzams arī šī klienta pasūtījumā. */
  orderId: string;
};

export type IrissPdHistoryEntry = { at: string; by: string; text: string };

export type IrissPiedavajums = {
  id: string;
  /** Secīgs numurs (PD-0001). */
  number: number;
  status: IrissPdStatus;
  createdAt: string;
  updatedAt: string;
  /* ---- Iekšējais (klients neredz) ---- */
  source: IrissPdSource;
  /** "autoparks:<id>" vai "". */
  sourceRef: string;
  /** Izsoles saite. */
  sourceUrl: string;
  /** Auto1 stock nr. / Openlane auction id u.c. (1 auto = 1 piedāvājums). */
  sourceKey: string;
  /** Cik lauku aizpildīja imports (vēsturei un «Atpazīts» rindai). */
  importedFieldCount: number;
  purchasePrice: string;
  internalNotes: string;
  /* ---- Klients redz ---- */
  vehicle: IrissPdVehicle;
  photos: IrissPdPhoto[];
  /** Gala cena klientam (EUR, brīvs teksts kā citur IRISS). */
  price: string;
  /** Derīgs līdz (YYYY-MM-DD, Rīgas dienas beigas). Obligāts nosūtīšanai, bez noklusējuma. */
  validUntil: string;
  client: IrissPdClient;
  auto1: IrissPdAuto1Blocks | null;
  auto1ImportedAt: string;
  visibility: IrissPdVisibility;
  /* ---- Saite, lēmums, saistītie ieraksti ---- */
  /** Publiskās saites tokens (privātajā krātuvē; saitē - tikai tas). */
  linkToken: string;
  decidedAt: string;
  /** Pasūtījums, kas izveidots/rezervēts pēc apstiprinājuma. */
  approvedOrderId: string;
  /** No kura (beigušā/noraidītā) piedāvājuma veidots. */
  basedOnId: string;
  history: IrissPdHistoryEntry[];
};

export type IrissPdListRow = {
  id: string;
  number: number;
  status: IrissPdStatus;
  title: string;
  vin: string;
  clientName: string;
  clientOrderId: string;
  source: IrissPdSource;
  sourceRef: string;
  sourceKey: string;
  hasAuto1: boolean;
  price: string;
  validUntil: string;
  approvedOrderId: string;
  cover: IrissPdPhoto | null;
  updatedAt: string;
};

export const IRISS_PD_MAX_PHOTOS = 60;
export const IRISS_PD_MAX_HISTORY = 200;

export function irissPdNumberLabel(n: number): string {
  return `PD-${String(Math.max(0, Math.floor(n))).padStart(4, "0")}`;
}

export function isIrissPdStatus(v: unknown): v is IrissPdStatus {
  return typeof v === "string" && (IRISS_PD_STATUSES as readonly string[]).includes(v);
}

export function isIrissPdSource(v: unknown): v is IrissPdSource {
  return typeof v === "string" && (IRISS_PD_SOURCES as readonly string[]).includes(v);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isSafeIrissPdId(id: unknown): id is string {
  return typeof id === "string" && UUID_RE.test(id);
}

/** Publiskās saites tokens: 24 base64url rakstzīmes. */
export function isSafeIrissPdToken(token: unknown): token is string {
  return typeof token === "string" && /^[A-Za-z0-9_-]{24}$/.test(token);
}

/**
 * Nila noklusējums (26.10): visi Auto1 bloki ieslēgti gan PDF, gan saitē, izņemot «Bojājumu kopsavilkums» (4) - izslēgts.
 */
export function defaultIrissPdVisibility(): IrissPdVisibility {
  const on: IrissPdToggle = { pdf: true, link: true };
  return {
    group: { ...on },
    blocks: {
      paint: { ...on },
      tech: { ...on },
      equipment: { ...on },
      damage: { pdf: false, link: false },
      vin: { ...on },
    },
  };
}

export function emptyIrissPdVehicle(): IrissPdVehicle {
  return { title: "", vin: "", year: "", firstRegistration: "", mileageKm: "", fuel: "", transmission: "", powerKw: "", engine: "", color: "", body: "" };
}

export function emptyIrissPdClient(): IrissPdClient {
  return { name: "", phone: "", email: "", orderId: "" };
}

export function emptyIrissPiedavajums(id: string, nowIso: string): IrissPiedavajums {
  return {
    id,
    number: 0,
    status: "draft",
    createdAt: nowIso,
    updatedAt: nowIso,
    source: "manual",
    sourceRef: "",
    sourceUrl: "",
    sourceKey: "",
    importedFieldCount: 0,
    purchasePrice: "",
    internalNotes: "",
    vehicle: emptyIrissPdVehicle(),
    photos: [],
    price: "",
    validUntil: "",
    client: emptyIrissPdClient(),
    auto1: null,
    auto1ImportedAt: "",
    visibility: defaultIrissPdVisibility(),
    linkToken: "",
    decidedAt: "",
    approvedOrderId: "",
    basedOnId: "",
    history: [],
  };
}

/** Klienta saite: `/p/d/<token>` (zem esošā /p ceļa - tā pati noindex/no-store apstrāde). */
export function irissPdPublicPath(token: string): string {
  return `/p/d/${token}`;
}
