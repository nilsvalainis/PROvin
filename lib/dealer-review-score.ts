/**
 * Dīlera dati: «Atsauksmes iespēja» (Nila apstiprinātais makets 22.11.2026).
 * Cik ļoti dati klientam palīdzēja -> vai lūgt Google atsauksmi (tagad / pēc 2 dienām / nelūgt)
 * un vai vērts piedāvāt AUDITS. Rēķina kods no dīlera datiem (bez AI). Kartīte tikai IESAKA -
 * ķeksis sūtīšanas formā pats neieslēdzas.
 *
 * Modelis (0-100): ierakstu skaits ≤25, periods ≤15, svaigums līdz pasūtījumam ≤20,
 * noderīgi atradumi ≤25, atrunājošs atradums +30, AUDITS piemaksa +15, kvalitātes pārbaude «aizturētu» -15.
 */
import type { AutoRecordsBlockState } from "@/lib/admin-source-blocks";
import type { AutoRecordsServiceWorkRow } from "@/lib/auto-records-service-works";
import { extractDealerFactsFromServiceWorks } from "@/lib/admin-ai-dealer-facts";
import { parseDotOrIsoDateToMs } from "@/lib/clean-date-str";
import type { DealerDataJob } from "@/lib/dealer-data-job-types";
import {
  dealerMajorWorkCategory,
  foldDealerWorkText,
  isAccidentRepairWork,
  isDealerPaintWork,
} from "@/lib/dealer-major-works";
import { findDealerOdometerDrops, findDealerOdometerOutliers } from "@/lib/dealer-odometer-checks";
import type { DealerGateVerdict, DealerShadowGate } from "@/lib/dealer-shadow-types";
import { buildOilIntervalSeriesForBlock } from "@/lib/oil-change-interval-chart";
import { printableDealerServiceWorks } from "@/lib/pdf-dealer-service-visits";
import { buildDealerVisitSummary } from "@/lib/pdf-dealer-timeline";

// ---------------------------------------------------------------------------------------------
// Tipi
// ---------------------------------------------------------------------------------------------

export type DealerReviewLevel = "high" | "medium" | "low" | "none";
export type DealerReviewAction = "ask_now" | "ask_later" | "dont_ask";
export type DealerAuditsAdvice = "worth" | "unlikely" | "not_rated";
/** «+» palīdz, «-» traucē, «·» neitrāls, «!» atrunājošs atradums. */
export type DealerReviewSign = "+" | "-" | "·" | "!";

export type DealerReviewReason = {
  sign: DealerReviewSign;
  text: string;
  /** Punkti (null - bez punktiem). */
  points: number | null;
  /** Faktora griesti (piem. 25), ja faktors ir skala. */
  max?: number;
};

export type DealerDisqualifierKind =
  | "taxi"
  | "rental"
  | "driving_school"
  | "courier"
  | "high_mileage"
  | "total_loss"
  | "odometer_drop"
  | "many_major";

export type DealerDisqualifier = { kind: DealerDisqualifierKind; text: string };

export type DealerTaxiSignalKind = "taxi" | "rental" | "driving_school" | "courier";
export type DealerTaxiSignal = { kind: DealerTaxiSignalKind; text: string };

export type DealerReviewScoreInput = {
  /** `data` - ir dīlera ieraksti; `no_data` - OneAuto datu nav; `not_ready` - ielase nav pabeigta. */
  dataState: "data" | "no_data" | "not_ready";
  /** Maksājums atgriezts. */
  refunded: boolean;
  /** Klients sūdzējies (nākotnei; tagad nav datu avota). */
  complaint?: boolean;
  recordCount: number;
  /** DD.MM.YYYY vai ISO. */
  firstDate: string;
  lastDate: string;
  /** Pasūtījuma brīdis (ms). */
  orderDateMs: number;
  /** Mehāniskie lielie mezgli (bez virsbūves / negadījuma), pēdējā reize katram. */
  majorWorks: { label: string; date: string; km: string }[];
  /** Odometra kritumi pret iepriekšējo ierakstu (virs pielaides). */
  odometerDrops: { fromKm: number; toKm: number; fromDate: string; toDate: string; significant: boolean }[];
  campaignsDone: boolean;
  /** Cik % nobraukuma (līdz pēdējam ierakstam) sedz secīgas eļļas maiņas; null - eļļas maiņu nav. */
  oilCoveragePct: number | null;
  paintSigns: { date: string }[];
  taxiSignals: DealerTaxiSignal[];
  /** Vidējais nobraukums gadā (km); null - nevar izrēķināt. */
  annualKm: number | null;
  totalLoss: boolean;
  auditsPurchased: boolean;
  /** Ēnu režīma spriedums; null - pārbaudes nav (neņem vērā). */
  shadowVerdict: DealerGateVerdict | null;
  /** Pirmais «aizturētu» iemesls (īss). */
  shadowHoldReason?: string;
};

export type DealerReviewScore = {
  level: DealerReviewLevel;
  action: DealerReviewAction;
  /** 0-100; null, ja punktus nerēķina (datu nav / atmaksa / sūdzība). */
  score: number | null;
  reasons: DealerReviewReason[];
  disqualifier: DealerDisqualifier | null;
  audits: { advice: DealerAuditsAdvice; reasons: string[] };
};

// ---------------------------------------------------------------------------------------------
// Sliekšņi
// ---------------------------------------------------------------------------------------------

export const DEALER_REVIEW_HIGH_MIN = 60;
export const DEALER_REVIEW_MEDIUM_MIN = 35;
export const DEALER_REVIEW_DISQUALIFIER_POINTS = 30;
export const DEALER_REVIEW_AUDITS_POINTS = 15;
export const DEALER_REVIEW_SHADOW_HOLD_POINTS = -15;
export const DEALER_REVIEW_FINDINGS_MAX = 25;
export const DEALER_REVIEW_HIGH_ANNUAL_KM = 40_000;
/** Būtisks odometra kritums: vairāk par 10% no iepriekšējā rādījuma. */
export const DEALER_REVIEW_ODOMETER_DROP_RATIO = 0.1;
export const DEALER_REVIEW_MANY_MAJOR = 3;
export const DEALER_REVIEW_OIL_GOOD_PCT = 70;
export const DEALER_AUDITS_OIL_WEAK_PCT = 60;
export const DEALER_AUDITS_STALE_MONTHS = 24;

export function dealerReviewCountPoints(n: number): number {
  if (n >= 15) return 25;
  if (n >= 8) return 20;
  if (n >= 4) return 14;
  if (n >= 2) return 8;
  if (n >= 1) return 3;
  return 0;
}

export function dealerReviewPeriodPoints(years: number | null): number {
  if (years == null || years < 1) return 2;
  if (years < 3) return 6;
  if (years < 6) return 10;
  return 15;
}

export function dealerReviewFreshnessPoints(months: number | null): number {
  if (months == null) return 0;
  if (months <= 12) return 20;
  if (months <= 24) return 14;
  if (months <= 48) return 8;
  if (months <= 96) return 3;
  return 0;
}

export function dealerReviewLevelFromScore(score: number): Exclude<DealerReviewLevel, "none"> {
  if (score >= DEALER_REVIEW_HIGH_MIN) return "high";
  if (score >= DEALER_REVIEW_MEDIUM_MIN) return "medium";
  return "low";
}

// ---------------------------------------------------------------------------------------------
// Teksti (UI)
// ---------------------------------------------------------------------------------------------

export const DEALER_REVIEW_LEVEL_LABEL: Record<DealerReviewLevel, string> = {
  high: "Augsta",
  medium: "Vidēja",
  low: "Zema",
  none: "Nelūgt",
};

export const DEALER_REVIEW_ACTION_LABEL: Record<DealerReviewAction, string> = {
  ask_now: "Lūgt tagad, kopā ar PDF e-pastu",
  ask_later: "Lūgt vēlāk - pēc 2 dienām",
  dont_ask: "Nelūgt",
};

export const DEALER_REVIEW_ACTION_SHORT: Record<DealerReviewAction, string> = {
  ask_now: "lūgt tagad",
  ask_later: "pēc 2 dienām",
  dont_ask: "nelūgt",
};

/** Sūtīšanas formas apakšrinda: «Lūgt tagad», «Labāk pēc 2 dienām», «Nelūgt». */
export const DEALER_REVIEW_ACTION_HINT: Record<DealerReviewAction, string> = {
  ask_now: "Lūgt tagad",
  ask_later: "Labāk pēc 2 dienām",
  dont_ask: "Nelūgt",
};

export const DEALER_AUDITS_ADVICE_LABEL: Record<DealerAuditsAdvice, string> = {
  worth: "Vērts",
  unlikely: "Maz ticams",
  not_rated: "Nav vērtēts",
};

/** Krāsas tonis: ok (zaļš), mid (pelēks), bad (sarkans), o (tukšs aplis). */
export type DealerReviewTone = "ok" | "mid" | "bad" | "o";

export function dealerReviewLevelTone(level: DealerReviewLevel): DealerReviewTone {
  if (level === "high") return "ok";
  if (level === "medium") return "mid";
  return "bad";
}

export function dealerAuditsTone(advice: DealerAuditsAdvice): DealerReviewTone {
  return advice === "worth" ? "ok" : "o";
}

// ---------------------------------------------------------------------------------------------
// Palīgi
// ---------------------------------------------------------------------------------------------

function groupDigits(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function parseKm(odometer: string): number | null {
  const digits = (odometer ?? "").replace(/\D/g, "");
  if (!digits) return null;
  const n = Number(digits);
  return Number.isFinite(n) && n > 0 ? n : null;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const MONTH_DAYS = 30.437;

function monthsBetween(fromMs: number, toMs: number): number | null {
  if (!fromMs || !toMs || toMs < fromMs) return null;
  return Math.round((toMs - fromMs) / DAY_MS / MONTH_DAYS);
}

/** «12.03.2024» -> «03.2024». */
export function dealerReviewMonthYear(date: string): string {
  const ms = parseDotOrIsoDateToMs(date);
  if (!ms) return (date ?? "").trim();
  const d = new Date(ms);
  return `${String(d.getUTCMonth() + 1).padStart(2, "0")}.${d.getUTCFullYear()}`;
}

function yearOf(date: string): number | null {
  const ms = parseDotOrIsoDateToMs(date);
  return ms ? new Date(ms).getUTCFullYear() : null;
}

/** Latviešu skaitlis: 1, 21, 31 … (ne 11) - vienskaitlis. */
function lvPlural(n: number, one: string, many: string): string {
  const abs = Math.abs(Math.trunc(n));
  return abs % 10 === 1 && abs % 100 !== 11 ? one : many;
}

function recordsLabel(n: number): string {
  return `${n} ${lvPlural(n, "ieraksts", "ieraksti")}`;
}

function formatYears(years: number): string {
  const r = Math.round(years * 10) / 10;
  const s = Number.isInteger(r) ? String(r) : r.toFixed(1).replace(".", ",");
  return `${s} ${Number.isInteger(r) ? lvPlural(r, "gads", "gadi") : "gadi"}`;
}

function periodText(firstDate: string, lastDate: string): { text: string; years: number | null } {
  const a = parseDotOrIsoDateToMs(firstDate);
  const b = parseDotOrIsoDateToMs(lastDate);
  if (!a || !b || b < a) return { text: "Periods nav zināms", years: null };
  const days = Math.round((b - a) / DAY_MS);
  const years = days / 365.25;
  if (years < 1) {
    if (days < 31) {
      const d = Math.max(1, days);
      return { text: `Periods: ${d} ${lvPlural(d, "diena", "dienas")}`, years };
    }
    return { text: `Periods: ${Math.round(days / MONTH_DAYS)} mēn.`, years };
  }
  return { text: `${yearOf(firstDate)}-${yearOf(lastDate)}, ${formatYears(years)}`, years };
}

// ---------------------------------------------------------------------------------------------
// Taxi / noma / kurjers
// ---------------------------------------------------------------------------------------------

/** Mercedes-Benz VIN prefiksi (WMI). Rūpnīcas kodi 965 / 937 ir taxi pazīme tikai Mercedes. */
const MERCEDES_WMI_RE = /^(?:WDB|WDC|WDD|WDF|WMX|W1K|W1N|W1V|W1W|W1T|W1X|W1Y)/i;

/** «Nav taxi» - aprīkojums, kas izslēdz taxi detaļas vai ir tikai varianta nosaukums. */
const TAXI_NEGATIVE_RE =
  /without\s+taxi|ohne\s+taxi|excluded\s+for\s+taxi|parts?\s+excluded|exclud\p{L}*\s+taxi|taxi\s+adm\b|adm\.?\s+variant|non[-\s]?taxi|nicht\s+fur\s+taxi|kein\p{L}*\s+taxi|bez\s+taks/u;

/** Aprīkojuma apraksts ar taxi / nomas / autoskolas paketi. */
const EQUIP_TAXI_RE = /\btaxi(?:cab|s)?\b|taxameter|taksometr|hired\s+cars?/u;
const EQUIP_RENTAL_RE = /mietwagen|rental\s+(?:vehicle|car)|rent[-\s]?a[-\s]?car/u;
const EQUIP_SCHOOL_RE = /fahrschul\p{L}*|driving\s+school|autoskol\p{L}*/u;

/** Reģistra teksts (NL RDW / Finnik «Taxi: Ja», DK «Taxikørsel», «ex-taxi»). Tikai skaidras formas. */
const TEXT_TAXI_YES_RE =
  /\btaxi\s*[:=]?\s*(?:ja|yes)\b|taxik(?:o|oe)rsel|anvendelse\s*:?\s*taxi|gebruik\s*:?\s*taxi|verwendung\s*:?\s*taxi|registered\s+as\s+(?:a\s+)?taxi|\b(?:ex|former)[-\s]taxi\b|bijusais\s+taksometrs/u;
const TEXT_TAXI_NO_RE = /taxik(?:o|oe)rsel\s*[:=]?\s*(?:nej|no|ne)\b/u;
const TEXT_RENTAL_RE =
  /anvendelse\s*:?\s*udlejning|verwendung\s*:?\s*(?:mietwagen|vermietung)|registered\s+as\s+(?:a\s+)?rental|\b(?:ex|former)[-\s]rental\b/u;
const TEXT_SCHOOL_RE = /anvendelse\s*:?\s*(?:koreskole|skolevogn)|verwendung\s*:?\s*fahrschule/u;
const TEXT_COURIER_RE = /anvendelse\s*:?\s*(?:kurer|vareudbringning)|verwendung\s*:?\s*kurier/u;

/** NFKD, bez diakritikas, mazie burti; ø -> o, æ -> ae. */
function foldTaxiText(raw: string): string {
  return (raw ?? "")
    .replace(/ø/gi, "o")
    .replace(/æ/gi, "ae")
    .replace(/ß/g, "ss")
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function clip(s: string, max = 80): string {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

/**
 * Taxi / nomas / autoskolas / kurjera pazīmes: rūpnīcas aprīkojums (Mercedes 965 / 937, OneAuto / Outvin
 * pakete) un reģistru teksti. Izņēmumi (nav taxi): «Without taxi alarm», «9A0», «Parts excluded for TAXI»,
 * «TAXI Adm variant». Servisa darbu tekstu NElieto («Mietwagen» / «Taxi» tur parasti ir aizvietošanas auto).
 */
export function detectDealerTaxiSignals(args: {
  vin?: string | null;
  equipment?: readonly { code?: string | null; description?: string | null }[] | null;
  texts?: readonly string[] | null;
}): DealerTaxiSignal[] {
  const out: DealerTaxiSignal[] = [];
  const seen = new Set<string>();
  const push = (kind: DealerTaxiSignalKind, text: string) => {
    const key = `${kind}|${text}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ kind, text });
  };
  const mercedes = MERCEDES_WMI_RE.test((args.vin ?? "").trim());

  for (const line of args.equipment ?? []) {
    const code = (line.code ?? "").trim().toUpperCase().replace(/^0+(?=\d)/, "");
    const desc = (line.description ?? "").trim();
    const folded = foldTaxiText(desc);
    if (code === "9A0" || TAXI_NEGATIVE_RE.test(folded)) continue;
    const label = clip(code ? `${code} ${desc}` : desc);
    const codeMatch = /^(?:965|937)[A-Z]?$/.test(code) && (mercedes || /taxi|hired|reinforc|rental/.test(folded));
    if (codeMatch || EQUIP_TAXI_RE.test(folded)) push("taxi", label);
    else if (EQUIP_RENTAL_RE.test(folded)) push("rental", label);
    else if (EQUIP_SCHOOL_RE.test(folded)) push("driving_school", label);
  }

  for (const text of args.texts ?? []) {
    for (const raw of (text ?? "").split(/\r?\n+/)) {
      const folded = foldTaxiText(raw);
      if (!folded || folded.length > 400) continue;
      if (TAXI_NEGATIVE_RE.test(folded)) continue;
      if (TEXT_TAXI_YES_RE.test(folded) && !TEXT_TAXI_NO_RE.test(folded)) push("taxi", clip(raw));
      else if (TEXT_RENTAL_RE.test(folded)) push("rental", clip(raw));
      else if (TEXT_SCHOOL_RE.test(folded)) push("driving_school", clip(raw));
      else if (TEXT_COURIER_RE.test(folded)) push("courier", clip(raw));
    }
  }
  return out;
}

const TAXI_KIND_LABEL: Record<DealerTaxiSignalKind, string> = {
  taxi: "Taxi",
  rental: "Noma",
  driving_school: "Autoskola",
  courier: "Kurjers",
};

/** Kopsavilkums: Mercedes kodi «965 + 937» vienā rindā, citādi pirmā pazīme. */
function taxiSignalText(signals: readonly DealerTaxiSignal[]): { kind: DealerTaxiSignalKind; text: string } {
  const taxi = signals.filter((s) => s.kind === "taxi");
  const pick = taxi.length > 0 ? taxi : signals;
  const kind = pick[0]!.kind;
  const codes = pick.map((s) => /^(\d{3})\b/.exec(s.text)?.[1]).filter((c): c is string => Boolean(c));
  if (codes.length >= 2) return { kind, text: `${TAXI_KIND_LABEL[kind]} kodi ${codes.join(" + ")} rūpnīcas komplektācijā` };
  return { kind, text: `${TAXI_KIND_LABEL[kind]} pazīme: ${pick[0]!.text}` };
}

const TOTAL_LOSS_RE =
  /total\s*loss|totalschaden|totalverlust|economic(?:al)?\s+total|salvage\s+(?:title|vehicle)|totalskad\p{L}*|bojaej\p{L}*|totalais\s+zaudejum\p{L}*|полная\s+гибель|тотал\p{L}*/u;

export function dealerTextsHaveTotalLoss(texts: readonly string[]): boolean {
  return texts.some((t) => TOTAL_LOSS_RE.test(foldTaxiText(t)));
}

// ---------------------------------------------------------------------------------------------
// Aprēķins (tīra funkcija)
// ---------------------------------------------------------------------------------------------

function disqualifierOf(input: DealerReviewScoreInput): DealerDisqualifier | null {
  if (input.taxiSignals.length > 0) {
    const t = taxiSignalText(input.taxiSignals);
    return { kind: t.kind, text: t.text };
  }
  if (input.totalLoss) return { kind: "total_loss", text: "Total loss ieraksts datos" };
  const bigDrop = input.odometerDrops.find(
    (d) => d.significant && d.fromKm > 0 && (d.fromKm - d.toKm) / d.fromKm > DEALER_REVIEW_ODOMETER_DROP_RATIO,
  );
  if (bigDrop) {
    return {
      kind: "odometer_drop",
      text: `Odometra kritums ${groupDigits(bigDrop.fromKm)} → ${groupDigits(bigDrop.toKm)} km (${Math.round(((bigDrop.fromKm - bigDrop.toKm) / bigDrop.fromKm) * 100)}%)`,
    };
  }
  if (input.annualKm != null && input.annualKm > DEALER_REVIEW_HIGH_ANNUAL_KM) {
    return { kind: "high_mileage", text: `Vidēji ${groupDigits(input.annualKm)} km gadā` };
  }
  if (input.majorWorks.length >= DEALER_REVIEW_MANY_MAJOR) {
    return { kind: "many_major", text: `${input.majorWorks.length} lielie mezgli nomainīti` };
  }
  return null;
}

function shadowReason(input: DealerReviewScoreInput): DealerReviewReason {
  if (input.shadowVerdict === "would_hold") {
    const why = (input.shadowHoldReason ?? "").trim();
    return {
      sign: "-",
      text: `Kvalitātes pārbaude aizturētu${why ? `: ${clip(why, 90)}` : ""}`,
      points: DEALER_REVIEW_SHADOW_HOLD_POINTS,
    };
  }
  if (input.shadowVerdict === "would_send") return { sign: "·", text: "Kvalitātes pārbaude: izlaista", points: 0 };
  return { sign: "·", text: "Kvalitātes pārbaude: nav veikta", points: null };
}

function auditsAdvice(
  input: DealerReviewScoreInput,
  disq: DealerDisqualifier | null,
  monthsSinceLast: number | null,
): DealerReviewScore["audits"] {
  if (input.auditsPurchased) return { advice: "unlikely", reasons: ["AUDITS jau nopirkts"] };
  if (disq) {
    const why =
      disq.kind === "taxi" || disq.kind === "rental" || disq.kind === "driving_school" || disq.kind === "courier"
        ? `${TAXI_KIND_LABEL[disq.kind]} pazīme parasti atrunā no pirkuma`
        : "Atrunājošs atradums parasti atrunā no pirkuma";
    return { advice: "unlikely", reasons: [why, "Padziļināti pārbauda tikai mazs procents"] };
  }
  const reasons: string[] = [];
  if (monthsSinceLast != null && monthsSinceLast > DEALER_AUDITS_STALE_MONTHS) {
    reasons.push(`Pēc ${dealerReviewMonthYear(input.lastDate)} dīlera ierakstu nav`);
  }
  if (input.recordCount <= 3) {
    reasons.push(`Tikai ${recordsLabel(input.recordCount)} - vēsturi pārbaudīt citos avotos`);
  }
  if (input.oilCoveragePct == null || input.oilCoveragePct < DEALER_AUDITS_OIL_WEAK_PCT) {
    reasons.push(
      input.oilCoveragePct == null
        ? "Eļļas maiņu dīlera datos nav"
        : `Eļļas maiņas sedz tikai ${input.oilCoveragePct}% nobraukuma`,
    );
  }
  if (input.odometerDrops.length > 0) reasons.push("Odometra kritumu pārbaudīt citos avotos");
  if (input.paintSigns.length > 0) reasons.push("Krāsošanas pazīmes - pārbaudīt negadījumus");
  if (reasons.length > 0) return { advice: "worth", reasons };
  return { advice: "unlikely", reasons: ["Dīlera vēsture pilna un svaiga"] };
}

/** Atsauksmes iespēja un AUDITS piedāvājums (tīra funkcija). */
export function scoreDealerReview(input: DealerReviewScoreInput): DealerReviewScore {
  // Datu nav, atmaksa vai sūdzība - nelūgt, punktus nerēķina.
  if (input.dataState !== "data" || input.refunded || input.complaint || input.recordCount <= 0) {
    const reasons: DealerReviewReason[] = [];
    if (input.dataState === "not_ready") reasons.push({ sign: "-", text: "Ielase nav pabeigta", points: null });
    else if (input.dataState === "no_data" || input.recordCount <= 0) {
      reasons.push({ sign: "-", text: "OneAuto: datu nav", points: null });
    }
    if (input.refunded) reasons.push({ sign: "-", text: "Maksājums atgriezts", points: null });
    if (input.complaint) reasons.push({ sign: "-", text: "Klients sūdzējies", points: null });
    return {
      level: "none",
      action: "dont_ask",
      score: null,
      reasons,
      disqualifier: null,
      audits: { advice: "not_rated", reasons: [] },
    };
  }

  const reasons: DealerReviewReason[] = [];
  const disq = disqualifierOf(input);
  if (disq) reasons.push({ sign: "!", text: disq.text, points: DEALER_REVIEW_DISQUALIFIER_POINTS });

  const nPts = dealerReviewCountPoints(input.recordCount);
  reasons.push({ sign: nPts >= 14 ? "+" : "-", text: recordsLabel(input.recordCount), points: nPts, max: 25 });

  const period = periodText(input.firstDate, input.lastDate);
  const pPts = dealerReviewPeriodPoints(period.years);
  reasons.push({ sign: pPts >= 10 ? "+" : "-", text: period.text, points: pPts, max: 15 });

  const monthsSinceLast = monthsBetween(parseDotOrIsoDateToMs(input.lastDate), input.orderDateMs);
  const fPts = dealerReviewFreshnessPoints(monthsSinceLast);
  reasons.push({
    sign: fPts >= 14 ? "+" : "-",
    text:
      monthsSinceLast == null
        ? "Pēdējā ieraksta datums nav zināms"
        : `Pēdējais ieraksts pirms ${monthsSinceLast} mēn. (${dealerReviewMonthYear(input.lastDate)})`,
    points: fPts,
    max: 20,
  });

  // Noderīgi atradumi (kopā ≤25).
  const findings: DealerReviewReason[] = [];
  let majorPts = 0;
  for (const m of input.majorWorks) {
    const add = majorPts < 12 ? 6 : 0;
    majorPts += add;
    const when = [dealerReviewMonthYear(m.date), m.km].filter(Boolean).join(", ");
    findings.push({ sign: "+", text: `${m.label}${when ? ` ${when}` : ""}`, points: add });
  }
  const drop = input.odometerDrops[0];
  if (drop) {
    const yrs = [yearOf(drop.fromDate), yearOf(drop.toDate)].filter((y): y is number => y != null);
    const span = yrs.length === 2 ? (yrs[0] === yrs[1] ? ` (${yrs[0]})` : ` (${yrs[0]}-${yrs[1]})`) : "";
    findings.push({
      sign: "+",
      text: `Odometra kritums ${groupDigits(drop.fromKm)} → ${groupDigits(drop.toKm)} km${span}`,
      points: 8,
    });
  }
  if (input.campaignsDone) findings.push({ sign: "+", text: "Kampaņa / atsaukums dīlera datos", points: 4 });
  if (input.oilCoveragePct != null && input.oilCoveragePct >= DEALER_REVIEW_OIL_GOOD_PCT) {
    findings.push({
      sign: "+",
      text:
        input.oilCoveragePct >= 95
          ? "Eļļas maiņas visā periodā bez robiem"
          : `Eļļas maiņas sedz ${input.oilCoveragePct}% nobraukuma`,
      points: 6,
    });
  } else {
    findings.push({
      sign: "-",
      text:
        input.oilCoveragePct == null
          ? "Eļļas maiņu dīlera datos nav"
          : `Eļļas maiņas sedz tikai ${input.oilCoveragePct}% nobraukuma`,
      points: 0,
    });
  }
  if (input.paintSigns.length > 0) {
    const when = dealerReviewMonthYear(input.paintSigns[0]!.date);
    findings.push({ sign: "+", text: `Krāsošanas pazīmes${when ? ` ${when}` : ""}`, points: 5 });
  }
  // Griesti 25: punkti, kas pārsniedz, paliek redzami ar 0.
  let left = DEALER_REVIEW_FINDINGS_MAX;
  for (const f of findings) {
    if (f.points != null && f.points > 0) {
      const take = Math.min(f.points, left);
      left -= take;
      f.points = take;
    }
  }
  if (input.majorWorks.length === 0) findings.push({ sign: "·", text: "Lielu remontu nav", points: 0 });
  reasons.push(...findings);

  reasons.push(
    input.auditsPurchased
      ? { sign: "+", text: "AUDITS piemaksa nopirkta", points: DEALER_REVIEW_AUDITS_POINTS }
      : { sign: "·", text: "AUDITS piemaksa nav pirkta", points: 0 },
  );
  reasons.push(shadowReason(input));

  const raw = reasons.reduce((a, r) => a + (r.points ?? 0), 0);
  const score = Math.max(0, Math.min(100, Math.round(raw)));
  let level = dealerReviewLevelFromScore(score);
  if (input.recordCount <= 2 && level !== "low") level = "low";
  if (input.recordCount <= 2) reasons.push({ sign: "·", text: "1-2 ieraksti - ne augstāk par «zema»", points: null });
  // Atrunājošs atradums: klients, visticamāk, auto nepirks - pateicība ir tagad.
  if (disq) level = "high";
  const action: DealerReviewAction = level === "high" ? "ask_now" : level === "medium" ? "ask_later" : "dont_ask";

  return { level, action, score, reasons, disqualifier: disq, audits: auditsAdvice(input, disq, monthsSinceLast) };
}

// ---------------------------------------------------------------------------------------------
// Ievade no melnraksta (dīlera bloks) + darba ieraksta
// ---------------------------------------------------------------------------------------------

/** Visas teksta lapas objektā (reģistru teksti taxi meklēšanai). Ierobežots apjoms. */
export function collectSourceBlockTexts(value: unknown, maxChars = 400_000): string[] {
  const out: string[] = [];
  let total = 0;
  const walk = (v: unknown, depth: number) => {
    if (total >= maxChars || depth > 8 || v == null) return;
    if (typeof v === "string") {
      if (v.length < 3 || /^data:|^https?:\/\//.test(v)) return;
      out.push(v);
      total += v.length;
      return;
    }
    if (Array.isArray(v)) {
      for (const x of v) walk(x, depth + 1);
      return;
    }
    if (typeof v === "object") for (const x of Object.values(v as Record<string, unknown>)) walk(x, depth + 1);
  };
  walk(value, 0);
  return out;
}

function firstHoldReason(gate: DealerShadowGate | null | undefined): string {
  const c = gate?.checks.find((x) => x.state === "fail" && x.severity === "block");
  return c ? c.reason || c.title : "";
}

/** Vidējais km gadā: no pirmās reģistrācijas līdz pēdējam ierakstam, citādi starp ierakstiem (≥12 mēn.). */
function annualKmOf(rows: readonly AutoRecordsServiceWorkRow[], firstRegistration: string): number | null {
  const outliers = findDealerOdometerOutliers(rows);
  const pts = rows
    .filter((r) => !outliers.has(r))
    .map((r) => ({ ms: parseDotOrIsoDateToMs(r.date), km: parseKm(r.odometer) }))
    .filter((p): p is { ms: number; km: number } => Boolean(p.ms) && p.km != null)
    .sort((a, b) => a.ms - b.ms);
  if (pts.length === 0) return null;
  const last = pts[pts.length - 1]!;
  const regMs = parseDotOrIsoDateToMs(firstRegistration);
  const year = 365.25 * DAY_MS;
  if (regMs && last.ms - regMs >= year) return Math.round(last.km / ((last.ms - regMs) / year));
  const first = pts[0]!;
  if (last.ms - first.ms >= year && last.km > first.km) {
    return Math.round((last.km - first.km) / ((last.ms - first.ms) / year));
  }
  return null;
}

/** Eļļas maiņu segums: secīgu maiņu km / nobraukums līdz pēdējam ierakstam (%). */
function oilCoverageOf(block: AutoRecordsBlockState, rows: readonly AutoRecordsServiceWorkRow[], nowMs: number): number | null {
  const series = buildOilIntervalSeriesForBlock(block, { nowMs });
  if (series.changeCount < 2) return series.changeCount === 1 ? 0 : null;
  const covered = (series.coverOkKm ?? 0) + (series.coverOverKm ?? 0);
  const maxKm = Math.max(0, ...rows.map((r) => parseKm(r.odometer) ?? 0));
  const denom = Math.max(maxKm, series.coverSpanKm ?? 0);
  if (denom <= 0) return null;
  return Math.max(0, Math.min(100, Math.round((covered / denom) * 100)));
}

export type DealerReviewContext = {
  /** AUDITS piemaksa (dealer_to_audit / mini_to_audit) samaksāta. */
  auditsPurchased?: boolean;
  complaint?: boolean;
  /** Pasūtījuma brīdis (ms); citādi darba izveides laiks. */
  orderDateMs?: number | null;
  /** Visu avotu teksti (reģistri: NL «Taxi: Ja», DK «Taxikørsel»). */
  extraTexts?: readonly string[];
};

export function buildDealerReviewScoreInput(args: {
  autoRecords: AutoRecordsBlockState | null | undefined;
  job: Pick<DealerDataJob, "status" | "refund" | "createdAt" | "vin" | "shadowGate"> | null;
  vin?: string | null;
  context?: DealerReviewContext;
  nowMs?: number;
}): DealerReviewScoreInput {
  const nowMs = args.nowMs ?? Date.now();
  const ctx = args.context ?? {};
  const block = args.autoRecords ?? null;
  const rows = block ? printableDealerServiceWorks(block.serviceWorks ?? []) : [];
  const job = args.job;
  const createdMs = job?.createdAt ? Date.parse(job.createdAt) : NaN;
  const orderDateMs = ctx.orderDateMs && ctx.orderDateMs > 0 ? ctx.orderDateMs : Number.isFinite(createdMs) ? createdMs : nowMs;

  const dataState: DealerReviewScoreInput["dataState"] =
    rows.length > 0 ? "data" : job?.status === "no_data" || job?.status === "done" ? "no_data" : job ? "not_ready" : "no_data";

  const rawEvents = block?.oneautoIngest?.serviceTimelineOriginal ?? [];
  const facts = rows.length > 0 ? extractDealerFactsFromServiceWorks(rows, rawEvents) : null;
  const summary = rows.length > 0 ? buildDealerVisitSummary(rows, facts, null, orderDateMs) : null;

  const majorWorks = (summary?.majorWorks ?? [])
    .filter((h) => dealerMajorWorkCategory(h.id) !== "accident" && h.id !== "body_glass")
    .map((h) => ({ label: h.label, date: h.date, km: h.km }));

  const odometerDrops = findDealerOdometerDrops(rows).map((d) => ({
    fromKm: d.previousKm,
    toKm: d.km,
    fromDate: d.previous.date,
    toDate: d.row.date,
    significant: d.severity === "significant",
  }));

  const paintSigns = rows
    .filter((r) => isDealerPaintWork(r.works) || isAccidentRepairWork(r.works))
    .map((r) => ({ date: r.date }))
    .sort((a, b) => parseDotOrIsoDateToMs(a.date) - parseDotOrIsoDateToMs(b.date));

  const vin = (args.vin ?? job?.vin ?? block?.outvinReport?.vehicleInfo?.vinCode ?? "").trim();
  const equipment = block?.outvinReport?.equipment ?? [];
  const ownTexts = [block?.rawUnprocessedData ?? "", block?.aiContextRaw ?? ""];
  const extraTexts = [...ownTexts, ...(ctx.extraTexts ?? [])];
  const taxiSignals = detectDealerTaxiSignals({ vin, equipment, texts: extraTexts });
  const totalLoss = dealerTextsHaveTotalLoss([
    ...rows.map((r) => foldDealerWorkText(r.works)),
    block?.outvinReport?.accidentCheck ?? "",
  ]);

  const gate = job?.shadowGate ?? null;
  return {
    dataState,
    refunded: Boolean(job?.refund),
    complaint: Boolean(ctx.complaint),
    recordCount: rows.length,
    firstDate: summary?.firstDate ?? "",
    lastDate: summary?.lastDate ?? "",
    orderDateMs,
    majorWorks,
    odometerDrops,
    campaignsDone: Boolean(summary?.campaignsDone),
    oilCoveragePct: block && rows.length > 0 ? oilCoverageOf(block, rows, orderDateMs) : null,
    paintSigns,
    taxiSignals,
    annualKm: annualKmOf(rows, block?.outvinReport?.vehicleInfo?.firstRegistration ?? ""),
    totalLoss,
    auditsPurchased: Boolean(ctx.auditsPurchased),
    shadowVerdict: gate?.verdict ?? null,
    shadowHoldReason: firstHoldReason(gate),
  };
}

/** Viss vienā: melnraksta dīlera bloks + darbs -> ieteikums. */
export function computeDealerReviewScore(args: Parameters<typeof buildDealerReviewScoreInput>[0]): DealerReviewScore {
  return scoreDealerReview(buildDealerReviewScoreInput(args));
}
