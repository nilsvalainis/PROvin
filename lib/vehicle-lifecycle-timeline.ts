/**
 * Vēstures kopsavilkums — viena hronoloģiska transportlīdzekļa dzīves cikla lente no visiem avotiem.
 * Fakti nāk no jau savāktajiem blokiem; loģikas slānis pievieno importu, robus un pretrunas.
 */

import type {
  AutoRecordsBlockState,
  CitiAvotiBlockState,
  ClientManualLtabBlockPdf,
  ClientManualVendorBlockPdf,
  CsddFormFields,
  TirgusFormFields,
} from "@/lib/admin-source-blocks";
import { autoRecordsServiceWorkRowIsPrintable } from "@/lib/auto-records-service-works";
import { formatAutoRecordsDateForOutput } from "@/lib/auto-records-paste-parse";
import type { CcVinBlockState } from "@/lib/cc-vin-report";
import { parseDotOrIsoDateToMs } from "@/lib/clean-date-str";
import { normalizeCountryNameLv } from "@/lib/country-names-lv";
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
  /** Negadījuma kartīte — tas pats klasteris, ko „Negadījumu vēsture”. */
  incident?: UnifiedIncidentCluster;
};

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
    .replace(/^[\s,;:.\-–—]+|[\s,;:.\-–—]+$/g, "")
    .trim();
  return t;
}

export type LifecycleInput = {
  csddForm?: CsddFormFields | null;
  autoRecordsBlock?: AutoRecordsBlockState | null;
  ccVinBlock?: CcVinBlockState | null;
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
  return t || "—";
}

function yearOf(raw: string, ms: number): string {
  if (ms > 0) return String(new Date(ms).getUTCFullYear());
  const m = raw.match(/(\d{4})/);
  return m ? m[1]! : "—";
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
}): LifecycleEvent {
  const ms = parseLifecycleTimeMs(args.rawDate);
  return {
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
  };
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
    out.push(
      makeEvent({
        kind: "inspection",
        rawDate: r.date,
        title: "Tehniskā apskate",
        detail: r.ratingLabel.trim(),
        country: "Latvija",
        source: "CSDD",
        tone: failed ? "warn" : "info",
      }),
    );
  }

  for (const w of (input.autoRecordsBlock?.serviceWorks ?? []).filter(autoRecordsServiceWorkRowIsPrintable)) {
    out.push(
      makeEvent({
        kind: "service",
        rawDate: w.date,
        title: "Apkope",
        // Darbu saraksts paliek dīlera sadaļā; kopsavilkumā — tikai vieta.
        detail: w.location.trim(),
        odometer: w.odometer,
        source: "Dīleris",
      }),
    );
  }

  for (const b of input.manualVendorBlocks ?? []) {
    for (const t of b.vehicleHistoryTimeline ?? []) {
      if (!t.date.trim() && !t.description.trim()) continue;
      out.push(
        makeEvent({
          kind: "registration",
          rawDate: t.date,
          title: t.description.trim() || "Ieraksts reģistrā",
          country: t.country,
          source: b.title,
        }),
      );
    }
  }

  const incidents = aggregateUnifiedIncidents(
    collectUnifiedIncidentRows({
      manualVendorBlocks: input.manualVendorBlocks ?? null,
      manualLtabBlock: input.manualLtabBlock ?? null,
      ccVinBlock: input.ccVinBlock ?? null,
    }),
    collectUnifiedIncidentDamageDetails(input.manualVendorBlocks ?? null),
  );
  for (const c of incidents.clusters) {
    const ev = makeEvent({
      kind: "incident",
      rawDate: c.date,
      title: "Negadījums",
      detail: "",
      country: c.country,
      tone: "alert",
    });
    // Klastera displeja datums var būt MM.YYYY, ja avoti nesakrīt dienā — kārtošanai ņem precīzāko locekli.
    if (c.sortableTime > 0 && Number.isFinite(c.sortableTime)) {
      ev.time = c.sortableTime;
      ev.year = yearOf(c.date, c.sortableTime);
    }
    ev.sources = c.sourceValuations.map((s) => s.sourceLabel);
    ev.incident = c;
    out.push(ev);
  }

  const listingCreated = input.tirgusForm?.listingCreated?.trim();
  if (listingCreated) {
    out.push(
      makeEvent({
        kind: "listed",
        rawDate: listingCreated,
        title: "Izlikts pārdošanā",
        detail: "Sludinājuma izveides datums",
        source: "Sludinājums",
      }),
    );
  }

  return out;
}

function collectOdometerEvents(input: LifecycleInput): LifecycleEvent[] {
  const rows = prepareUnifiedMileageDisplayRows(
    collectUnifiedMileageRows({
      csddForm: input.csddForm ?? undefined,
      autoRecordsBlock: input.autoRecordsBlock ?? undefined,
      ccVinBlock: input.ccVinBlock ?? null,
      manualVendorBlocks: input.manualVendorBlocks ?? undefined,
      citiAvotiBlock: input.citiAvoti ?? null,
      tirgusForm: input.tirgusForm ?? null,
      listingUrl: input.listingUrl ?? null,
    }),
  );
  if (rows.length === 0) return [];
  const { anomalyBySourceOrder } = analyzeUnifiedMileageAnomalies(rows);
  return rows.map((r) => {
    const anomaly = anomalyBySourceOrder.get(r.sourceOrder) === true;
    const ev = makeEvent({
      kind: anomaly ? "anomaly" : "odometer",
      rawDate: r.date,
      title: anomaly ? "Iespējama odometra pretruna" : "Odometra ieraksts",
      country: r.country,
      odometer: r.odometer,
      tone: anomaly ? "alert" : "info",
    });
    ev.sources = [...r.sourceLabels];
    return ev;
  });
}

/** Odometra ieraksti tajā pašā mēnesī pieķeras faktiskajam notikumam, nevis dublējas atsevišķā rindā. */
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
    const host = hosts?.find((h) => h.kind !== "odometer");
    if (o.kind === "anomaly" || !host) {
      kept.push(o);
      continue;
    }
    if (!host.odometer && o.odometer) host.odometer = o.odometer;
    if (!host.country && o.country) host.country = o.country;
    for (const s of o.sources) if (!host.sources.includes(s)) host.sources.push(s);
  }
  return [...facts, ...kept];
}

function dedupeSameEvents(events: LifecycleEvent[]): LifecycleEvent[] {
  const byKey = new Map<string, LifecycleEvent>();
  const out: LifecycleEvent[] = [];
  for (const e of events) {
    const key = `${monthKey(e.time) || e.date}|${e.kind}|${e.title.toLowerCase()}`;
    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, e);
      out.push(e);
      continue;
    }
    if (!prev.odometer && e.odometer) prev.odometer = e.odometer;
    if (!prev.country && e.country) prev.country = e.country;
    if (!prev.detail && e.detail) prev.detail = e.detail;
    for (const s of e.sources) if (!prev.sources.includes(s)) prev.sources.push(s);
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
  for (const [i, e] of sorted.entries()) {
    const prev = i > 0 ? sorted[i - 1]! : null;
    if (prev && prev.time > 0 && e.time > 0) {
      const months = monthsBetween(prev.time, e.time);
      if (months >= GAP_MONTHS_THRESHOLD) {
        out.push({
          kind: "gap",
          date: `${prev.date} — ${e.date}`,
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
    if (e.country && prevCountry && e.country !== prevCountry && e.kind !== "gap") {
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
    if (e.country) prevCountry = e.country;
    out.push(e);
  }
  return out;
}

function sortAscending(events: LifecycleEvent[]): LifecycleEvent[] {
  return [...events].sort((a, b) => {
    if (a.time !== b.time) return a.time - b.time;
    return a.kind.localeCompare(b.kind);
  });
}

/** Pilns dzīves cikls, vecākais notikums pirmais. */
export function buildVehicleLifecycleEvents(input: LifecycleInput): LifecycleEvent[] {
  const facts = collectFactEvents(input);
  const merged = mergeOdometerIntoFacts(facts, collectOdometerEvents(input));
  const deduped = dedupeSameEvents(merged).filter((e) => e.time > 0);
  if (deduped.length === 0) return [];
  return addDerivedEvents(sortAscending(deduped));
}
