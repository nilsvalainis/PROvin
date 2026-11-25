/**
 * Vēstures kopsavilkums - viena hronoloģiska transportlīdzekļa dzīves cikla lente no visiem avotiem.
 * Fakti nāk no jau savāktajiem blokiem; loģikas slānis pievieno importu, robus un pretrunas.
 */

import {
  emptyAutoRecordsBlock,
  ltabRowHasData,
  REGISTRY_STYLE_BLOCK_KEYS,
  SOURCE_BLOCK_LABELS,
  type AutoRecordsBlockState,
  type CitiAvotiBlockState,
  type ClientManualLtabBlockPdf,
  type ClientManualVendorBlockPdf,
  type CsddFormFields,
  type TirgusFormFields,
} from "@/lib/admin-source-blocks";
import { autoRecordsServiceWorkRowIsPrintable } from "@/lib/auto-records-service-works";
import { resolveDealerAutoRecords } from "@/lib/oneauto-to-auto-records";
import { formatAutoRecordsDateForOutput } from "@/lib/auto-records-paste-parse";
import {
  ASV_PDF_SOURCE_LABEL,
  asvBlockToCcVinView,
  asvRecordRowHasData,
  type AsvBlockState,
} from "@/lib/asv-report";
import {
  CC_VIN_PDF_SOURCE_LABEL,
  ccVinAmountToEurDisplay,
  ccVinDamageRowHasData,
  ccVinRecordRowHasData,
  ccVinSaleRowHasData,
  ccVinTitleRowHasData,
  type CcVinBlockState,
} from "@/lib/cc-vin-report";
import { parseDotOrIsoDateToMs } from "@/lib/clean-date-str";
import {
  countryIsoFromLvLocative,
  countryLabelToIso2,
  countryNameLvLocative,
  iso2ToLvDisplayName,
  normalizeCountryNameLv,
} from "@/lib/country-names-lv";
import { dealerVisitTimelineTitle } from "@/lib/dealer-visit-kind";
import { capitalizeRegistryEvent, translateTextLv } from "@/lib/vin-sources/translate-lv";
import {
  aggregateUnifiedIncidents,
  collectUnifiedIncidentDamageDetails,
  collectUnifiedIncidentRows,
  type UnifiedIncidentCluster,
} from "@/lib/unified-incidents";
import {
  analyzeUnifiedMileageAnomalies,
  collectUnifiedMileageRows,
  isVerifiedMileageSource,
  prepareUnifiedMileageDisplayRows,
} from "@/lib/unified-mileage";
import {
  collectListingPriceLifecyclePoints,
  formatListingOdometerKm,
  formatListingPriceEur,
} from "@/lib/listing-price-lifecycle";
import { resolveListingCountry } from "@/lib/listing-odometer";
import { isVendorTimelineListingRecord } from "@/lib/vendor-timeline-listing";
import { stripRegistryPersonNames } from "@/lib/vin-registry-client-text";
import {
  isOwnerChangeDescription,
  OWNER_LIST_ENTRY_RE,
  VENDOR_REGISTERED_RE,
} from "@/lib/lifecycle-owner-change-text";
import { csddHasLatvianRegistryRecord } from "@/lib/owner-count-synthesis";
import {
  isCsddFirstRegistrationInLatviaLabel,
  ownerFirstRegistrationInLatvia,
} from "@/lib/csdd-extended-parse";

export const PDF_LIFECYCLE_TITLE = "Vēstures kopsavilkums";

/** Vienīgā kartīte ar šo nosaukumu: auto agrākā reģistrācija jebkurā valstī. */
export const FIRST_REGISTRATION_TITLE = "Pirmā reģistrācija";

export type LifecycleEventKind =
  | "first_registration"
  | "registration"
  /** Īpašnieka maiņa ārvalstīs (reģistrs vai AutoDNA/CarVertical). Latvijas maiņas paliek `registration` no CSDD. */
  | "owner_change"
  | "import"
  | "inspection"
  | "odometer"
  | "incident"
  | "service"
  | "listed"
  | "sale"
  | "gap"
  | "anomaly";

export type LifecycleEventTone = "info" | "warn" | "alert";

export type LifecycleEvent = {
  kind: LifecycleEventKind;
  /** Attēlojamais datums (DD.MM.YYYY vai MM.YYYY). */
  date: string;
  /** Kārtošanai; 0, ja datums nav nolasāms. */
  time: number;
  year: string;
  title: string;
  detail: string;
  /** Garš avota teksts zem kartītes virsraksta rindas (pilnā platumā). */
  body?: string;
  country: string;
  /** Tikai `import`: iepriekšējā valsts (mērķa valsts paliek `country`). */
  fromCountry?: string;
  odometer: string;
  sources: string[];
  tone: LifecycleEventTone;
  /** Negadījuma kartīte - tas pats klasteris, ko „Negadījumu vēsture”. */
  incident?: UnifiedIncidentCluster;
  /** Sludinājuma cenas izmaiņa pret iepriekšējo rādīto cenu (0 = sākuma punkts). */
  priceDelta?: number;
  /**
   * Valsts nāk no sludinājuma/tirgus avota, ne no oficiāla reģistra vai dīlera datiem.
   * Šāda valsts nedrīkst noteikt robežšķērsošanas (importa) notikumus starp kaimiņiem
   * un nedrīkst kļūt par jauno `prevCountry` - pretējā gadījumā pārdevēja kļūdains/apzināti
   * pazemināts nobraukums (ar piesaistītu nepareizu valsti) izskatās pēc reālas robežas
   * šķērsošanas turp un atpakaļ.
   */
  countryUnverified?: boolean;
  /**
   * Rinda no avota „Laikposma ieraksti” tabulas (AutoDNA, CarVertical, Citi avoti).
   * Zemāks svars nekā nobraukums / reģistrs: nerāda „nav apstiprināts” un nestājas pretī
   * jau apstiprinātai citai valstij. Ja pirms tam nav stipras valsts, zināmā ISO valsts
   * aizpilda ķēdi (ASV no CarVertical pirms Lietuvas odometra).
   * Reģistra hronoloģija (tjekbil / Finnik / Traficom u.c.) šo karogu nesaņem.
   */
  timelineInformational?: boolean;
  /**
   * Valsts nacionālā (pirmā) reģistrācija - „Reģistrācija Somijā”, „Reģistrācija Latvijā”.
   * Nav auto pirmā reģistrācija; kļūst par to tikai, ja agrākas reģistrācijas nav (`resolveFirstRegistration`).
   */
  nationalRegistration?: boolean;
};

/** Valsts no sludinājuma vai laikposma tabulas - rāda, bet nešķērso robežu pret stipro ķēdi. */
export function lifecycleCountryIsSoft(e: Pick<LifecycleEvent, "countryUnverified" | "timelineInformational">): boolean {
  return e.countryUnverified === true || e.timelineInformational === true;
}

/** Viena vārteja: sludinājums, robs, neapstiprināts vai neatpazīstams teksts nav valsts. */
export function lifecycleEventKnownCountryIso(
  e: Pick<LifecycleEvent, "country" | "kind" | "countryUnverified">,
): string | null {
  if (e.kind === "listed" || e.kind === "gap") return null;
  if (e.countryUnverified) return null;
  return countryLabelToIso2(e.country);
}

/**
 * „Laikposma ieraksti” (AutoDNA, CarVertical, Citi avoti) ir informatīvi.
 * Publisko reģistru hronoloģija paliek stipra un drīkst dzīt valsts maiņu.
 */
export function vendorTimelineIsInformational(sourceTitle: string): boolean {
  return !REGISTRY_STYLE_BLOCK_KEYS.some((k) => SOURCE_BLOCK_LABELS[k] === sourceTitle);
}

/** Mēnešu skaits starp notikumiem, no kura robs kļūst par patstāvīgu ierakstu. */
const GAP_MONTHS_THRESHOLD = 24;

/**
 * BMW/dīlera iekšējie kodi (piem. „Dīlera ID: 00863-3”) nav saprotami pircējam
 * un nedrīkst parādīties ekspluatācijas hronoloģijā.
 */
const OPAQUE_DEALER_CODE_RE =
  /(?:^|\s|[,;])(?:d[iī]lera|dealer)\s+id\s*:?\s*[0-9][0-9a-z.\-\/\s]*/gi;

/** Noņem dīlera ID kodus; tukšs, ja pēc tīrīšanas paliek tikai interpunkcija. */
export function lifecyclePublicCaption(raw: string): string {
  const t = raw
    .replace(OPAQUE_DEALER_CODE_RE, " ")
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s,;:.\---]+|[\s,;:.\---]+$/g, "")
    .trim();
  return t;
}

export type LifecycleInput = {
  csddForm?: CsddFormFields | null;
  autoRecordsBlock?: AutoRecordsBlockState | null;
  oneautoBlock?: import("@/lib/oneauto-block").OneautoBlockState | null;
  ccVinBlock?: CcVinBlockState | null;
  asvBlock?: AsvBlockState | null;
  manualVendorBlocks?: ClientManualVendorBlockPdf[] | null;
  manualLtabBlock?: ClientManualLtabBlockPdf | null;
  citiAvoti?: CitiAvotiBlockState | null;
  tirgusForm?: TirgusFormFields | null;
  listingUrl?: string | null;
};

function displayDate(raw: string, ms: number): string {
  const t = raw.trim();
  if (/^\d{1,2}\.\d{1,2}\.\d{4}$/.test(t)) return t;
  if (/^\d{1,2}\.\d{4}$/.test(t)) return t;
  if (ms > 0) {
    const d = new Date(ms);
    const dd = String(d.getUTCDate()).padStart(2, "0");
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    return `${dd}.${mm}.${d.getUTCFullYear()}`;
  }
  return t || "-";
}

function yearOf(raw: string, ms: number): string {
  if (ms > 0) return String(new Date(ms).getUTCFullYear());
  const m = raw.match(/(\d{4})/);
  return m ? m[1]! : "-";
}

/** Ja «vieta» ir tikai valsts nosaukums, to rāda karoga rindā, ne kā atsevišķu faktu. */
export function lifecycleLocationIsCountryName(raw: string): boolean {
  const t = raw.trim();
  if (!t || /[,;/]/.test(t)) return false;
  return Boolean(countryLabelToIso2(t));
}

/** Fakta rinda dublē karoga valsti («Vācija» virs «🇩🇪 Vācija»). */
export function lifecycleDetailDuplicatesCountry(detail: string, country: string): boolean {
  const d = detail.trim();
  const c = country.trim();
  if (!d || !c || !lifecycleLocationIsCountryName(d)) return false;
  return normalizeCountryNameLv(d).toLowerCase() === normalizeCountryNameLv(c).toLowerCase();
}

/** Valsts paliek tikai karoga rindā; darbnīcas nosaukumu (ar «Deutschland» u.c.) neatceļ. */
function collapseCountryOnlyDetail(e: LifecycleEvent): void {
  if (e.kind === "import" || e.kind === "gap") return;
  if (!e.country && lifecycleLocationIsCountryName(e.detail)) {
    e.country = normalizeCountryNameLv(e.detail) || e.detail;
    e.detail = "";
    return;
  }
  if (lifecycleDetailDuplicatesCountry(e.detail, e.country)) e.detail = "";
}

function monthKey(ms: number): string {
  if (ms <= 0) return "";
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function sameLifecycleMonth(a: LifecycleEvent, b: LifecycleEvent): boolean {
  const ka = a.time > 0 ? monthKey(a.time) : "";
  const kb = b.time > 0 ? monthKey(b.time) : "";
  return Boolean(ka) && ka === kb;
}

function isListingLikeSource(source: string): boolean {
  const sq = source.toLowerCase().replace(/[\s._-]+/g, "");
  return /sslv|sludin|tirgusdati/.test(sq);
}

function listingSourcesCompatible(host: LifecycleEvent, odo: LifecycleEvent): boolean {
  if (host.sources.some((s) => odo.sources.includes(s))) return true;
  return host.sources.some(isListingLikeSource) && odo.sources.some(isListingLikeSource);
}

/** DD.MM.YYYY / ISO, vai MM.YYYY (→ mēneša 1. diena). 0, ja nederīgs. */
function parseLifecycleTimeMs(raw: string): number {
  const direct = parseDotOrIsoDateToMs(raw);
  if (direct > 0) return direct;
  const expanded = formatAutoRecordsDateForOutput(raw);
  if (!expanded || expanded === raw.trim()) return 0;
  const fromMonth = parseDotOrIsoDateToMs(expanded);
  return fromMonth > 0 ? fromMonth : 0;
}

function makeEvent(args: {
  kind: LifecycleEventKind;
  rawDate: string;
  title: string;
  detail?: string;
  body?: string;
  country?: string;
  odometer?: string;
  source?: string;
  tone?: LifecycleEventTone;
  countryUnverified?: boolean;
  timelineInformational?: boolean;
  nationalRegistration?: boolean;
}): LifecycleEvent {
  const ms = parseLifecycleTimeMs(args.rawDate);
  const ev: LifecycleEvent = {
    kind: args.kind,
    date: displayDate(args.rawDate, ms),
    time: ms > 0 ? ms : 0,
    year: yearOf(args.rawDate, ms),
    title: args.title,
    detail: lifecyclePublicCaption(stripEuSuffix(args.detail ?? "")),
    ...(args.body?.trim() ? { body: lifecyclePublicCaption(args.body) } : null),
    country: normalizeCountryNameLv(stripEuSuffix(args.country ?? "")) || stripEuSuffix(args.country ?? ""),
    odometer: args.odometer?.trim() ?? "",
    sources: args.source?.trim() ? [args.source.trim()] : [],
    tone: args.tone ?? "info",
    ...(args.countryUnverified ? { countryUnverified: true } : null),
    ...(args.timelineInformational ? { timelineInformational: true } : null),
    ...(args.nationalRegistration ? { nationalRegistration: true } : null),
  };
  collapseCountryOnlyDetail(ev);
  return ev;
}

/** „Vācija / Eiropas Savienība”, „Germany, EU” → „Vācija” (ES piebilde aiz valsts ir lieka). */
const EU_SUFFIX_RE = /\s*(?:\/|,|·|-)\s*(?:eiropas\s+savien[īi]ba|european\s+union|europ(?:ä|a)ische\s+union|\beu\b|\bes\b)\s*$/iu;

/** Tikai „Eiropas Savienība” / „EU” nav valsts (izsoles reģions) - valsts lauks paliek tukšs. */
const EU_ONLY_RE = /^(?:eiropas\s+savien[īi]ba|european\s+union|europ(?:ä|a)ische\s+union|eu|es|europe|eiropa)$/iu;

export function stripEuSuffix(raw: string): string {
  const t = (raw ?? "").trim();
  if (EU_ONLY_RE.test(t)) return "";
  const cut = t.replace(EU_SUFFIX_RE, "").trim();
  return cut && cut !== t ? cut : t;
}

function pushCcVinStyleHistory(
  out: LifecycleEvent[],
  ccVin: CcVinBlockState | null | undefined,
  source: string,
): void {
  for (const d of ccVin?.damages ?? []) {
    if (!ccVinDamageRowHasData(d) || !d.date.trim() || d.amount.trim()) continue;
    out.push(
      makeEvent({
        kind: "incident",
        rawDate: d.date,
        title: lifecyclePublicCaption(d.description) || "Bojājums",
        country: d.region,
        source,
        tone: "alert",
      }),
    );
  }
  for (const r of ccVin?.brands ?? []) {
    if (!ccVinRecordRowHasData(r) || !r.date.trim()) continue;
    out.push(
      makeEvent({
        kind: "registration",
        rawDate: r.date,
        title: lifecyclePublicCaption(r.label) || "Īpašumtiesību atzīme",
        detail: r.detail,
        source,
        tone: "warn",
      }),
    );
  }
  for (const r of ccVin?.insurance ?? []) {
    if (!ccVinRecordRowHasData(r) || !r.date.trim()) continue;
    out.push(
      makeEvent({
        kind: "registration",
        rawDate: r.date,
        title: lifecyclePublicCaption(r.label) || "Apdrošinātāja ieraksts",
        detail: r.detail,
        source,
        tone: "warn",
      }),
    );
  }
  for (const r of ccVin?.titles ?? []) {
    if (!ccVinTitleRowHasData(r) || !r.date.trim()) continue;
    out.push(
      makeEvent({
        kind: "registration",
        rawDate: r.date,
        title: r.region.trim()
          ? `Īpašumtiesības · ${lifecyclePublicCaption(r.region)}`
          : "Īpašumtiesību ieraksts",
        detail: lifecyclePublicCaption(r.note),
        country: r.region,
        odometer: r.odometer,
        source,
      }),
    );
  }
  for (const s of ccVin?.sales ?? []) {
    if (!ccVinSaleRowHasData(s) || !s.date.trim()) continue;
    // «Pārdots» tikai, ja avots to tieši norāda (Nils 23.11); citādi neitrāls «Izsole» / «Pārdošanas ieraksts».
    const sale = lifecycleSaleOutcome(s.status);
    const priceText = ccVinAmountToEurDisplay(s.price) || s.price.trim();
    const venueText = lifecyclePublicCaption(s.venue);
    out.push(
      makeEvent({
        kind: "sale",
        rawDate: s.date,
        title: lifecycleSaleTitle(sale, venueText),
        detail: priceText && s.priceLabel ? `${s.priceLabel} ${priceText}` : priceText,
        odometer: s.odometer,
        source,
        tone: "info",
      }),
    );
  }
}

const AUCTION_VENUE_RE = /\b(openlane|adesa|bca|auto1|autobid|copart|iaai|iaa|manheim|ecarstrade|caronsale|vwfs|ayvens|izsol)/i;

/** Pārdošanas rezultāts tikai no skaidra avota statusa. */
export function lifecycleSaleOutcome(status: string): "sold" | "unsold" | "unknown" {
  const t = status.toLowerCase();
  if (/nav\s+pārdots|nepārdots|not\s+sold|unsold|no\s+sale|nicht\s+verkauft|invendu/.test(t)) return "unsold";
  if (/(^|[^\p{L}])(pārdots|sold|verkauft|vendu|venduto|vendido)([^\p{L}]|$)/u.test(t)) return "sold";
  return "unknown";
}

export function lifecycleSaleTitle(outcome: "sold" | "unsold" | "unknown", venue: string): string {
  if (outcome === "sold") return venue ? `Pārdots · ${venue}` : "Pārdots izsolē";
  if (outcome === "unsold") return venue ? `Nav pārdots · ${venue}` : "Nepārdota izsole";
  if (!venue) return "Izsole";
  return AUCTION_VENUE_RE.test(venue) ? `Izsole · ${venue}` : `Pārdošanas ieraksts · ${venue}`;
}

/**
 * 21.11 (Nils): „Pirmā reģistrācija Somijā / Latvijā / Nīderlandē” ir valsts nacionālā reģistrācija,
 * ne auto pirmā reģistrācija vispār. Atgriež lokatīvu („Somijā”), ja teksts ir tieši šāda frāze.
 */
export function nationalFirstRegistrationLocative(description: string): string {
  const t = description.trim().replace(/[.:;]+$/, "");
  const m = t.match(/^(?:pirm\S*\s+)?reģistrācij\S*\s+(ASV|Apvienotajā\s+Karalistē|\p{L}+[āē])$/iu);
  if (!m) return "";
  const word = m[1]!;
  if (!countryIsoFromLvLocative(word)) return "";
  return word.charAt(0).toLocaleUpperCase("lv") + word.slice(1);
}

/** Pirmā reģistrācija vispār (jebkurā valstī): „Pirmā reģistrācija”, Traficom „Nodošana ekspluatācijā”, mnt.ee „Esmane registreerimine”. */
const WORLD_FIRST_REGISTRATION_RE =
  /pirm\S*\s+reģistrācij|nodošana\s+ekspluatācijā|ekspluatācijā\s+nodošana|esmane\s+registreerimine|ziņots\s+par\s+pirmo\s+reģistrāciju/i;

function classifyVendorTimelineKind(description: string): LifecycleEventKind {
  const t = description.toLowerCase();
  if (nationalFirstRegistrationLocative(description)) return "registration";
  if (WORLD_FIRST_REGISTRATION_RE.test(t)) return "first_registration";
  if (/\bimport/.test(t) && !/apskate/.test(t)) return "import";
  if (/apskate|toldsyn|periodisk syn|registreringssyn/.test(t)) return "inspection";
  if (/negadīj|bojāj/.test(t)) return "incident";
  if (isVendorTimelineListingRecord(description)) return "listed";
  if (/serviss|apkope/.test(t)) return "service";
  return "registration";
}

/** Laikposma tabulas rindas nedrīkst kļūt par importa kartīti vai sarkanu negadījumu. */
function classifyInformationalVendorTimelineKind(description: string): LifecycleEventKind {
  const kind = classifyVendorTimelineKind(description);
  if (kind === "import" || kind === "incident") return "registration";
  return kind;
}

const VENDOR_SHORT_TITLE_MAX = 32;

function vendorKindShortTitle(kind: LifecycleEventKind): string {
  switch (kind) {
    case "first_registration":
      return "Pirmā reģistrācija";
    case "inspection":
      return "Tehniskā apskate";
    case "listed":
      return "Sludinājums";
    case "service":
      return "Servisa apmeklējums";
    case "incident":
      return "Negadījums";
    case "sale":
      return "Pārdots";
    default:
      return "Ieraksts reģistrā";
  }
}

function vendorTimelineTitleAndDetail(
  description: string,
  kind: LifecycleEventKind,
): { title: string; detail: string; body?: string } {
  const raw = description.trim();
  if (kind === "inspection") {
    const split = raw.match(/^(?:veikta\s+)?(tehniskā apskate|periodiskā apskate|reģistrācijas apskate|importa apskate)\s*[:.\-]\s*(.+)$/i);
    if (split) return { title: "Tehniskā apskate", detail: split[2]!.trim() };
    if (/^(?:veikta\s+)?tehniskā apskate$/i.test(raw)) return { title: "Tehniskā apskate", detail: "" };
  }
  if (kind === "first_registration") return { title: FIRST_REGISTRATION_TITLE, detail: "" };
  const nationalLoc = nationalFirstRegistrationLocative(raw);
  if (nationalLoc) return { title: `Reģistrācija ${nationalLoc}`, detail: "" };
  if (kind === "listed") {
    if (!raw || /^sludinājums$/i.test(raw)) return { title: "Sludinājums", detail: "" };
    return { title: "Sludinājums", detail: raw };
  }
  if (!raw) return { title: vendorKindShortTitle(kind), detail: "" };
  if (raw.length <= VENDOR_SHORT_TITLE_MAX) return { title: raw, detail: "" };
  const headed = raw.match(/^(.{2,32}?)\s*[:.\-]\s+(.+)$/);
  if (headed) return { title: headed[1]!.trim(), detail: "", body: headed[2]!.trim() };
  return { title: vendorKindShortTitle(kind), detail: "", body: raw };
}

const LIFECYCLE_EXPORT_EVENT_RE = /eksport|\bexport/i;

/** Stipra rezidence: atpazīstama valsts, ne sludinājums un ne laikposma tabula. */
export function lifecycleEventProvidesCountryResidence(e: LifecycleEvent): boolean {
  if (lifecycleCountryIsSoft(e)) return false;
  // j26: eksports / izņemšana no uzskaites eksportam ir izbraukšana, ne rezidence (citādi
  // tās pašas dienas jaunās valsts reģistrācija rada viltus lēcienus FI -> SE -> FI).
  if (LIFECYCLE_EXPORT_EVENT_RE.test(`${e.title} ${e.detail} ${e.body ?? ""}`)) return false;
  return lifecycleEventKnownCountryIso(e) != null;
}

/**
 * Ķēdes solis: neatpazīta valsts (COPART, „Copart”) izlaižama, ķēde paliek.
 * Laikposma rinda ar ISO valsti tikai aizpilda tukšu ķēdi vai apstiprina to pašu ISO.
 * Maiņu ģenerē tikai stiprs notikums (nobraukums, reģistrs, negadījums).
 */
function lifecycleEventCountryChainIso(e: LifecycleEvent, prevIso: string): string | null {
  const iso = lifecycleEventKnownCountryIso(e);
  if (!iso) return null;
  if (lifecycleEventProvidesCountryResidence(e)) return iso;
  if (!prevIso || iso === prevIso) return iso;
  return null;
}

function lifecycleSourceLooksInformationalVendor(source: string): boolean {
  const t = source.trim();
  if (!t) return false;
  if (vendorTimelineIsInformational(t)) return true;
  return /carvertical|autodna|carfax/i.test(t);
}

/** CarVertical „Kanāda” pret Copart / dīlera ASV nav robežšķērsošana. */
function isDisputedUsCanadaCountryPair(
  fromIso: string,
  toIso: string,
  caSide: LifecycleEvent | null,
): boolean {
  if (!((fromIso === "US" && toIso === "CA") || (fromIso === "CA" && toIso === "US"))) return false;
  if (!caSide) return true;
  const sources = caSide.sources.filter((s) => s.trim());
  if (sources.length === 0) return true;
  return sources.every((s) => lifecycleSourceLooksInformationalVendor(s));
}

function inputHasConfirmedUsResidence(input: LifecycleInput): boolean {
  const texts: string[] = [];
  const dealer = resolveDealerAutoRecords(
    input.autoRecordsBlock,
    input.oneautoBlock,
    emptyAutoRecordsBlock(),
  );
  for (const r of dealer.serviceHistory ?? []) texts.push(r.country);
  for (const w of dealer.serviceWorks ?? []) texts.push(w.location);
  for (const r of input.asvBlock?.mileage ?? []) texts.push(r.country);
  for (const r of input.asvBlock?.sales ?? []) texts.push(r.venue);
  for (const r of input.asvBlock?.damages ?? []) texts.push(r.region);
  for (const r of input.ccVinBlock?.mileage ?? []) texts.push(r.country);
  return texts.some((t) => countryLabelToIso2(t) === "US");
}

function vendorCanadaDisputedAgainstUs(
  country: string,
  sourceLabels: string[],
  confirmedUs: boolean,
): boolean {
  if (!confirmedUs || countryLabelToIso2(country) !== "CA") return false;
  const labels = sourceLabels.filter((s) => s.trim());
  if (labels.length === 0) return true;
  return labels.every((s) => lifecycleSourceLooksInformationalVendor(s));
}

function listingHintKey(date: string, country: string, odometer?: string): string[] {
  const ms = parseLifecycleTimeMs(date);
  const c = normalizeCountryNameLv(country) || country.trim();
  const km = (odometer ?? "").replace(/\D/g, "");
  const keys: string[] = [];
  if (ms > 0 && c) keys.push(`m:${monthKey(ms)}|${c}`);
  if (ms > 0 && km) keys.push(`k:${ms}|${km}`);
  if (date.trim() && c) keys.push(`d:${date.trim()}|${c}`);
  return keys;
}

function collectVendorListingHintKeys(input: LifecycleInput): Set<string> {
  const keys = new Set<string>();
  const add = (date: string, country: string, odometer?: string) => {
    for (const k of listingHintKey(date, country, odometer)) keys.add(k);
  };
  for (const b of input.manualVendorBlocks ?? []) {
    for (const hint of b.listingCountryHints ?? []) {
      add(hint.date, hint.country, hint.odometer);
    }
    for (const t of b.vehicleHistoryTimeline ?? []) {
      if (!isVendorTimelineListingRecord(t.description)) continue;
      add(t.date, t.country, t.odometer);
    }
  }
  return keys;
}

function odometerMatchesVendorListing(
  listingKeys: Set<string>,
  date: string,
  country: string,
  odometer: string,
): boolean {
  if (listingKeys.size === 0) return false;
  return listingHintKey(date, country, odometer).some((k) => listingKeys.has(k));
}

function collectFactEvents(input: LifecycleInput): LifecycleEvent[] {
  const out: LifecycleEvent[] = [];
  const csdd = input.csddForm;

  const firstLvOwner =
    ownerFirstRegistrationInLatvia(csdd?.ownerRegistrationEvents) ??
    (csdd?.ownerRegistrationEvents ?? []).find(
      (e) => e.date.trim() && /pirmā\s+reģistrācija/i.test(e.label),
    );
  const firstLvDate = (csdd?.firstRegistrationLatvia.trim() || firstLvOwner?.date || "").trim();
  const firstRegDate = csdd?.firstRegistration.trim() ?? "";
  const firstRegMs = firstRegDate ? parseLifecycleTimeMs(firstRegDate) : 0;
  const firstLvMs = firstLvDate ? parseLifecycleTimeMs(firstLvDate) : 0;
  const firstRegDuplicatesFirstLv =
    firstRegMs > 0 && firstLvMs > 0 && eventDayKeyFromMs(firstRegMs) === eventDayKeyFromMs(firstLvMs);

  // 21.11 (Nils): „Pirmā reģistrācija” ir tikai viena - agrākā jebkurā valstī. Pirmā reģistrācija Latvijā
  // ir tāda tikai, ja tā sakrīt ar pirmo reģistrāciju vai auto nav bijis citur; citādi „Reģistrācija Latvijā”.
  const prevIso = countryLabelToIso2(csdd?.previousRegistrationCountry ?? "");
  const lvIsNational =
    (firstRegMs > 0 && !firstRegDuplicatesFirstLv) || Boolean(prevIso && prevIso !== "LV");
  const csddLvEvent = (rawDate: string): LifecycleEvent =>
    makeEvent({
      kind: lvIsNational ? "registration" : "first_registration",
      rawDate,
      title: lvIsNational ? "Reģistrācija Latvijā" : FIRST_REGISTRATION_TITLE,
      country: "Latvija",
      source: "CSDD",
      ...(lvIsNational ? { nationalRegistration: true } : null),
    });

  if (firstRegDate && !firstRegDuplicatesFirstLv) {
    out.push(
      makeEvent({
        kind: "first_registration",
        rawDate: firstRegDate,
        title: FIRST_REGISTRATION_TITLE,
        country: "",
        source: "CSDD",
      }),
    );
  }

  if (firstLvDate && !firstLvOwner) out.push(csddLvEvent(firstLvDate));

  let lvOwner = 0;
  for (const e of csdd?.ownerRegistrationEvents ?? []) {
    if (!e.date.trim()) continue;
    lvOwner += 1;
    const raw = e.label.trim();
    const firstLv = isCsddFirstRegistrationInLatviaLabel(raw) || /pirmā\s+reģistrācija/i.test(raw);
    if (firstLv) {
      out.push(csddLvEvent(e.date));
      continue;
    }
    out.push(
      makeEvent({
        kind: "registration",
        rawDate: e.date,
        title: "Īpašnieka maiņa",
        detail: `${lvOwner}. īpašnieks Latvijā`,
        country: "Latvija",
        source: "CSDD",
      }),
    );
  }

  for (const r of csdd?.technicalInspectionHistory ?? []) {
    if (!r.date.trim()) continue;
    const failed = r.ratingLevel != null && r.ratingLevel > 1;
    const sameDayKm = (csdd?.mileageHistory ?? []).find((m) => {
      if (!m.date.trim() || !m.odometer.trim()) return false;
      const a = parseLifecycleTimeMs(m.date);
      const b = parseLifecycleTimeMs(r.date);
      if (a <= 0 || b <= 0) return false;
      const da = new Date(a);
      const db = new Date(b);
      return (
        da.getUTCFullYear() === db.getUTCFullYear() &&
        da.getUTCMonth() === db.getUTCMonth() &&
        da.getUTCDate() === db.getUTCDate()
      );
    });
    out.push(
      makeEvent({
        kind: "inspection",
        rawDate: r.date,
        title: "Tehniskā apskate",
        detail: r.ratingLabel.trim(),
        country: "Latvija",
        odometer: sameDayKm?.odometer ?? "",
        source: "CSDD",
        tone: failed ? "warn" : "info",
      }),
    );
  }

  const dealer = resolveDealerAutoRecords(
    input.autoRecordsBlock,
    input.oneautoBlock,
    emptyAutoRecordsBlock(),
  );
  for (const w of (dealer.serviceWorks ?? []).filter(autoRecordsServiceWorkRowIsPrintable)) {
    const loc = lifecyclePublicCaption(w.location);
    const locIsCountry = lifecycleLocationIsCountryName(loc);
    out.push(
      makeEvent({
        kind: "service",
        rawDate: w.date,
        // Tas pats veids kā dīlera sadaļā (`classifyDealerVisitKinds`) - viena vizīte, viens nosaukums.
        title: dealerVisitTimelineTitle(w.works),
        // Darbu saraksts paliek dīlera sadaļā; kopsavilkumā - tikai vieta (ne valsts dublikāts).
        detail: locIsCountry ? "" : loc,
        country: locIsCountry ? loc : "",
        odometer: w.odometer,
        // Tas pats avota nosaukums kā nobraukuma rindām → PDF „Dīlera dati” (ne pelēkais „Citi avoti”).
        source: SOURCE_BLOCK_LABELS.auto_records,
      }),
    );
  }

  for (const b of input.manualVendorBlocks ?? []) {
    const informational = vendorTimelineIsInformational(b.title);
    const estonian = b.title === SOURCE_BLOCK_LABELS.mnt_ee || b.title === SOURCE_BLOCK_LABELS.lkf_ee;
    for (const t of b.vehicleHistoryTimeline ?? []) {
      if (t.includeInPdf === false) continue;
      if (!t.date.trim() && !t.description.trim()) continue;
      // Vecajos melnrakstos Igaunijas notikumi var būt netulkoti („Majanduslikus mõttes hävinenud”).
      const translated = estonian
        ? capitalizeRegistryEvent(translateTextLv(t.description, "et")) || t.description
        : t.description;
      // Reģistra hronoloģijā personu vārdi pēc lomas („Pirmais īpašnieks: …”) PDF nenonāk.
      const description = informational ? translated : stripRegistryPersonNames(translated);
      // Īpašnieku maiņas veido `collectForeignOwnerChangeEvents` (Latvija tikai CSDD, dedup starp avotiem).
      if (isOwnerChangeDescription(description)) continue;
      const kind = informational
        ? classifyInformationalVendorTimelineKind(description)
        : classifyVendorTimelineKind(description);
      const { title, detail, body } = vendorTimelineTitleAndDetail(description, kind);
      const nationalIso = countryIsoFromLvLocative(nationalFirstRegistrationLocative(description));
      const failedInspection =
        kind === "inspection" && /neizturēt|nav\s+izturēt|ikke godkendt|omsyn|betinget/i.test(`${title} ${detail} ${body ?? ""} ${t.description}`);
      out.push(
        makeEvent({
          kind,
          rawDate: t.date,
          title,
          detail,
          body,
          country: t.country.trim() || (nationalIso ? iso2ToLvDisplayName(nationalIso) : ""),
          odometer: t.odometer,
          source: b.title,
          tone: informational ? "info" : failedInspection ? "warn" : kind === "incident" ? "alert" : "info",
          // Tirgus sludinājums (ss.lv) paliek countryUnverified ar piezīmi.
          // Laikposma tabulas rindas ir tāds pats zemais svars, bet bez „nav apstiprināts”.
          countryUnverified: !informational && kind === "listed" && Boolean(t.country.trim()),
          timelineInformational: informational,
          // Tikai „Pirmā reģistrācija <valstī>”: drīkst kļūt par pirmo reģistrāciju, ja agrākas nav.
          nationalRegistration:
            /^\s*pirm/i.test(description) && Boolean(nationalFirstRegistrationLocative(description)),
        }),
      );
    }
  }

  const incidents = aggregateUnifiedIncidents(
    collectUnifiedIncidentRows({
      manualVendorBlocks: input.manualVendorBlocks ?? null,
      manualLtabBlock: input.manualLtabBlock ?? null,
      ccVinBlock: input.ccVinBlock ?? null,
      asvBlock: input.asvBlock ?? null,
    }),
    collectUnifiedIncidentDamageDetails(input.manualVendorBlocks ?? null),
  );
  for (const c of incidents.clusters) {
    const ev = makeEvent({
      kind: "incident",
      rawDate: c.date,
      title: c.kindLabel,
      detail: "",
      country: c.country,
      tone: "alert",
    });
    // Klastera displeja datums var būt MM.YYYY, ja avoti nesakrīt dienā - kārtošanai ņem precīzāko locekli.
    if (c.sortableTime > 0 && Number.isFinite(c.sortableTime)) {
      ev.time = c.sortableTime;
      ev.year = yearOf(c.date, c.sortableTime);
    }
    ev.sources = c.sourceValuations.map((s) => s.sourceLabel);
    ev.incident = c;
    out.push(ev);
  }

  const ccVin = input.ccVinBlock;
  pushCcVinStyleHistory(out, ccVin, CC_VIN_PDF_SOURCE_LABEL);
  const asvView = asvBlockToCcVinView(input.asvBlock);
  pushCcVinStyleHistory(out, asvView, ASV_PDF_SOURCE_LABEL);
  for (const r of input.asvBlock?.liens ?? []) {
    if (!asvRecordRowHasData(r) || !r.date.trim()) continue;
    out.push(
      makeEvent({
        kind: "registration",
        rawDate: r.date,
        title: lifecyclePublicCaption(r.label) || "Ķīla / aizturēšana",
        detail: r.detail,
        source: ASV_PDF_SOURCE_LABEL,
        tone: "warn",
      }),
    );
  }
  for (const r of input.asvBlock?.thefts ?? []) {
    if (!asvRecordRowHasData(r) || !r.date.trim()) continue;
    out.push(
      makeEvent({
        kind: "incident",
        rawDate: r.date,
        title: lifecyclePublicCaption(r.label) || "Zādzība",
        detail: r.detail,
        source: ASV_PDF_SOURCE_LABEL,
        tone: "alert",
      }),
    );
  }

  const listingPoints = collectListingPriceLifecyclePoints({
    priceHistory: input.tirgusForm?.priceHistory,
    listingCreated: input.tirgusForm?.listingCreated,
  });
  // Sludinājuma notikumi vienmēr rāda sludinājuma paša tirdzniecības valsti (piem. ss.lv → Latvija),
  // nevis paļaujas uz vēlāku apvienošanu ar kādu citu (bieži vecāku/citas valsts) odometra ierakstu.
  // Pārdevējs bieži sāk tirgot mērķa valstī, vēl pirms auto tur formāli reģistrēts — tas nav apstiprināts
  // fakts par auto atrašanās vietu, tāpēc paliek `countryUnverified` un neietekmē robežšķērsošanas atvasināšanu.
  const listingCountry = resolveListingCountry(input.tirgusForm, input.listingUrl);
  if (listingPoints.length > 0) {
    for (const point of listingPoints) {
      const ev = makeEvent({
        kind: "listed",
        rawDate: point.date,
        title: point.delta === 0 ? "Sludinājums" : "Sludinājuma cenas izmaiņa",
        detail: formatListingPriceEur(point.price),
        odometer: formatListingOdometerKm(point.mileageKm),
        country: listingCountry,
        countryUnverified: Boolean(listingCountry),
        source: "Sludinājums",
      });
      ev.priceDelta = point.delta;
      out.push(ev);
    }
  } else {
    const listingCreated = input.tirgusForm?.listingCreated?.trim();
    if (listingCreated) {
      out.push(
        makeEvent({
          kind: "listed",
          rawDate: listingCreated,
          title: "Izlikts pārdošanā",
          detail: "Sludinājuma izveides datums",
          country: listingCountry,
          countryUnverified: Boolean(listingCountry),
          source: "Sludinājums",
        }),
      );
    }
  }

  return out;
}

const REGISTRY_DEFAULT_COUNTRY: Record<string, string> = {
  [SOURCE_BLOCK_LABELS.finnik]: "Nīderlande",
  [SOURCE_BLOCK_LABELS.traficom_fi]: "Somija",
  [SOURCE_BLOCK_LABELS.mnt_ee]: "Igaunija",
  [SOURCE_BLOCK_LABELS.carinfo]: "Zviedrija",
  [SOURCE_BLOCK_LABELS.tjekbil]: "Dānija",
};

const DMY_RE = /\b(\d{1,2}\.\d{1,2}\.\d{4})\b/g;
const OWNER_PERIOD_LINE_RE = /^\s*(\d{1,2}\.\d{1,2}\.\d{4})\s*-\s*(?:\d{1,2}\.\d{1,2}\.\d{4}|šobrīd|tagad)/iu;

type OwnerChangeCandidate = {
  time: number;
  rawDate: string;
  iso: string;
  country: string;
  sources: string[];
  registry: boolean;
  /** CarVertical dod tikai mēnesi un gadu. */
  monthPrecision: boolean;
  odometer: string;
  /** Īpašnieku numuri šajā dienā pilnajā reģistra sarakstā (divi īpašnieki vienā dienā → [2, 3]). */
  ordinals?: number[];
};

function monthStartMs(ms: number): number {
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
}

function monthYearLabel(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getUTCMonth() + 1).padStart(2, "0")}.${d.getUTCFullYear()}`;
}

function isCarVerticalSource(source: string): boolean {
  return /carvertical/i.test(source);
}

/** „1. īpašnieks”, „2. un 3. īpašnieks” + lokatīvs. */
function ownerOrdinalDetail(ordinals: number[] | undefined, country: string): string {
  if (!ordinals || ordinals.length === 0) return "";
  const loc = countryNameLvLocative(country);
  if (!loc) return "";
  const nums = [...new Set(ordinals)].sort((a, b) => a - b);
  const head = nums.length === 1 ? `${nums[0]}.` : `${nums.slice(0, -1).map((n) => `${n}.`).join(", ")} un ${nums[nums.length - 1]}.`;
  return `${head} īpašnieks ${loc}`;
}

/** „6 īpašnieku maiņas Somijā”; 21, 31 … → „īpašnieka maiņa”. */
export function ownerChangeCountTitleLv(n: number, country: string): string {
  const loc = countryNameLvLocative(country) || country;
  const singular = n % 10 === 1 && n % 100 !== 11;
  return `${n} ${singular ? "īpašnieka maiņa" : "īpašnieku maiņas"} ${loc}`;
}

/**
 * Īpašnieku maiņas ārvalstīs kā patstāvīgas kartītes (tāds pats stils kā CSDD „Īpašnieka maiņa”). 21.11 (Nils):
 * - Latvija: tikai CSDD. Citu avotu rindas ar Latviju vai Latvijas periodā neņem.
 * - Reģistrs (finnik, Traficom, mnt.ee, car.info) dominē: ja valstij ir reģistra dati, AutoDNA/CarVertical tai neņem.
 * - AutoDNA/CarVertical tikai rindas ar admin ķeksi „iekļaut PDF”.
 * - Reģistrācijas mēnesī šajā valstī tas ir 1. īpašnieks (reģistrācijas kartīte), ne maiņa.
 * - Viena mēneša dublikāti starp avotiem apvienoti; dienas datums (AutoDNA, reģistrs) uzvar CarVertical mēnesi.
 * - Valstī tikai CarVertical (bez reģistra un AutoDNA) un vairāk nekā viena maiņa → viena kopkartīte.
 * - „N. īpašnieks <valstī>” tikai no pilna reģistra īpašnieku saraksta (finnik periodi / „Īpašnieks” rindas).
 * - AutoDNA „Transportlīdzekļa pārreģistrācija” nav īpašnieka maiņa (var būt numura / apliecības maiņa).
 */
function collectForeignOwnerChangeEvents(input: LifecycleInput, facts: LifecycleEvent[]): LifecycleEvent[] {
  const csdd = input.csddForm;
  const firstLvOwner =
    ownerFirstRegistrationInLatvia(csdd?.ownerRegistrationEvents) ??
    (csdd?.ownerRegistrationEvents ?? []).find((e) => e.date.trim() && /pirmā\s+reģistrācija/i.test(e.label));
  const lvStartRaw = (csdd?.firstRegistrationLatvia?.trim() || firstLvOwner?.date || "").trim();
  const lvStartMs = lvStartRaw ? parseLifecycleTimeMs(lvStartRaw) : 0;

  const registeredMonths = new Set<string>();
  const markRegistered = (country: string, ms: number) => {
    if (ms <= 0) return;
    registeredMonths.add(`${countryLabelToIso2(country) ?? "*"}|${monthKey(ms)}`);
  };
  for (const f of facts) {
    if (f.kind === "first_registration" || f.nationalRegistration) markRegistered(f.country, f.time);
  }
  if (csdd?.firstRegistration?.trim()) markRegistered("", parseLifecycleTimeMs(csdd.firstRegistration));

  const registry: OwnerChangeCandidate[] = [];
  const vendor: OwnerChangeCandidate[] = [];
  for (const b of input.manualVendorBlocks ?? []) {
    const informational = vendorTimelineIsInformational(b.title);
    const isVendor = /autodna|carvertical|carfax/i.test(b.title);
    if (informational && !isVendor) continue;
    const defaultCountry = REGISTRY_DEFAULT_COUNTRY[b.title] ?? "";
    const estonian = b.title === SOURCE_BLOCK_LABELS.mnt_ee || b.title === SOURCE_BLOCK_LABELS.lkf_ee;
    const ownerList: number[] = [];
    const push = (rawDate: string, country: string, odometer: string, listEntry: boolean) => {
      const ms = parseLifecycleTimeMs(rawDate);
      if (ms <= 0) return;
      const label = normalizeCountryNameLv(country) || country.trim();
      const iso = countryLabelToIso2(label);
      if (!iso) return;
      (informational ? vendor : registry).push({
        time: ms,
        rawDate,
        iso,
        country: iso2ToLvDisplayName(iso) || label,
        sources: [b.title],
        registry: !informational,
        monthPrecision: isCarVerticalSource(b.title),
        odometer,
      });
      if (listEntry) ownerList.push(ms);
    };
    // „Reģistrēts” rindas arī ar izslēgtu ķeksi - tikai reģistrācijas mēneša noteikšanai (nerāda).
    for (const h of b.ownerChangeHints ?? []) {
      if (VENDOR_REGISTERED_RE.test(h.description.trim())) markRegistered(h.country, parseLifecycleTimeMs(h.date));
    }
    for (const t of b.vehicleHistoryTimeline ?? []) {
      const raw = estonian ? capitalizeRegistryEvent(translateTextLv(t.description, "et")) || t.description : t.description;
      const description = stripRegistryPersonNames(raw).trim();
      if (VENDOR_REGISTERED_RE.test(description)) {
        markRegistered(t.country || defaultCountry, parseLifecycleTimeMs(t.date));
        continue;
      }
      // Admin ķeksis „iekļaut PDF” izslēgts → īpašnieka maiņu nerāda (Nils 21.11, A).
      if (t.includeInPdf === false || !isOwnerChangeDescription(description)) continue;
      push(
        t.date,
        t.country || defaultCountry,
        informational ? "" : (t.odometer ?? ""),
        !informational && OWNER_LIST_ENTRY_RE.test(description),
      );
    }
    if (informational) continue;
    // Reģistra īsie fakti: finnik periodi „11.05.2016-18.05.2016 …”, car.info / mnt.ee „… maiņa … 11.12.2024 un 04.08.2025”.
    const periods: number[] = [];
    for (const line of (b.ownersSummary ?? "").split("\n")) {
      const period = OWNER_PERIOD_LINE_RE.exec(line);
      if (period) {
        const ms = parseLifecycleTimeMs(period[1]!);
        if (ms > 0) periods.push(ms);
        continue;
      }
      if (!/maiņ|ägarbyte/iu.test(line)) continue;
      for (const m of line.matchAll(DMY_RE)) push(m[1]!, defaultCountry, "", false);
    }
    for (const ms of periods) {
      const day = eventDayKeyFromMs(ms);
      if (!registry.some((c) => c.sources.includes(b.title) && eventDayKeyFromMs(c.time) === day)) {
        push(displayDate("", ms), defaultCountry, "", true);
      }
    }
    // Periodu sākumi = pilns īpašnieku saraksts (ar vienas dienas īpašniekiem), citādi „Īpašnieks” rindas.
    const list = (periods.length > 0 ? periods : ownerList).slice().sort((x, y) => x - y);
    if (list.length === 0) continue;
    for (const c of registry) {
      if (!c.sources.includes(b.title)) continue;
      const day = eventDayKeyFromMs(c.time);
      const ordinals = list.flatMap((ms, i) => (eventDayKeyFromMs(ms) === day ? [i + 1] : []));
      if (ordinals.length > 0) c.ordinals = ordinals;
    }
  }

  const registryIsos = new Set(registry.map((c) => c.iso));
  const kept: OwnerChangeCandidate[] = [];
  const all = [...registry, ...vendor].sort(
    (a, b) => a.time - b.time || Number(a.monthPrecision) - Number(b.monthPrecision),
  );
  for (const c of all) {
    if (c.iso === "LV") continue;
    if (!c.registry && registryIsos.has(c.iso)) continue;
    if (!c.registry && lvStartMs > 0 && monthStartMs(c.time) >= monthStartMs(lvStartMs)) continue;
    const mk = monthKey(c.time);
    if (registeredMonths.has(`${c.iso}|${mk}`) || registeredMonths.has(`*|${mk}`)) continue;
    const host =
      kept.find((k) => k.iso === c.iso && eventDayKeyFromMs(k.time) === eventDayKeyFromMs(c.time)) ??
      kept.find((k) => k.iso === c.iso && monthKey(k.time) === mk && (k.monthPrecision || c.monthPrecision));
    if (host) {
      for (const s of c.sources) if (!host.sources.includes(s)) host.sources.push(s);
      if (host.monthPrecision && !c.monthPrecision) {
        host.time = c.time;
        host.rawDate = c.rawDate;
        host.monthPrecision = false;
      }
      if (c.ordinals) host.ordinals = [...new Set([...(host.ordinals ?? []), ...c.ordinals])];
      if (!host.odometer && c.odometer) host.odometer = c.odometer;
      continue;
    }
    kept.push({ ...c, sources: [...c.sources] });
  }

  const out: LifecycleEvent[] = [];
  const byIso = new Map<string, OwnerChangeCandidate[]>();
  for (const c of kept) byIso.set(c.iso, [...(byIso.get(c.iso) ?? []), c]);
  for (const list of byIso.values()) {
    const cvOnly = list.every((c) => c.sources.every(isCarVerticalSource));
    if (cvOnly && list.length > 1) {
      const first = list[0]!;
      const last = list[list.length - 1]!;
      const ev = makeEvent({
        kind: "owner_change",
        rawDate: monthYearLabel(first.time),
        title: ownerChangeCountTitleLv(list.length, first.country),
        detail: `${monthYearLabel(first.time)}-${monthYearLabel(last.time)} (carVertical)`,
        country: first.country,
        timelineInformational: true,
      });
      ev.sources = [...first.sources];
      out.push(ev);
      continue;
    }
    for (const c of list) {
      const ev = makeEvent({
        kind: "owner_change",
        rawDate: c.monthPrecision ? monthYearLabel(c.time) : c.rawDate,
        title: "Īpašnieka maiņa",
        detail: ownerOrdinalDetail(c.ordinals, c.country),
        country: c.country,
        odometer: c.odometer,
        timelineInformational: !c.registry,
      });
      ev.sources = c.sources;
      out.push(ev);
    }
  }
  return out;
}

function collectOdometerEvents(input: LifecycleInput): LifecycleEvent[] {
  const rows = prepareUnifiedMileageDisplayRows(
    collectUnifiedMileageRows({
      csddForm: input.csddForm ?? undefined,
      autoRecordsBlock: input.autoRecordsBlock ?? undefined,
      oneautoBlock: input.oneautoBlock ?? undefined,
      ccVinBlock: input.ccVinBlock ?? null,
      asvBlock: input.asvBlock ?? null,
      manualVendorBlocks: input.manualVendorBlocks ?? undefined,
      citiAvotiBlock: input.citiAvoti ?? null,
      tirgusForm: input.tirgusForm ?? null,
      listingUrl: input.listingUrl ?? null,
    }),
  );
  if (rows.length === 0) return [];
  const { anomalyBySourceOrder, staleDocumentSourceOrders, dataEntryErrorSourceOrders, listingBelowRecordedSourceOrders } =
    analyzeUnifiedMileageAnomalies(rows);
  const listingKeys = collectVendorListingHintKeys(input);
  const confirmedUs = inputHasConfirmedUsResidence(input);
  return rows.flatMap((r) => {
    if (staleDocumentSourceOrders.has(r.sourceOrder) || dataEntryErrorSourceOrders.has(r.sourceOrder)) {
      return [];
    }
    const anomaly = anomalyBySourceOrder.get(r.sourceOrder) === true;
    // 17.11 (Nils B2): sludinājumā mazāk nekā iepriekš fiksēts - atsevišķs brīdinājums, ne odometra pretruna.
    const listingBelow = listingBelowRecordedSourceOrders.has(r.sourceOrder);
    // A8 (Business audits 23.11): ja to pašu km apstiprina dīleris / CSDD, tas nav «pēc sludinājuma» rādījums -
    // citādi tas paliek atsevišķs «Odometra ieraksts» blakus tās pašas dienas dīlera vizītei.
    const listingCountry =
      !isVerifiedMileageSource(r) && odometerMatchesVendorListing(listingKeys, r.date, r.country, r.odometer);
    const vendorCaDisputed = vendorCanadaDisputedAgainstUs(
      r.country,
      r.sourceLabels.length > 0 ? r.sourceLabels : [r.sourceLabel],
      confirmedUs,
    );
    const ev = makeEvent({
      kind: anomaly || listingBelow ? "anomaly" : "odometer",
      rawDate: r.date,
      title: anomaly
        ? "Iespējama odometra pretruna"
        : listingBelow
          ? "Sludinājumā norādīts mazāks nobraukums"
          : "Odometra ieraksts",
      country: r.country,
      odometer: r.odometer,
      tone: anomaly ? "alert" : listingBelow ? "warn" : "info",
      countryUnverified: r.countryUnverified === true || listingCountry || vendorCaDisputed,
    });
    ev.sources = r.sourceLabels.length > 0 ? [...r.sourceLabels] : [r.sourceLabel || "Nezināms avots"];
    return [ev];
  });
}

function eventDayKeyFromMs(ms: number): string {
  if (ms <= 0) return "";
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function sameLifecycleDay(a: LifecycleEvent, b: LifecycleEvent): boolean {
  const ka = eventDayKey(a);
  const kb = eventDayKey(b);
  return Boolean(ka) && ka === kb;
}

function odometerHostOwnsReading(host: LifecycleEvent, odo: LifecycleEvent): boolean {
  if (host.kind === "odometer") return false;
  // ss.lv / sludinājuma km paliek uz sludinājuma kartes tajā pašā dienā, ne uz Citi avoti.
  if (lifecycleCountryIsSoft(odo)) {
    return host.kind === "listed" && sameLifecycleDay(host, odo) && listingSourcesCompatible(host, odo);
  }
  if (host.kind === "listed" || host.timelineInformational) return false;
  // Īpašnieka maiņai km tikai no tās pašas dienas - mēneša tuvākais rādījums nav maiņas brīža km.
  if (host.kind === "owner_change") return sameLifecycleDay(host, odo);
  if (sameLifecycleDay(host, odo)) return true;
  return sameLifecycleMonth(host, odo);
}

/**
 * Odometra km pieķeras tikai tai pašai dienai un tam notikumam, kam km pieder.
 * Mēneša „tuvākā rinda” (tukšs Citi avoti, cenas izmaiņa) km nedrīkst pārmantot.
 */
function mergeOdometerIntoFacts(facts: LifecycleEvent[], odo: LifecycleEvent[]): LifecycleEvent[] {
  const byDay = new Map<string, LifecycleEvent[]>();
  const byMonth = new Map<string, LifecycleEvent[]>();
  for (const f of facts) {
    const day = eventDayKey(f);
    if (day) byDay.set(day, [...(byDay.get(day) ?? []), f]);
    const month = f.time > 0 ? monthKey(f.time) : "";
    if (month) byMonth.set(month, [...(byMonth.get(month) ?? []), f]);
  }
  const kept: LifecycleEvent[] = [];
  for (const o of odo) {
    const dayHosts = byDay.get(eventDayKey(o)) ?? [];
    const monthHosts = o.time > 0 ? (byMonth.get(monthKey(o.time)) ?? []) : [];
    const host =
      dayHosts.find((h) => odometerHostOwnsReading(h, o)) ??
      monthHosts.find((h) => odometerHostOwnsReading(h, o));
    if (o.kind === "anomaly" || !host) {
      kept.push(o);
      continue;
    }
    if (o.detail && !host.detail.includes(o.detail)) {
      host.detail = [host.detail, o.detail].filter(Boolean).join(". ");
    }
    // CSDD TA jau ir piesaistīts tā paša datuma CSDD km - neaizstāt ar cita datuma mēneša rādījumu.
    if (!host.odometer && o.odometer) host.odometer = o.odometer;
    // Reģistrs pats nezina pirmās reģistrācijas valsti (tjekbil „ārzemēs”) - tā paša reģistra km rindas
    // noklusētā valsts to nedrīkst izdomāt. Neatpazīta valsts („Nezināmā”) arī nav valsts.
    const firstRegCountryBlocked =
      host.kind === "first_registration" &&
      !host.country &&
      (!countryLabelToIso2(o.country) || o.sources.some((s) => host.sources.includes(s)));
    if (firstRegCountryBlocked) {
      // valsti neņem; avoti un km paliek
    } else if (!host.country && o.country) {
      host.country = o.country;
      if (o.countryUnverified) host.countryUnverified = true;
      if (o.timelineInformational) host.timelineInformational = true;
    } else if (host.country === o.country && !lifecycleCountryIsSoft(o)) {
      // Apstiprināts nolasījums no cita avota pierāda to pašu valsti - vairs nav pieņēmums.
      host.countryUnverified = false;
      host.timelineInformational = false;
    }
    for (const s of o.sources) if (!host.sources.includes(s)) host.sources.push(s);
    collapseCountryOnlyDetail(host);
  }
  return [...facts, ...kept];
}

function isCsddLatviaOwnerChange(e: LifecycleEvent): boolean {
  return (
    e.kind === "registration" &&
    e.title === "Īpašnieka maiņa" &&
    e.sources.includes("CSDD") &&
    /īpašnieks Latvijā/.test(e.detail)
  );
}

function dedupeSameEvents(events: LifecycleEvent[]): LifecycleEvent[] {
  const byKey = new Map<string, LifecycleEvent>();
  const out: LifecycleEvent[] = [];
  for (const e of events) {
    // Īpašnieku maiņas jau apvienotas; divas maiņas vienā mēnesī (07.07 un 27.07) ir divi notikumi.
    if (e.kind === "owner_change") {
      out.push(e);
      continue;
    }
    const key = `${monthKey(e.time) || e.date}|${e.kind}|${e.title.toLowerCase()}|${e.country.toLowerCase()}`;
    const prev = byKey.get(key);
    // CSDD īpašnieka maiņas ir ar dienas precizitāti: divas maiņas vienā mēnesī (09.12 un 16.12) ir divi
    // īpašnieki - citādi numerācija lec no 7. uz 9.
    if (prev && isCsddLatviaOwnerChange(prev) && isCsddLatviaOwnerChange(e) && eventDayKey(prev) !== eventDayKey(e)) {
      const dayKey = `${eventDayKey(e)}|${key}`;
      if (!byKey.has(dayKey)) {
        byKey.set(dayKey, e);
        out.push(e);
      }
      continue;
    }
    if (!prev) {
      byKey.set(key, e);
      out.push(e);
      continue;
    }
    if (!prev.odometer && e.odometer) prev.odometer = e.odometer;
    if (!prev.country && e.country) {
      prev.country = e.country;
      if (e.countryUnverified) prev.countryUnverified = true;
      if (e.timelineInformational) prev.timelineInformational = true;
    } else if (prev.country && prev.country === e.country && !lifecycleCountryIsSoft(e)) {
      // Apstiprināts nolasījums no cita avota pierāda to pašu valsti - vairs nav pieņēmums.
      // Tā nekad nedrīkst palikt "(pēc sludinājuma, nav apstiprināts)" kopā ar oficiālu avotu punktu.
      prev.countryUnverified = false;
      prev.timelineInformational = false;
    }
    if (!prev.detail && e.detail) prev.detail = e.detail;
    if (!prev.body && e.body) prev.body = e.body;
    for (const s of e.sources) if (!prev.sources.includes(s)) prev.sources.push(s);
    collapseCountryOnlyDetail(prev);
  }
  return out;
}

function eventDayKey(e: LifecycleEvent): string {
  if (e.time > 0) return eventDayKeyFromMs(e.time);
  return e.date.trim();
}

function csddFirstRegistrationInLatvia(e: LifecycleEvent): boolean {
  return (
    (e.kind === "first_registration" || e.nationalRegistration === true) &&
    e.sources.includes("CSDD") &&
    e.country === "Latvija"
  );
}

function preferMergedCountry(a: LifecycleEvent, b: LifecycleEvent): string {
  const softA = lifecycleCountryIsSoft(a);
  const softB = lifecycleCountryIsSoft(b);
  if (!softA && softB && a.country) return a.country;
  if (!softB && softA && b.country) return b.country;
  const isoA = countryLabelToIso2(a.country);
  const isoB = countryLabelToIso2(b.country);
  if (isoA === "US" && isoB === "CA") return normalizeCountryNameLv(a.country) || "ASV";
  if (isoB === "US" && isoA === "CA") return normalizeCountryNameLv(b.country) || "ASV";
  return a.country || b.country;
}

/**
 * Tas pats datums un veids no dažādiem avotiem, atšķiras tikai valsts (CarVertical „Kanāda”
 * pret Copart Luiziānu) → viena rinda ar piezīmi, ne divas kartītes un ne robežšķērsošana.
 */
function mergeSameDateTypeCountryDisagreement(events: LifecycleEvent[]): LifecycleEvent[] {
  const out: LifecycleEvent[] = [];
  const byKey = new Map<string, LifecycleEvent>();
  for (const e of events) {
    if (e.kind === "import" || e.kind === "gap" || e.kind === "owner_change") {
      out.push(e);
      continue;
    }
    const key = `${eventDayKey(e)}|${e.kind}|${e.title.toLowerCase()}`;
    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, e);
      out.push(e);
      continue;
    }
    const sameCountry =
      normalizeCountryNameLv(prev.country).toLowerCase() === normalizeCountryNameLv(e.country).toLowerCase();
    if (sameCountry || !prev.country || !e.country) {
      if (!prev.odometer && e.odometer) prev.odometer = e.odometer;
      if (!prev.detail && e.detail) prev.detail = e.detail;
      if (!prev.body && e.body) prev.body = e.body;
      for (const s of e.sources) if (!prev.sources.includes(s)) prev.sources.push(s);
      continue;
    }
    const note = `Avoti atšķiras valstī: ${prev.country} / ${e.country}`;
    if (!prev.detail.includes(note)) {
      prev.detail = [prev.detail, note].filter(Boolean).join(". ");
    }
    prev.country = preferMergedCountry(prev, e);
    if (!prev.odometer && e.odometer) prev.odometer = e.odometer;
    for (const s of e.sources) if (!prev.sources.includes(s)) prev.sources.push(s);
    if (!lifecycleCountryIsSoft(e)) {
      prev.countryUnverified = false;
      prev.timelineInformational = false;
    }
    collapseCountryOnlyDetail(prev);
  }
  return out;
}

const DAY_MS = 24 * 60 * 60 * 1000;
/** Vienas un tās pašas pirmās reģistrācijas datumi dažādos avotos (CarVertical mēnesis pret CSDD dienu). */
const FIRST_REG_SAME_EVENT_MS = 45 * DAY_MS;
/** Agrāks ieraksts citā valstī, kas pierāda, ka „pirmā” reģistrācija nav pirmā. */
const FIRST_REG_EARLIER_FOREIGN_MS = 31 * DAY_MS;
/** Valsts pēc tuvākā ieraksta: pirms (dīlera piegāde) un pēc pirmās reģistrācijas. */
const FIRST_REG_COUNTRY_BEFORE_MS = 92 * DAY_MS;
const FIRST_REG_COUNTRY_AFTER_MS = 365 * DAY_MS;

function eventCountryIso(e: LifecycleEvent): string | null {
  return countryLabelToIso2(e.country);
}

const PRODUCTION_EVENT_RE = /ražot|izgatavot|manufactur|produced|\bbuilt\b/i;

function isFirstRegistrationEvidence(e: LifecycleEvent): boolean {
  if (e.kind === "first_registration" || e.kind === "import" || e.kind === "gap") return false;
  if (e.nationalRegistration) return false;
  if (PRODUCTION_EVENT_RE.test(`${e.title} ${e.detail}`)) return false;
  return lifecycleEventProvidesCountryResidence(e);
}

function nationalRegistrationTitle(country: string): string {
  const loc = countryNameLvLocative(country);
  return loc ? `Reģistrācija ${loc}` : "Ieraksts reģistrā";
}

function demoteToNationalRegistration(e: LifecycleEvent): void {
  e.kind = "registration";
  e.nationalRegistration = true;
  if (!countryLabelToIso2(e.country)) e.country = "";
  e.title = nationalRegistrationTitle(e.country);
  if (/^1\.\s*reģistrācija/i.test(e.detail)) e.detail = "";
}

function hasEarlierForeignEvidence(events: LifecycleEvent[], card: LifecycleEvent, iso: string | null): boolean {
  if (!iso) return false;
  return events.some(
    (e) =>
      e !== card &&
      e.time > 0 &&
      e.time < card.time - FIRST_REG_EARLIER_FOREIGN_MS &&
      isFirstRegistrationEvidence(e) &&
      eventCountryIso(e) !== iso,
  );
}

/**
 * Pirmās reģistrācijas valsts, ja pats reģistrs to nezina: CSDD iepriekšējā valsts vai tuvākais
 * stiprais ieraksts (dīlera piegāde, reģistrs, nobraukums) ap datumu - tikai pirms pirmās nacionālās
 * reģistrācijas. Ja nav droši, valsts paliek tukša (karogu nerāda).
 */
function resolveFirstRegistrationCountry(
  events: LifecycleEvent[],
  card: LifecycleEvent,
  previousRegistrationCountry: string,
): string {
  const firstNational = events
    .filter((e) => e.nationalRegistration && e.time > card.time)
    .reduce((min, e) => Math.min(min, e.time), Number.POSITIVE_INFINITY);
  const evidence = events.filter(
    (e) =>
      e !== card &&
      e.time > 0 &&
      e.time < firstNational &&
      isFirstRegistrationEvidence(e) &&
      eventCountryIso(e) != null,
  );
  // 1) CSDD iepriekšējā valsts, ja neviens ārvalstu ieraksts tai nerunā pretī (visi ārvalstu ieraksti tajā pašā valstī).
  const prevIso = countryLabelToIso2(previousRegistrationCountry);
  const foreignIsos = new Set(
    evidence
      .filter((e) => e.time >= card.time - FIRST_REG_COUNTRY_BEFORE_MS)
      .map((e) => eventCountryIso(e)!)
      .filter((iso) => iso !== "LV"),
  );
  if (prevIso && prevIso !== "LV" && [...foreignIsos].every((iso) => iso === prevIso)) {
    return iso2ToLvDisplayName(prevIso);
  }
  // 2) Tuvākais ieraksts ap datumu.
  let best: LifecycleEvent | null = null;
  let bestDt = Number.POSITIVE_INFINITY;
  for (const e of evidence) {
    const dt = e.time - card.time;
    if (dt < -FIRST_REG_COUNTRY_BEFORE_MS || dt > FIRST_REG_COUNTRY_AFTER_MS) continue;
    // Pirms reģistrācijas tikai dīlera piegāde vai reģistrs - ne rūpnīcas km / „Ražots”.
    if (dt < 0 && !(e.kind === "service" || (e.kind === "registration" && !e.timelineInformational))) continue;
    if (Math.abs(dt) < bestDt) {
      best = e;
      bestDt = Math.abs(dt);
    }
  }
  return best ? normalizeCountryNameLv(best.country) || best.country : "";
}

/**
 * 21.11 (Nils): vēsturē tikai VIENA „Pirmā reģistrācija” - agrākā jebkurā valstī. Vēlākas „pirmās
 * reģistrācijas” (Somijā, Nīderlandē, Latvijā u.c.) ir „Reģistrācija <valstī>”. Viena notikuma ieraksti
 * no vairākiem avotiem (CSDD diena, CarVertical mēnesis) apvienojas vienā kartītē.
 */
function resolveFirstRegistration(events: LifecycleEvent[], previousRegistrationCountry: string): LifecycleEvent[] {
  const candidates = events
    .filter((e) => e.kind === "first_registration" && e.time > 0)
    .sort((a, b) => a.time - b.time);
  const drop = new Set<LifecycleEvent>();
  let world: LifecycleEvent | null = null;

  if (candidates.length > 0) {
    const earliest = candidates[0]!;
    const group = candidates.filter((c) => c.time - earliest.time <= FIRST_REG_SAME_EVENT_MS);
    // Precīzākais datums: CSDD, tad oficiāls reģistrs, tad agrākais.
    world =
      group.find((c) => c.sources.includes("CSDD")) ??
      group.find((c) => !c.timelineInformational) ??
      earliest;
    for (const c of group) {
      if (c === world) continue;
      drop.add(c);
      for (const s of c.sources) if (!world.sources.includes(s)) world.sources.push(s);
      if (!world.odometer && c.odometer) world.odometer = c.odometer;
      if (!countryLabelToIso2(world.country) && countryLabelToIso2(c.country)) {
        world.country = normalizeCountryNameLv(c.country) || c.country;
        if (c.timelineInformational && !world.sources.includes("CSDD")) world.timelineInformational = true;
      }
    }
    for (const c of candidates) {
      if (!group.includes(c)) demoteToNationalRegistration(c);
    }
    // Reģistra „pirmā reģistrācija” ar valsti, bet auto jau agrāk bijis citur → nacionālā.
    if (!world.sources.includes("CSDD") && hasEarlierForeignEvidence(events, world, eventCountryIso(world))) {
      demoteToNationalRegistration(world);
      world = null;
    }
  }

  if (!world) {
    // Agrākas reģistrācijas nav: agrākā „Pirmā reģistrācija <valstī>” ir pirmā reģistrācija vispār.
    const national = events
      .filter((e) => e.nationalRegistration && e.time > 0)
      .sort((a, b) => a.time - b.time)[0];
    const prevIso = countryLabelToIso2(previousRegistrationCountry);
    const csddLvBlocked = national?.sources.includes("CSDD") && Boolean(prevIso && prevIso !== "LV");
    if (national && !csddLvBlocked && !hasEarlierForeignEvidence(events, national, eventCountryIso(national))) {
      national.kind = "first_registration";
      national.nationalRegistration = false;
      national.title = FIRST_REGISTRATION_TITLE;
      world = national;
    }
  }

  if (world) {
    world.title = FIRST_REGISTRATION_TITLE;
    world.detail = /^1\.\s*reģistrācija/i.test(world.detail) ? "" : world.detail;
    if (!countryLabelToIso2(world.country)) {
      world.country = resolveFirstRegistrationCountry(events, world, previousRegistrationCountry);
      world.countryUnverified = false;
    }
  }
  return drop.size > 0 ? events.filter((e) => !drop.has(e)) : events;
}

function monthsBetween(a: number, b: number): number {
  return Math.round((b - a) / (1000 * 60 * 60 * 24 * 30.44));
}

/** Loģikas slānis: valsts maiņa → imports; ilgs klusums → robs. */
function addDerivedEvents(
  sorted: LifecycleEvent[],
  previousRegistrationCountry = "",
): LifecycleEvent[] {
  const out: LifecycleEvent[] = [];
  let prevCountry = "";
  let prevIso = "";
  let prevResidence: LifecycleEvent | null = null;
  let seededCsddPrevious = false;
  const previousCountryNorm =
    normalizeCountryNameLv(previousRegistrationCountry) || previousRegistrationCountry.trim();
  const previousIso = countryLabelToIso2(previousCountryNorm);
  for (const [i, e] of sorted.entries()) {
    const prev = i > 0 ? sorted[i - 1]! : null;
    if (prev && prev.time > 0 && e.time > 0) {
      const months = monthsBetween(prev.time, e.time);
      if (months >= GAP_MONTHS_THRESHOLD) {
        out.push({
          kind: "gap",
          date: `${prev.date} - ${e.date}`,
          time: prev.time + 1,
          year: prev.year,
          title: `Aptuveni ${months} mēneši bez ierakstiem`,
          detail: "",
          country: "",
          odometer: "",
          sources: [],
          tone: "warn",
        });
      }
    }
    const nextIso = lifecycleEventCountryChainIso(e, prevIso);
    if (nextIso) {
      const hard = lifecycleEventProvidesCountryResidence(e);
      let fromCountry = prevCountry;
      let fromIso = prevIso;
      if (!fromIso && !seededCsddPrevious && previousIso && csddFirstRegistrationInLatvia(e)) {
        fromCountry = previousCountryNorm;
        fromIso = previousIso;
        seededCsddPrevious = true;
      }
      if (hard && fromIso && fromIso !== nextIso) {
        const fromLabel = normalizeCountryNameLv(fromCountry) || fromCountry;
        const toLabel = normalizeCountryNameLv(e.country) || e.country;
        const caSide = fromIso === "CA" ? prevResidence : nextIso === "CA" ? e : null;
        if (!isDisputedUsCanadaCountryPair(fromIso, nextIso, caSide)) {
          out.push({
            kind: "import",
            date: e.date,
            time: e.time > 0 ? e.time - 1 : 0,
            year: e.year,
            title: `${fromLabel} → ${toLabel}`,
            detail: `${fromLabel} → ${toLabel}`,
            country: toLabel,
            fromCountry: fromLabel,
            odometer: "",
            sources: [...e.sources],
            tone: "warn",
          });
        }
      }
      prevCountry = normalizeCountryNameLv(e.country) || e.country;
      prevIso = nextIso;
      prevResidence = e;
    }
    out.push(e);
  }
  return out;
}

/**
 * Tikai vienas dienas A → B → A tiek apvienots. A → B → C paliek atsevišķas pārejas.
 */
function collapseSameDayCountryTransitions(events: LifecycleEvent[]): LifecycleEvent[] {
  const importsByDay = new Map<string, LifecycleEvent[]>();
  for (const e of events) {
    if (e.kind !== "import") continue;
    const key = eventDayKey(e);
    if (!key) continue;
    importsByDay.set(key, [...(importsByDay.get(key) ?? []), e]);
  }
  const drop = new Set<LifecycleEvent>();
  const extras: LifecycleEvent[] = [];
  for (const dayImports of importsByDay.values()) {
    if (dayImports.length <= 1) continue;
    const chain = [...dayImports].sort((a, b) => a.time - b.time);
    const startIso = countryLabelToIso2(chain[0]!.fromCountry ?? "");
    const endIso = countryLabelToIso2(chain[chain.length - 1]!.country);
    if (!startIso || !endIso || startIso !== endIso) continue;
    const hopText = chain.map((e) => `${e.fromCountry ?? "?"} → ${e.country}`).join(", ");
    for (const e of chain) drop.add(e);
    extras.push({
      kind: "anomaly",
      date: chain[0]!.date,
      time: chain[0]!.time,
      year: chain[0]!.year,
      title: "Vienas dienas valsts maiņa apvienota",
      detail: `${hopText}. Atkārtota A → B → A vienā datumā.`,
      country: "",
      odometer: "",
      sources: [...new Set(chain.flatMap((e) => e.sources))],
      tone: "warn",
    });
  }
  if (drop.size === 0) return events;
  return sortAscending([...events.filter((e) => !drop.has(e)), ...extras]);
}

function parseLifecycleOdometerKm(raw: string): number | null {
  const digits = raw.replace(/[^\d]/g, "");
  if (!digits) return null;
  const n = Number(digits);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Datums ir galvenā atslēga; odometrs kārto tikai notikumus ar vienu un to pašu datumu.
 * Odometrs nedrīkst būt pirmais: pēc atgrieztas skaitītāja vērtības km un datumu secība
 * ir pretrunā, un salīdzinātājs ar km pirmajā vietā kļūst netranzitīvs (secība neparedzama,
 * plus `addDerivedEvents` no kaimiņiem izlasa neesošas valstu maiņas un robus).
 */
/** Tās pašas dienas reģistrācija rādās pirms apskates / km ieraksta. */
function registrationSortRank(e: LifecycleEvent): number {
  if (e.kind === "first_registration") return 0;
  if (e.nationalRegistration) return 1;
  return 2;
}

function sortAscending(events: LifecycleEvent[]): LifecycleEvent[] {
  return [...events].sort((a, b) => {
    if (a.time !== b.time) return a.time - b.time;
    const rankA = registrationSortRank(a);
    const rankB = registrationSortRank(b);
    if (rankA !== rankB) return rankA - rankB;
    const kmA = parseLifecycleOdometerKm(a.odometer) ?? -1;
    const kmB = parseLifecycleOdometerKm(b.odometer) ?? -1;
    if (kmA !== kmB) return kmA - kmB;
    return a.kind.localeCompare(b.kind);
  });
}

function isListingOnlySourceSet(sources: string[]): boolean {
  const list = sources.map((s) => s.trim()).filter(Boolean);
  if (list.length === 0) return false;
  return list.every((s) => isListingLikeSource(s) || /\(sludin[āa]jums\)\s*$/i.test(s));
}

const LV_REGISTRY_SOURCE_RE = /^(?:csdd|ltab)\b/i;

/** Publisko reģistru hronoloģija (tjekbil, mnt.ee, Traficom u.c.) ir reģistra notikums, ne sludinājums. */
function isPublicRegistrySource(source: string): boolean {
  const t = source.trim();
  return REGISTRY_STYLE_BLOCK_KEYS.some((k) => SOURCE_BLOCK_LABELS[k] === t);
}

/**
 * Valsts maiņu un „Reģistrācija Latvijā” veido tikai reģistra notikumi, nekad sludinājums.
 * 1) Notikums, kura vienīgie avoti ir sludinājumi, ir `countryUnverified`.
 * 2) Ja CSDD ir pārbaudīts, bet CSDD / LTAB nav Latvijas reģistra ieraksta, „Latvija” no ne-reģistra avota
 *    (sludinājums, CarVertical/AutoDNA, dīlera vizīte) ir informatīva - tā nerada „X → Latvija” pāreju.
 */
function softenUnregisteredCountryClaims(events: LifecycleEvent[], input: LifecycleInput): void {
  // Bez CSDD bloka (nav pārbaudīts) reģistra statusu nezinām - Latvijas atzīmes nemīkstina.
  const lvRegistered =
    !input.csddForm ||
    csddHasLatvianRegistryRecord(input.csddForm) ||
    (input.manualLtabBlock?.rows ?? []).some((r) => ltabRowHasData(r));
  for (const e of events) {
    if (!e.country || lifecycleCountryIsSoft(e)) continue;
    if (e.kind === "import" || e.kind === "gap") continue;
    if (isListingOnlySourceSet(e.sources)) {
      e.countryUnverified = true;
      continue;
    }
    if (!lvRegistered && countryLabelToIso2(e.country) === "LV") {
      if (e.sources.some((s) => LV_REGISTRY_SOURCE_RE.test(s.trim()) || isPublicRegistrySource(s))) continue;
      e.timelineInformational = true;
    }
  }
}

/** Pilns dzīves cikls, vecākais notikums pirmais. */
export function buildVehicleLifecycleEvents(input: LifecycleInput): LifecycleEvent[] {
  const facts = collectFactEvents(input);
  facts.push(...collectForeignOwnerChangeEvents(input, facts));
  const odo = mergeSameDateTypeCountryDisagreement(collectOdometerEvents(input));
  const merged = mergeOdometerIntoFacts(facts, odo);
  const deduped = mergeSameDateTypeCountryDisagreement(dedupeSameEvents(merged)).filter((e) => e.time > 0);
  if (deduped.length === 0) return [];
  const previousRegistrationCountry = input.csddForm?.previousRegistrationCountry ?? "";
  const resolved = resolveFirstRegistration(deduped, previousRegistrationCountry);
  softenUnregisteredCountryClaims(resolved, input);
  for (const e of resolved) collapseCountryOnlyDetail(e);
  return collapseSameDayCountryTransitions(addDerivedEvents(sortAscending(resolved), previousRegistrationCountry));
}

export type VehicleFirstRegistrationSummary = {
  /** Agrākā reģistrācija jebkurā valstī (DD.MM.YYYY); tukšs, ja nav zināma. */
  date: string;
  /** Valsts latviski; tukšs, ja nav droši zināma. */
  country: string;
  countryIso: string;
  /** Valstu nacionālās reģistrācijas pēc pirmās („Reģistrācija Somijā”, „Reģistrācija Latvijā”). */
  national: { date: string; country: string; title: string }[];
};

/** Tā pati pirmās reģistrācijas loģika, ko rāda „Vēstures kopsavilkums” (AI faktu lapai un pārbaudēm). */
export function vehicleFirstRegistrationSummary(events: LifecycleEvent[]): VehicleFirstRegistrationSummary {
  const world = events.find((e) => e.kind === "first_registration");
  const country = world?.country.trim() ?? "";
  return {
    date: world?.date ?? "",
    country,
    countryIso: (country && countryLabelToIso2(country)) || "",
    national: events
      .filter((e) => e.nationalRegistration && e.kind === "registration")
      .map((e) => ({ date: e.date, country: e.country, title: e.title })),
  };
}
