/**
 * Vēstures kopsavilkums - viena hronoloģiska transportlīdzekļa dzīves cikla lente no visiem avotiem.
 * Fakti nāk no jau savāktajiem blokiem; loģikas slānis pievieno importu, robus un pretrunas.
 */

import {
  emptyAutoRecordsBlock,
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
import { countryLabelToIso2, normalizeCountryNameLv } from "@/lib/country-names-lv";
import { lifecycleDealerVisitTitle } from "@/lib/vendor-service-history";
import {
  aggregateUnifiedIncidents,
  collectUnifiedIncidentDamageDetails,
  collectUnifiedIncidentRows,
  type UnifiedIncidentCluster,
} from "@/lib/unified-incidents";
import {
  analyzeUnifiedMileageAnomalies,
  collectUnifiedMileageRows,
  prepareUnifiedMileageDisplayRows,
} from "@/lib/unified-mileage";
import {
  collectListingPriceLifecyclePoints,
  formatListingOdometerKm,
  formatListingPriceEur,
} from "@/lib/listing-price-lifecycle";
import { resolveListingCountry } from "@/lib/listing-odometer";
import { isVendorTimelineListingRecord } from "@/lib/vendor-timeline-listing";

export const PDF_LIFECYCLE_TITLE = "Vēstures kopsavilkums";

export type LifecycleEventKind =
  | "first_registration"
  | "registration"
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
   * Kā sludinājums: zemāks svars, neģenerē valsts maiņu un nekļūst par `prevCountry`.
   * Atšķirībā no sludinājuma PDF nerāda „(pēc sludinājuma, nav apstiprināts)”.
   * Reģistra hronoloģija (tjekbil / Finnik / Traficom u.c.) šo karogu nesaņem.
   */
  timelineInformational?: boolean;
};

/** Valsts no sludinājuma vai laikposma tabulas - rāda, bet nešķērso robežu. */
export function lifecycleCountryIsSoft(e: Pick<LifecycleEvent, "countryUnverified" | "timelineInformational">): boolean {
  return e.countryUnverified === true || e.timelineInformational === true;
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
  country?: string;
  odometer?: string;
  source?: string;
  tone?: LifecycleEventTone;
  countryUnverified?: boolean;
  timelineInformational?: boolean;
}): LifecycleEvent {
  const ms = parseLifecycleTimeMs(args.rawDate);
  const ev: LifecycleEvent = {
    kind: args.kind,
    date: displayDate(args.rawDate, ms),
    time: ms > 0 ? ms : 0,
    year: yearOf(args.rawDate, ms),
    title: args.title,
    detail: lifecyclePublicCaption(args.detail ?? ""),
    country: normalizeCountryNameLv(args.country ?? "") || (args.country ?? "").trim(),
    odometer: args.odometer?.trim() ?? "",
    sources: args.source?.trim() ? [args.source.trim()] : [],
    tone: args.tone ?? "info",
    ...(args.countryUnverified ? { countryUnverified: true } : null),
    ...(args.timelineInformational ? { timelineInformational: true } : null),
  };
  collapseCountryOnlyDetail(ev);
  return ev;
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
    const sold = !/nav\s+pārdots/i.test(s.status);
    const priceText = ccVinAmountToEurDisplay(s.price) || s.price.trim();
    const venueText = lifecyclePublicCaption(s.venue);
    out.push(
      makeEvent({
        kind: "sale",
        rawDate: s.date,
        title: sold
          ? venueText
            ? `Pārdots · ${venueText}`
            : "Pārdots izsolē"
          : venueText
            ? `Nav pārdots · ${venueText}`
            : "Nepārdota izsole",
        detail: priceText,
        odometer: s.odometer,
        source,
        tone: "info",
      }),
    );
  }
}

function classifyVendorTimelineKind(description: string): LifecycleEventKind {
  const t = description.toLowerCase();
  if (/pirmā reģistrācija/.test(t)) return "first_registration";
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

function vendorTimelineTitleAndDetail(description: string, kind: LifecycleEventKind): { title: string; detail: string } {
  const raw = description.trim();
  if (kind === "inspection") {
    const split = raw.match(/^(?:veikta\s+)?(tehniskā apskate|periodiskā apskate|reģistrācijas apskate|importa apskate)\s*[:.\-]\s*(.+)$/i);
    if (split) return { title: "Tehniskā apskate", detail: split[2]!.trim() };
    if (/^(?:veikta\s+)?tehniskā apskate$/i.test(raw)) return { title: "Tehniskā apskate", detail: "" };
  }
  if (kind === "first_registration") return { title: "Pirmā reģistrācija", detail: "" };
  if (kind === "listed") {
    if (!raw || /^sludinājums$/i.test(raw)) return { title: "Sludinājums", detail: "" };
    return { title: "Sludinājums", detail: raw };
  }
  return { title: raw || "Ieraksts reģistrā", detail: "" };
}

/** Reģistrācija, apskate, oficiāls odometrs u.c. - ne sludinājuma vai laikposma tabulas valsts. */
export function lifecycleEventProvidesCountryResidence(e: LifecycleEvent): boolean {
  if (!e.country || lifecycleCountryIsSoft(e)) return false;
  if (e.kind === "listed" || e.kind === "gap") return false;
  return true;
}

function lifecycleSourceLooksInformationalVendor(source: string): boolean {
  const t = source.trim();
  if (!t) return false;
  if (vendorTimelineIsInformational(t)) return true;
  return /carvertical|autodna/i.test(t);
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

  if (csdd?.firstRegistration.trim()) {
    out.push(
      makeEvent({
        kind: "first_registration",
        rawDate: csdd.firstRegistration,
        title: "Pirmā reģistrācija",
        detail: "",
        country: csdd.previousRegistrationCountry,
        source: "CSDD",
      }),
    );
  }

  let lvOwner = 0;
  for (const e of csdd?.ownerRegistrationEvents ?? []) {
    if (!e.date.trim()) continue;
    lvOwner += 1;
    const raw = e.label.trim();
    const firstLv = /pirmā\s+reģistrācija/i.test(raw);
    out.push(
      makeEvent({
        kind: firstLv ? "first_registration" : "registration",
        rawDate: e.date,
        title: firstLv ? "Pirmā reģistrācija" : "Īpašnieka maiņa",
        detail: firstLv ? "1. reģistrācija Latvijā" : `${lvOwner}. īpašnieks Latvijā`,
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
        title: lifecycleDealerVisitTitle(w.works),
        // Darbu saraksts paliek dīlera sadaļā; kopsavilkumā - tikai vieta (ne valsts dublikāts).
        detail: locIsCountry ? "" : loc,
        country: locIsCountry ? loc : "",
        odometer: w.odometer,
        source: "Dīleris",
      }),
    );
  }

  for (const b of input.manualVendorBlocks ?? []) {
    const informational = vendorTimelineIsInformational(b.title);
    for (const t of b.vehicleHistoryTimeline ?? []) {
      if (t.includeInPdf === false) continue;
      if (!t.date.trim() && !t.description.trim()) continue;
      const kind = informational
        ? classifyInformationalVendorTimelineKind(t.description)
        : classifyVendorTimelineKind(t.description);
      const { title, detail } = vendorTimelineTitleAndDetail(t.description, kind);
      const failedInspection =
        kind === "inspection" && /neizturēt|ikke godkendt|omsyn|betinget/i.test(`${title} ${detail} ${t.description}`);
      out.push(
        makeEvent({
          kind,
          rawDate: t.date,
          title,
          detail,
          country: t.country,
          odometer: t.odometer,
          source: b.title,
          tone: informational ? "info" : failedInspection ? "warn" : kind === "incident" ? "alert" : "info",
          // Tirgus sludinājums (ss.lv) paliek countryUnverified ar piezīmi.
          // Laikposma tabulas rindas ir tāds pats zemais svars, bet bez „nav apstiprināts”.
          countryUnverified: !informational && kind === "listed" && Boolean(t.country.trim()),
          timelineInformational: informational,
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
  const { anomalyBySourceOrder, staleDocumentSourceOrders, dataEntryErrorSourceOrders } =
    analyzeUnifiedMileageAnomalies(rows);
  const listingKeys = collectVendorListingHintKeys(input);
  const confirmedUs = inputHasConfirmedUsResidence(input);
  return rows.flatMap((r) => {
    if (staleDocumentSourceOrders.has(r.sourceOrder) || dataEntryErrorSourceOrders.has(r.sourceOrder)) {
      return [];
    }
    const anomaly = anomalyBySourceOrder.get(r.sourceOrder) === true;
    const listingCountry = odometerMatchesVendorListing(listingKeys, r.date, r.country, r.odometer);
    const vendorCaDisputed = vendorCanadaDisputedAgainstUs(
      r.country,
      r.sourceLabels.length > 0 ? r.sourceLabels : [r.sourceLabel],
      confirmedUs,
    );
    const ev = makeEvent({
      kind: anomaly ? "anomaly" : "odometer",
      rawDate: r.date,
      title: anomaly ? "Iespējama odometra pretruna" : "Odometra ieraksts",
      country: r.country,
      odometer: r.odometer,
      tone: anomaly ? "alert" : "info",
      countryUnverified: r.countryUnverified === true || listingCountry || vendorCaDisputed,
    });
    ev.sources = r.sourceLabels.length > 0 ? [...r.sourceLabels] : [r.sourceLabel || "Nezināms avots"];
    return [ev];
  });
}

/**
 * Odometra ieraksti tajā pašā mēnesī pieķeras faktiskajam notikumam, nevis dublējas atsevišķā rindā.
 * Izņēmums: apstiprināts (ne `countryUnverified`) odometra ieraksts nekad nekļūst par "listed"
 * (sludinājums) saimnieku. Sludinājums ir tikai norāde, ne juridisks apstiprinājums, tāpēc oficiāls
 * avota ieraksts (CSDD/dīleris/carVertical/cits) tajā pašā mēnesī paliek savs, neatkarīgs ieraksts -
 * tas ļauj tam pareizi noteikt reālu robežšķērsošanu un nenozūd apvienojumā ar sludinājuma karti.
 * Sludinājuma PAŠA (arī nesertificēta) odometra rinda gan joprojām pieķeras savai "Sludinājums"
 * kartei - tā ir viens un tas pats fakts, ne atsevišķa liecība, un dublēt to būtu nepareizi.
 */
function mergeOdometerIntoFacts(facts: LifecycleEvent[], odo: LifecycleEvent[]): LifecycleEvent[] {
  const byMonth = new Map<string, LifecycleEvent[]>();
  for (const f of facts) {
    const key = monthKey(f.time);
    if (!key) continue;
    byMonth.set(key, [...(byMonth.get(key) ?? []), f]);
  }
  const kept: LifecycleEvent[] = [];
  for (const o of odo) {
    const key = monthKey(o.time);
    const hosts = key ? byMonth.get(key) : undefined;
    const host = hosts?.find((h) => {
      if (h.kind === "odometer") return false;
      if ((h.kind === "listed" || h.timelineInformational) && !lifecycleCountryIsSoft(o)) return false;
      return true;
    });
    if (o.kind === "anomaly" || !host) {
      kept.push(o);
      continue;
    }
    if (o.detail && !host.detail.includes(o.detail)) {
      host.detail = [host.detail, o.detail].filter(Boolean).join(". ");
    }
    // CSDD TA jau ir piesaistīts tā paša datuma CSDD km - neaizstāt ar cita datuma mēneša rādījumu.
    if (!host.odometer && o.odometer) host.odometer = o.odometer;
    if (!host.country && o.country) {
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

function dedupeSameEvents(events: LifecycleEvent[]): LifecycleEvent[] {
  const byKey = new Map<string, LifecycleEvent>();
  const out: LifecycleEvent[] = [];
  for (const e of events) {
    const key = `${monthKey(e.time) || e.date}|${e.kind}|${e.title.toLowerCase()}|${e.country.toLowerCase()}`;
    const prev = byKey.get(key);
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
    for (const s of e.sources) if (!prev.sources.includes(s)) prev.sources.push(s);
    collapseCountryOnlyDetail(prev);
  }
  return out;
}

function eventDayKey(e: LifecycleEvent): string {
  if (e.time > 0) {
    const d = new Date(e.time);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
  }
  return e.date.trim();
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
    if (e.kind === "import" || e.kind === "gap") {
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

function monthsBetween(a: number, b: number): number {
  return Math.round((b - a) / (1000 * 60 * 60 * 24 * 30.44));
}

/** Loģikas slānis: valsts maiņa → imports; ilgs klusums → robs. */
function addDerivedEvents(sorted: LifecycleEvent[]): LifecycleEvent[] {
  const out: LifecycleEvent[] = [];
  let prevCountry = "";
  let prevResidence: LifecycleEvent | null = null;
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
    if (
      lifecycleEventProvidesCountryResidence(e) &&
      prevCountry &&
      e.country !== prevCountry
    ) {
      const fromIso = countryLabelToIso2(prevCountry);
      const toIso = countryLabelToIso2(e.country);
      if (fromIso && toIso && fromIso !== toIso) {
        const caSide = fromIso === "CA" ? prevResidence : toIso === "CA" ? e : null;
        if (!isDisputedUsCanadaCountryPair(fromIso, toIso, caSide)) {
          out.push({
            kind: "import",
            date: e.date,
            time: e.time > 0 ? e.time - 1 : 0,
            year: e.year,
            title: `${prevCountry} → ${e.country}`,
            detail: `${prevCountry} → ${e.country}`,
            country: e.country,
            fromCountry: prevCountry,
            odometer: "",
            sources: [...e.sources],
            tone: "warn",
          });
        }
      }
    }
    // Sludinājuma/tirgus valsts nekad nekļūst par jauno "zināmo" valsti: nākamais notikums
    // joprojām salīdzinās pret pēdējo oficiāli apstiprināto valsti, ne pret pārdevēja pieņēmumu.
    if (lifecycleEventProvidesCountryResidence(e)) {
      prevCountry = e.country;
      prevResidence = e;
    }
    out.push(e);
  }
  return out;
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
function sortAscending(events: LifecycleEvent[]): LifecycleEvent[] {
  return [...events].sort((a, b) => {
    if (a.time !== b.time) return a.time - b.time;
    const kmA = parseLifecycleOdometerKm(a.odometer) ?? -1;
    const kmB = parseLifecycleOdometerKm(b.odometer) ?? -1;
    if (kmA !== kmB) return kmA - kmB;
    return a.kind.localeCompare(b.kind);
  });
}

/** Pilns dzīves cikls, vecākais notikums pirmais. */
export function buildVehicleLifecycleEvents(input: LifecycleInput): LifecycleEvent[] {
  const facts = collectFactEvents(input);
  const odo = mergeSameDateTypeCountryDisagreement(collectOdometerEvents(input));
  const merged = mergeOdometerIntoFacts(facts, odo);
  const deduped = mergeSameDateTypeCountryDisagreement(dedupeSameEvents(merged)).filter((e) => e.time > 0);
  if (deduped.length === 0) return [];
  for (const e of deduped) collapseCountryOnlyDetail(e);
  return addDerivedEvents(sortAscending(deduped));
}
