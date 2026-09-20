/**
 * Admin Order Copilot — strukturētās darbības (negadījumi / nobraukums / serviss / RAW).
 */
import type { OutvinEquipmentLine, OutvinVehicleInfo } from "@/lib/outvin-dealer-types";
import type { LtabCertificate } from "@/lib/ltab-report-extract";

export const COPILOT_SOURCE_KEYS = [
  "csdd",
  "autodna",
  "carvertical",
  "ltab",
  "auto_records",
  "cc_vin",
  "citi_avoti",
  "tjekbil",
  "mnt_ee",
  "lkf_ee",
  "carinfo",
] as const;

export type CopilotSourceKey = (typeof COPILOT_SOURCE_KEYS)[number];

export const VIN_REGISTRY_COPILOT_SOURCES = ["tjekbil", "mnt_ee", "lkf_ee", "carinfo"] as const;
export type VinRegistryCopilotSource = (typeof VIN_REGISTRY_COPILOT_SOURCES)[number];

export function isVinRegistryCopilotSource(v: string): v is VinRegistryCopilotSource {
  return (VIN_REGISTRY_COPILOT_SOURCES as readonly string[]).includes(v);
}

export type CopilotConfidence = "high" | "medium" | "low";

export type CopilotIncidentAction = {
  type: "upsert_incident";
  source: CopilotSourceKey;
  date: string;
  lossAmount: string;
  country: string;
  confidence: CopilotConfidence;
  note?: string;
};

export type CopilotMileageAction = {
  type: "upsert_mileage";
  source: CopilotSourceKey;
  date: string;
  odometer: string;
  country: string;
  confidence: CopilotConfidence;
  note?: string;
};

/**
 * Vispārīgs laikposma fakts, kas nav nobraukums/negadījums (piem. AutoDNA/CarVertical
 * vēsturiskā cena vai sludinājums ārvalstīs) - "Vēstures kopsavilkums" PDF lentē.
 * Tikai `autodna` / `carvertical`, jo tie ir vienīgie bloki ar `vehicleHistoryTimeline`.
 */
export type CopilotVehicleHistoryTimelineAction = {
  type: "upsert_vehicle_history_timeline_row";
  source: "autodna" | "carvertical";
  date: string;
  description: string;
  country: string;
  odometer?: string;
  confidence: CopilotConfidence;
  note?: string;
};

/** Oficiālā dīlera „Servisa vēsture” — faktu rindas (datums + km + darbi). */
export type CopilotServiceHistoryAction = {
  type: "set_service_history";
  source: "auto_records";
  text: string;
  confidence: CopilotConfidence;
  note?: string;
};

/** OFICIĀLĀ DĪLERA DATI → „SERVISA UN REMONTU VĒSTURE” tabulas rinda. */
export type CopilotServiceWorkAction = {
  type: "upsert_service_work";
  source: "auto_records";
  date: string;
  odometer: string;
  /** Servisa punkts („Niederlassung Bonn BMW AG, Bonn”) — atsevišķa kolonna. */
  location: string;
  works: string;
  confidence: CopilotConfidence;
  note?: string;
};

/**
 * OFICIĀLĀ DĪLERA DATI — transporta informācijas lauki (VIN, dzinējs, ātrumkārba, krāsa,
 * interjērs, rūpnīcas kodi) no avotu atskaišu specifikācijas sadaļām.
 */
export type CopilotDealerVehicleInfoAction = {
  type: "set_dealer_vehicle_info";
  source: "auto_records";
  vehicleInfo: Partial<OutvinVehicleInfo>;
  /** Rūpnīcas komplektācija (tikai oficiālā dīlera izdrukas). */
  equipment?: OutvinEquipmentLine[];
  accidentCheck?: string;
  stolenCheck?: string;
  /**
   * `true` — oficiālā dīlera / rūpnīcas izdruka: šie lauki ir primārais avots un pārraksta
   * arī jau aizpildītās vērtības (piem. no AutoDNA vai CarVertical).
   */
  override?: boolean;
  confidence: CopilotConfidence;
  note?: string;
};

/** Būtiska papildu info → avota RAW žurnāls. */
export type CopilotAppendRawAction = {
  type: "append_raw";
  source: CopilotSourceKey;
  text: string;
  confidence: CopilotConfidence;
  note?: string;
};

/** tjekbil / mnt / lkf / car.info — īpašnieki, statusi, īsas piezīmes. */
export type CopilotRegistryFieldsAction = {
  type: "set_registry_fields";
  source: VinRegistryCopilotSource;
  ownersSummary: string;
  statusRecords: string;
  autoNotes: string;
  confidence: CopilotConfidence;
  note?: string;
};

/** LTAB OCTA izziņas strukturētā kopija + CSNg rindas (datums / summa / Latvija). */
export type CopilotLtabCertificateAction = {
  type: "set_ltab_certificate";
  source: "ltab";
  certificate: LtabCertificate;
  confidence: CopilotConfidence;
  note?: string;
};

/**
 * Teksta lauki, ko operators drīkst likt Copilotam iztīrīt. Apzināts allowlist:
 * viss, kas nav sarakstā, netiek dzēsts pat tad, ja modelis to pieprasa.
 */
export const COPILOT_CLEARABLE_FIELDS = [
  "comments",
  "rawUnprocessedData",
  "aiContextRaw",
  "pdfImportRaw",
  "serviceHistoryNotes",
  "oilChangeIntervalNotes",
  "ownersSummary",
  "statusRecords",
  "autoNotes",
] as const;

export type CopilotClearableField = (typeof COPILOT_CLEARABLE_FIELDS)[number];

export function isCopilotClearableField(v: string): v is CopilotClearableField {
  return (COPILOT_CLEARABLE_FIELDS as readonly string[]).includes(v);
}

/** NEGADĪJUMU VĒSTURE — rindas dzēšana. Bez `lossAmount` dzēš visas rindas ar šo datumu. */
export type CopilotDeleteIncidentAction = {
  type: "delete_incident";
  source: CopilotSourceKey;
  date: string;
  lossAmount?: string;
  confidence: CopilotConfidence;
  note?: string;
};

/** NOBRAUKUMS — rindas dzēšana. Bez `odometer` dzēš visas rindas ar šo datumu. */
export type CopilotDeleteMileageAction = {
  type: "delete_mileage";
  source: CopilotSourceKey;
  date: string;
  odometer?: string;
  confidence: CopilotConfidence;
  note?: string;
};

/** SERVISA UN REMONTU VĒSTURE — rindas dzēšana. */
export type CopilotDeleteServiceWorkAction = {
  type: "delete_service_work";
  source: "auto_records";
  date: string;
  odometer?: string;
  confidence: CopilotConfidence;
  note?: string;
};

/** Teksta lauka iztīrīšana (komentāri, RAW, servisa vēsture u.c.). */
export type CopilotClearFieldAction = {
  type: "clear_field";
  source: CopilotSourceKey;
  field: CopilotClearableField;
  confidence: CopilotConfidence;
  note?: string;
};

export type CopilotAction =
  | CopilotIncidentAction
  | CopilotMileageAction
  | CopilotVehicleHistoryTimelineAction
  | CopilotServiceHistoryAction
  | CopilotServiceWorkAction
  | CopilotDealerVehicleInfoAction
  | CopilotAppendRawAction
  | CopilotRegistryFieldsAction
  | CopilotLtabCertificateAction
  | CopilotDeleteIncidentAction
  | CopilotDeleteMileageAction
  | CopilotDeleteServiceWorkAction
  | CopilotClearFieldAction;

export const COPILOT_DESTRUCTIVE_ACTION_TYPES = [
  "delete_incident",
  "delete_mileage",
  "delete_service_work",
  "clear_field",
] as const;

/**
 * Dzēšošās darbības nekad neizpildās automātiski. Tās prasa `allowDestructive`
 * apply slānī, ko uzstāda tikai operatora apstiprinājuma ceļš.
 */
export function isDestructiveCopilotAction(action: { type: string }): boolean {
  return (COPILOT_DESTRUCTIVE_ACTION_TYPES as readonly string[]).includes(action.type);
}

export type CopilotChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type CopilotAiResponse = {
  reply: string;
  actions: CopilotAction[];
  /** Ja avots nav skaidrs — īss jautājums operatoram. */
  clarificationNeeded: string;
};

export function isCopilotSourceKey(v: string): v is CopilotSourceKey {
  return (COPILOT_SOURCE_KEYS as readonly string[]).includes(v);
}
