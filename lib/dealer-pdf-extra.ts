/**
 * Dīlera PDF «EXTRA · Papildu dati» (Nils 26.11): admins pie dīlera PDF var pievienot bezmaksas avotu sadaļas.
 * Izvēle dzīvo tikai lapas stāvoklī (netiek saglabāta pasūtījumā). Maksas avoti (AutoDNA, carVertical,
 * CARFAX pilnā) nekad nav izvēlami un nekad nenonāk dīlera PDF.
 */

import type { ClientReportLang } from "@/lib/client-report-i18n";
import type { SectionIconId } from "@/lib/section-icons";
import { DEALER_ONLY_PDF_VISIBILITY, type PdfVisibilitySettings } from "@/lib/pdf-visibility";

/** Avotu sadaļas (redzamības karogi) - secība kā izvēlnē un PDF. */
export const DEALER_EXTRA_SOURCE_KEYS = [
  "csdd",
  "ltab",
  "cc_vin",
  "tjekbil",
  "mnt_ee",
  "lkf_ee",
  "carinfo",
  "traficom_fi",
  "finnik",
  "asv",
  "citi_avoti",
] as const;
export type DealerExtraSourceKey = (typeof DEALER_EXTRA_SOURCE_KEYS)[number];

/** Avoti, kas PDF payload nāk kā `manualVendorBlocks` (virsraksts = `SOURCE_BLOCK_LABELS[key]`). */
export const DEALER_EXTRA_VENDOR_KEYS = ["tjekbil", "mnt_ee", "lkf_ee", "carinfo", "traficom_fi", "finnik"] as const;

/** Kopējās tabulas (no izvēlētajiem avotiem + dīlera datiem). */
export const DEALER_EXTRA_TABLE_KEYS = ["unifiedMileage", "unifiedIncidents"] as const;
export type DealerExtraTableKey = (typeof DEALER_EXTRA_TABLE_KEYS)[number];

export type DealerExtraKey = DealerExtraSourceKey | DealerExtraTableKey;

export const DEALER_EXTRA_KEYS: readonly DealerExtraKey[] = [
  ...DEALER_EXTRA_TABLE_KEYS,
  ...DEALER_EXTRA_SOURCE_KEYS,
];

/** Maksas avoti - nekad dīlera PDF (arī ja kāds tos ieliek payload). */
export const DEALER_EXTRA_PAID_KEYS = ["autodna", "carvertical", "carfax"] as const;

const KEY_SET = new Set<string>(DEALER_EXTRA_KEYS);

export function isDealerExtraKey(v: unknown): v is DealerExtraKey {
  return typeof v === "string" && KEY_SET.has(v);
}

/** Tīra izvēle: tikai zināmās atslēgas, bez dublikātiem, kanoniskā secībā. */
export function normalizeDealerExtra(raw: unknown): DealerExtraKey[] {
  if (!Array.isArray(raw)) return [];
  const picked = new Set(raw.filter(isDealerExtraKey));
  return DEALER_EXTRA_KEYS.filter((k) => picked.has(k));
}

export function dealerExtraSourceKeys(extra: readonly DealerExtraKey[]): DealerExtraSourceKey[] {
  const s = new Set<string>(extra);
  return DEALER_EXTRA_SOURCE_KEYS.filter((k) => s.has(k));
}

const SOURCES_OFF: Record<DealerExtraSourceKey, false> = {
  csdd: false,
  ltab: false,
  cc_vin: false,
  tjekbil: false,
  mnt_ee: false,
  lkf_ee: false,
  carinfo: false,
  traficom_fi: false,
  finnik: false,
  asv: false,
  citi_avoti: false,
};

/**
 * Dīlera PDF redzamība + izvēlētie avoti (kopējām tabulām - dīleris arī iekšā).
 * Maksas avoti, sludinājums, eksperta teksti un admin komentāri vienmēr izslēgti.
 */
export function dealerExtraCombinedVisibility(
  base: PdfVisibilitySettings,
  extra: readonly DealerExtraKey[],
): PdfVisibilitySettings {
  const on: Partial<Record<DealerExtraSourceKey, true>> = {};
  for (const k of dealerExtraSourceKeys(extra)) on[k] = true;
  return {
    ...base,
    ...SOURCES_OFF,
    ...on,
    csddMileageTable: on.csdd === true,
    unifiedMileage: extra.includes("unifiedMileage"),
    unifiedIncidents: extra.includes("unifiedIncidents"),
    autodna: false,
    carvertical: false,
    carfax: false,
    sludinajums: false,
    iriss: false,
    irissTechnicalRisks: false,
    irissInspection: false,
    irissSummary: false,
    mileageComment: false,
    incidentsSummary: false,
    incidentPhotos: false,
    alerts: false,
    csddPdfWarnings: false,
    csddPdfRestrictions: false,
    csddPdfMeasurements: false,
    csddPdfTaAnalysis: false,
  };
}

/** Tikai izvēlētās avotu sadaļas (bez dīlera bloka) - EXTRA daļas avotu kartītēm. */
export function dealerExtraSourcesOnlyVisibility(extra: readonly DealerExtraKey[]): PdfVisibilitySettings {
  const v = dealerExtraCombinedVisibility(DEALER_ONLY_PDF_VISIBILITY, extra);
  return { ...v, auto_records: false, oneauto: false, autoRecordsOilInterval: false, autoRecordsEquipment: false };
}

type L4 = Record<ClientReportLang, string>;

export const DEALER_EXTRA_SECTION_TITLE: L4 = {
  lv: "EXTRA · Papildu dati",
  en: "EXTRA · Additional data",
  ru: "EXTRA · Дополнительные данные",
  de: "EXTRA · Zusätzliche Daten",
};

/**
 * PDF sadaļu virsraksti EXTRA daļā - datu veids, bez avotu logo un piegādātāju nosaukumiem.
 * (Kopējo tabulu virsraksti paliek esošie - tie jau ir vispārīgi.)
 */
export const DEALER_EXTRA_PDF_TITLES: Record<DealerExtraSourceKey, L4> = {
  csdd: { lv: "CSDD", en: "CSDD", ru: "CSDD", de: "CSDD" },
  ltab: {
    lv: "Apdrošināšanas gadījumi (LV)",
    en: "Insurance claims (LV)",
    ru: "Страховые случаи (LV)",
    de: "Versicherungsfälle (LV)",
  },
  cc_vin: {
    lv: "Izsoļu portālu arhīvs",
    en: "Auction archive",
    ru: "Архив аукционов",
    de: "Auktionsarchiv",
  },
  tjekbil: { lv: "Dānijas reģistrs", en: "Danish registry", ru: "Реестр Дании", de: "Dänisches Register" },
  mnt_ee: { lv: "Igaunijas reģistrs", en: "Estonian registry", ru: "Реестр Эстонии", de: "Estnisches Register" },
  lkf_ee: {
    lv: "Igaunijas apdrošināšanas dati",
    en: "Estonian insurance data",
    ru: "Страховые данные Эстонии",
    de: "Estnische Versicherungsdaten",
  },
  carinfo: { lv: "Zviedrijas reģistrs", en: "Swedish registry", ru: "Реестр Швеции", de: "Schwedisches Register" },
  traficom_fi: { lv: "Somijas reģistrs", en: "Finnish registry", ru: "Реестр Финляндии", de: "Finnisches Register" },
  finnik: {
    lv: "Nīderlandes reģistrs",
    en: "Dutch registry",
    ru: "Реестр Нидерландов",
    de: "Niederländisches Register",
  },
  asv: { lv: "ASV vēsture", en: "US history", ru: "История США", de: "US-Historie" },
  citi_avoti: { lv: "Citi dati", en: "Other data", ru: "Другие данные", de: "Weitere Daten" },
};

/** Vispārīga ikona katram datu veidam (nekad zīmola logo). */
export const DEALER_EXTRA_PDF_ICONS: Record<DealerExtraSourceKey, SectionIconId> = {
  csdd: "scrollText",
  ltab: "shield",
  cc_vin: "globe",
  tjekbil: "database",
  mnt_ee: "database",
  lkf_ee: "shield",
  carinfo: "database",
  traficom_fi: "database",
  finnik: "database",
  asv: "flag",
  citi_avoti: "layers",
};

/** Admin izvēlnes nosaukumi (latviski). */
export const DEALER_EXTRA_ADMIN_LABELS: Record<DealerExtraKey, string> = {
  unifiedMileage: "Nobraukuma vēsture",
  unifiedIncidents: "Negadījumu vēsture",
  csdd: "CSDD",
  ltab: "LTAB",
  cc_vin: "Izsoļu arhīvs",
  tjekbil: "Dānija",
  mnt_ee: "Igaunija - mnt.ee",
  lkf_ee: "Igaunija - lkf.ee",
  carinfo: "Zviedrija",
  traficom_fi: "Somija",
  finnik: "Nīderlande",
  asv: "ASV vēsture",
  citi_avoti: "Citi avoti",
};

export type DealerExtraAvailability = { key: DealerExtraKey; label: string; count: number };

/** «1 ieraksts» / «12 ieraksti». */
export function formatDealerExtraCount(n: number): string {
  if (n <= 0) return "";
  const one = n % 10 === 1 && n % 100 !== 11;
  return `${n} ${one ? "ieraksts" : "ieraksti"}`;
}
