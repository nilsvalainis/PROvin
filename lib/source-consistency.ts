/**
 * Pretrunas starp avotiem pirms atskaites sūtīšanas klientam (Nila «A» 23.11.2026).
 *
 * Tīra funkcija: ievade = pasūtījuma avotu bloki (+ AI/komentāru teksti), izvade = pretrunu saraksts
 * (punkts, avoti, vērtības, smagums). Tikai fakti adminam - nekādu ieteikumu klientam, neko nemaina.
 * Gadījumi no 23.11: OneAuto datumi nākotnē, viltus CSNg, «Pārdots» bez pamata, piedziņa AI tekstā (4MATIC).
 *
 * Smagums:
 * - `critical` - klientam nedrīkst aiziet bez pārbaudes (nobraukuma kritums starp avotiem, cita marka,
 *   degviela / dzinējs / piedziņa AI tekstā pretrunā ar datiem, datums nākotnē drukājamā laika joslā);
 * - `warn` - avoti nesakrīt, jāpaskatās;
 * - `info` - zināma avotu dabiska atšķirība (skaitā neietilpst, sarakstā pelēks).
 */
import { adminRichHtmlToPlainText } from "@/lib/admin-rich-comment-html";
import {
  mergeSourceBlocksWithDefaults,
  SOURCE_BLOCK_LABELS,
  toPdfLtabManualBlock,
  toPdfManualVendorBlocks,
  type WorkspaceSourceBlocks,
} from "@/lib/admin-source-blocks";
import { archiveFieldGetter, auctionArchiveLotFacts } from "@/lib/auction-archive-facts";
import { extractCountryFromLocation } from "@/lib/auto-records-paste-parse";
import { CC_VIN_ADMIN_LABEL } from "@/lib/cc-vin-report";
import { parseDotOrIsoDateToMs } from "@/lib/clean-date-str";
import {
  classifyFuelKind,
  extractLoadedPowertrainIdentity,
  findPowertrainContradictions,
  type PowertrainFuelKind,
} from "@/lib/comment-powertrain-guard";
import { countryLabelToIso2, normalizeCountryNameLv } from "@/lib/country-names-lv";
import { parseCsddRegistrySignals } from "@/lib/csdd-registry-signals";
import { isImpossibleFutureDate } from "@/lib/future-date-guard";
import { csddHasLatvianRegistryRecord, extractExplicitOwnerCount, ownerEventMonthKey } from "@/lib/owner-count-synthesis";
import { findOwnerClaimIssues } from "@/lib/owner-claims-check";
import { printableDealerServiceWorks } from "@/lib/pdf-dealer-service-visits";
import { extractVehicleDrivetrain, findDrivetrainContradictions, resolveVehicleDrivetrain } from "@/lib/registry-drivetrain";
import { thecarapiSalePriceFromFields } from "@/lib/thecarapi-sale-price";
import {
  collectUnifiedMileageRows,
  looksLikeExtraDigitOdometerTypo,
  parseOdometerKm,
  type UnifiedMileageRow,
} from "@/lib/unified-mileage";
import { buildVehicleLifecycleEvents } from "@/lib/vehicle-lifecycle-timeline";
import type { ThecarapiAdminRecord } from "@/lib/vin-scan/thecarapi-fields";

export type SourceIssueSeverity = "critical" | "warn" | "info";

export type SourceIssueKind =
  | "owners"
  | "mileage_drop"
  | "mileage_same_day"
  | "future_date"
  | "country"
  | "first_registration"
  | "model_year"
  | "make"
  | "power"
  | "displacement"
  | "fuel"
  | "drivetrain"
  | "ai_powertrain"
  | "ai_drivetrain"
  | "ai_owners"
  | "damage"
  | "csng"
  | "auction_price";

export type SourceIssueValue = { source: string; value: string };

export type SourceIssue = {
  /** Stabils atslēgas id (UI / statistikai). */
  id: string;
  kind: SourceIssueKind;
  severity: SourceIssueSeverity;
  /** Īss punkts latviski. */
  title: string;
  values: SourceIssueValue[];
};

export type SourceConsistencyInput = {
  vin?: string | null;
  sourceBlocks: WorkspaceSourceBlocks | null | undefined;
  /** Klienta PDF teksti (AI komentāri u.c.) - tikai piedziņas / dzinēja / degvielas pretrunām. */
  texts?: readonly { label: string; text: string }[] | null;
  listingUrl?: string | null;
  nowMs?: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;
/** Viena datuma rādījumi: atšķirība virs 1 % (un virs 100 km) ir pretruna. */
export const SAME_DAY_KM_DIFF_RATIO = 0.01;
const SAME_DAY_KM_DIFF_MIN = 100;
/** Kritums starp avotiem: vismaz 1 000 km un 2 % no agrākā rādījuma. */
export const CROSS_SOURCE_DROP_MIN_KM = 1000;
const CROSS_SOURCE_DROP_RATIO = 0.02;
/** Kritums no 5 000 km vai 5 % - kritisks. */
const CROSS_SOURCE_DROP_CRITICAL_KM = 5000;
const CROSS_SOURCE_DROP_CRITICAL_RATIO = 0.05;
/** Pirmās reģistrācijas datumi: pielaide 45 dienas (mēneša precizitāte avotos). */
const FIRST_REG_TOLERANCE_MS = 45 * DAY_MS;

export const SOURCE_ISSUE_SEVERITY_ORDER: Record<SourceIssueSeverity, number> = { critical: 0, warn: 1, info: 2 };

function fmtInt(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function fmtKm(n: number): string {
  return `${fmtInt(n)} km`;
}

function dayLabel(ms: number): string {
  const d = new Date(ms);
  const p = (x: number) => String(x).padStart(2, "0");
  return `${p(d.getUTCDate())}.${p(d.getUTCMonth() + 1)}.${d.getUTCFullYear()}`;
}

/** «2020-12-09», «09.12.2020», «12.2020», «2020-12» → ms (mēnesim - 1. datums) vai 0. */
function dateMs(raw: string | null | undefined): number {
  const t = (raw ?? "").trim().replace(/\.$/, "");
  if (!t) return 0;
  const full = parseDotOrIsoDateToMs(t.slice(0, 10));
  if (full > 0) return full;
  const my = t.match(/^(\d{1,2})[./](\d{4})$/);
  if (my) return Date.UTC(Number(my[2]), Number(my[1]) - 1, 1);
  const ym = t.match(/^(\d{4})-(\d{1,2})$/);
  if (ym) return Date.UTC(Number(ym[1]), Number(ym[2]) - 1, 1);
  return 0;
}

function yearOf(raw: string | null | undefined): number | null {
  const ms = dateMs(raw);
  if (ms > 0) return new Date(ms).getUTCFullYear();
  const y = (raw ?? "").match(/\b(19[5-9]\d|20[0-4]\d)\b/);
  return y ? Number(y[1]) : null;
}

function num(raw: string | null | undefined): number | null {
  const s = (raw ?? "").replace(/[\s  ]/g, "").replace(",", ".");
  const m = s.match(/^-?\d+(?:\.\d+)?/);
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : null;
}

/** «90 kW (122 ZS)», «90KW», «122 PS» → kW. */
function powerKw(raw: string | null | undefined): number | null {
  const t = (raw ?? "").replace(/\s+/g, " ");
  if (!t.trim()) return null;
  const kw = t.match(/(\d{2,3}(?:[.,]\d)?)\s*kw/i);
  if (kw) return num(kw[1]);
  const ps = t.match(/(\d{2,4})\s*(?:ps|hp|zs|ch|cv)\b/i);
  if (ps) {
    const n = num(ps[1]);
    return n ? Math.round(n / 1.35962) : null;
  }
  const bare = num(t);
  return bare && bare >= 20 && bare <= 800 ? bare : null;
}

function iso2(raw: string | null | undefined): string {
  const t = (raw ?? "").trim();
  if (!t) return "";
  if (/^[A-Za-z]{2}$/.test(t)) return t.toUpperCase();
  return countryLabelToIso2(t) ?? countryLabelToIso2(normalizeCountryNameLv(t)) ?? "";
}

function countryLv(code: string): string {
  return normalizeCountryNameLv(code) || code;
}

function normMake(raw: string): string {
  const t = raw.toUpperCase().replace(/[^A-Z ]/g, " ").replace(/\s+/g, " ").trim();
  if (!t) return "";
  if (/^MERCEDES|^MB\b|^DAIMLER/.test(t)) return "MERCEDES";
  if (/^VW\b|^VOLKSWAGEN/.test(t)) return "VOLKSWAGEN";
  if (/^LAND ROVER|^RANGE ROVER/.test(t)) return "LAND ROVER";
  return t.split(" ")[0] ?? "";
}

const FUEL_LV: Record<PowertrainFuelKind, string> = {
  petrol: "benzīns",
  diesel: "dīzelis",
  electric: "elektro",
  hybrid: "hibrīds",
  lpg: "gāze",
  unknown: "",
};

type Lot = {
  record: ThecarapiAdminRecord;
  label: string;
  dateMs: number;
  get: ReturnType<typeof archiveFieldGetter>;
};

function auctionLots(records: readonly ThecarapiAdminRecord[] | undefined): Lot[] {
  return (records ?? []).map((r) => {
    const get = archiveFieldGetter(r);
    const dms =
      dateMs(get.exact("auction_end_at", "end_date", "sale_date", "auction_date")) ||
      dateMs(r.date) ||
      dateMs(get.exact("last_seen_at", "first_seen_at"));
    const site = (r.site || r.venue || "Izsole").trim();
    return { record: r, label: dms ? `${site} ${dayLabel(dms)}` : site, dateMs: dms, get };
  });
}

function push(out: SourceIssue[], issue: SourceIssue): void {
  if (issue.values.length === 0) return;
  if (out.some((x) => x.id === issue.id)) return;
  out.push(issue);
}

/* ---------- 1. Īpašnieku skaits Latvijā ---------- */

const OWNER_CHANGE_RE =
  /main[īi]tas?\s+[īi]pa[sš]umties|[īi]pa[sš]nieka\s+mai[nņ]|ownership\s+change|owner\s+change|new\s+owner|jauns\s+[īi]pa[sš]nieks/i;
const LATVIA_RE = /^\s*(?:latvij|latvia|lv\b|lettland|латви)/i;
const VENDOR_LV_COUNT_RES = [
  /latvij[āa]\s*[:\-–]?\s*(\d{1,2})\s*[īi]pa[sš]niek/i,
  /(\d{1,2})\s*[īi]pa[sš]niek\w*\s+latvij/i,
  /owners?\s+in\s+latvia\s*[:\-]?\s*(\d{1,2})/i,
];

function checkOwners(blocks: WorkspaceSourceBlocks, out: SourceIssue[]): void {
  const csdd = blocks.csdd;
  if (!csddHasLatvianRegistryRecord(csdd)) return;
  const csddCount = extractExplicitOwnerCount(csdd.ownerCountLatvia ?? "");
  const events = (csdd.ownerRegistrationEvents ?? []).filter((e) => e.date.trim() || e.label.trim());
  const csddMonths = new Set(events.map((e) => ownerEventMonthKey(e.date)).filter((x): x is string => Boolean(x)));
  const statementMonth = csddStatementMonth(csdd);

  const values: SourceIssueValue[] = [];
  if (csddCount != null) values.push({ source: "CSDD", value: `${csddCount}` });

  const vendorCounts: SourceIssueValue[] = [];
  for (const key of ["carvertical", "autodna"] as const) {
    const b = blocks[key];
    const text = adminRichHtmlToPlainText(b.comments ?? "");
    let explicit: number | null = null;
    for (const re of VENDOR_LV_COUNT_RES) {
      const m = text.match(re);
      if (m?.[1]) {
        explicit = Number(m[1]);
        break;
      }
    }
    const lvMonths = new Set<string>();
    for (const t of b.vehicleHistoryTimeline ?? []) {
      if (!LATVIA_RE.test(t.country ?? "") || !OWNER_CHANGE_RE.test(t.description ?? "")) continue;
      const k = ownerEventMonthKey(t.date);
      if (k) lvMonths.add(k);
    }
    if (explicit != null) {
      if (csddCount != null && explicit !== csddCount) vendorCounts.push({ source: SOURCE_BLOCK_LABELS[key], value: `${explicit}` });
      continue;
    }
    if (lvMonths.size === 0) continue;
    // 24.11: notikumu salīdzinājums abos virzienos (±1 mēnesis - CarVertical datums ir mēneša precizitātē).
    const vendorOnly = [...lvMonths].filter((m) => !monthNear(m, csddMonths)).sort();
    const csddOnly = [...csddMonths].filter((m) => !monthNear(m, lvMonths)).sort();
    const label = SOURCE_BLOCK_LABELS[key];
    // Bez CSDD notikumu saraksta nevar teikt, ka CSDD maiņas nav - tad tikai skaita salīdzinājums.
    const beforeStatement = statementMonth && csddMonths.size > 0 ? vendorOnly.filter((m) => m <= statementMonth) : [];
    const afterStatement = vendorOnly.filter((m) => !beforeStatement.includes(m));
    if (beforeStatement.length > 0) {
      // CSDD izziņa ir vēlāka par notikumu, bet maiņas CSDD nav - visticamāk reģistrācijas apliecības izmaiņa.
      push(out, {
        id: `owners_lv_cert_${key}`,
        kind: "owners",
        severity: "info",
        title: `${label} notikums var būt reģistrācijas apliecības izmaiņa (CSDD izziņā īpašnieka maiņas nav)`,
        values: [
          ...values,
          { source: label, value: beforeStatement.map(monthLabel).join(", ") },
        ],
      });
    }
    if (afterStatement.length > 0 && csddCount != null && lvMonths.size > csddCount) {
      // Vairāk maiņu Latvijā nekā CSDD īpašnieku un CSDD izziņa nav jaunāka par notikumu - pārbaudīt.
      vendorCounts.push({
        source: label,
        value: `${lvMonths.size} maiņas Latvijā (${afterStatement.map(monthLabel).join(", ")} CSDD nav)`,
      });
    }
    if (csddOnly.length > 0) {
      push(out, {
        id: `owners_lv_csdd_only_${key}`,
        kind: "owners",
        severity: "info",
        title: `CSDD īpašnieka maiņa, kuras nav ${label}`,
        values: [{ source: "CSDD", value: csddOnly.map(monthLabel).join(", ") }],
      });
    }
  }
  if (csddCount == null || vendorCounts.length === 0) return;
  push(out, {
    id: "owners_lv",
    kind: "owners",
    severity: "warn",
    title: "Īpašnieku skaits Latvijā nesakrīt",
    values: [...values, ...vendorCounts],
  });
}

function monthLabel(m: string): string {
  return m.split("-").reverse().join(".");
}

function monthIndex(m: string): number {
  const [y, mo] = m.split("-").map(Number);
  return (y ?? 0) * 12 + (mo ?? 0);
}

function monthNear(m: string, set: ReadonlySet<string>): boolean {
  const i = monthIndex(m);
  for (const x of set) if (Math.abs(monthIndex(x) - i) <= 1) return true;
  return false;
}

/** CSDD izziņas mēnesis: reģistra ielases laiks vai „Informācija sagatavota elektroniski DD.MM.YYYY”. */
function csddStatementMonth(csdd: WorkspaceSourceBlocks["csdd"]): string | null {
  const cands: string[] = [];
  const fetched = (csdd.registry as { fetchedAt?: string } | undefined)?.fetchedAt ?? "";
  if (/^\d{4}-\d{2}/.test(fetched)) cands.push(fetched.slice(0, 7));
  for (const m of (csdd.rawUnprocessedData ?? "").matchAll(/sagatavota\s+elektroniski\s+(\d{2})\.(\d{2})\.(\d{4})/gi)) {
    cands.push(`${m[3]}-${m[2]}`);
  }
  return cands.length ? cands.sort().at(-1)! : null;
}

/* ---------- 2. Nobraukums ---------- */

function mileageRows(blocks: WorkspaceSourceBlocks, listingUrl: string | null | undefined): UnifiedMileageRow[] {
  return collectUnifiedMileageRows({
    csddForm: blocks.csdd,
    autoRecordsBlock: blocks.auto_records,
    oneautoBlock: blocks.oneauto,
    ccVinBlock: blocks.cc_vin,
    asvBlock: blocks.asv,
    manualVendorBlocks: toPdfManualVendorBlocks(blocks),
    citiAvotiBlock: blocks.citi_avoti,
    tirgusForm: blocks.tirgus,
    listingUrl: listingUrl ?? null,
  });
}

/** Viens avots - viena «ģimene» (dīlera vizītes un dīlera tabula ir tas pats avots). */
function sourceFamily(label: string): string {
  return label
    .replace(/\s*\(sludinājums\)\s*$/i, "")
    .replace(/\s*-\s*vizīte.*$/i, "")
    .trim()
    .toUpperCase();
}

function checkMileage(rows: UnifiedMileageRow[], out: SourceIssue[]): void {
  type R = { row: UnifiedMileageRow; km: number; t: number; fam: string; month: boolean };
  const list: R[] = [];
  for (const row of rows) {
    if ((row as { visitOdometer?: boolean }).visitOdometer) continue;
    const km = parseOdometerKm(row.odometer);
    if (km == null || km <= 0 || !(row.sortableTime > 0)) continue;
    list.push({ row, km, t: row.sortableTime, fam: sourceFamily(row.sourceLabel), month: row.datePrecision === "month" });
  }
  list.sort((a, b) => a.t - b.t || a.km - b.km);

  // a) Viena datuma rādījumi dažādos avotos.
  const byDay = new Map<string, R[]>();
  for (const r of list) {
    if (r.month) continue;
    const k = dayLabel(r.t);
    byDay.set(k, [...(byDay.get(k) ?? []), r]);
  }
  for (const [day, group] of byDay) {
    const fams = new Set(group.map((g) => g.fam));
    if (fams.size < 2) continue;
    const kms = group.map((g) => g.km);
    const hi = Math.max(...kms);
    const lo = Math.min(...kms);
    if (hi - lo <= Math.max(SAME_DAY_KM_DIFF_MIN, hi * SAME_DAY_KM_DIFF_RATIO)) continue;
    const seen = new Set<string>();
    const values: SourceIssueValue[] = [];
    for (const g of group) {
      const key = `${g.fam}|${g.km}`;
      if (seen.has(key)) continue;
      seen.add(key);
      values.push({ source: g.row.sourceLabel, value: fmtKm(g.km) });
    }
    push(out, {
      id: `mileage_same_day_${day}`,
      kind: "mileage_same_day",
      severity: "warn",
      title: `${day} dažādi rādījumi`,
      values,
    });
  }

  // b) Vēlāks rādījums citā avotā mazāks par agrāku (ne viena avota iekšienē - to rāda odometra anomālijas).
  const best = new Map<string, { a: R; b: R; drop: number }>();
  for (let j = 0; j < list.length; j++) {
    const b = list[j]!;
    if (b.row.documentValue) continue;
    for (let i = 0; i < j; i++) {
      const a = list[i]!;
      if (a.fam === b.fam || a.row.documentValue) continue;
      const gap = a.month || b.month ? 62 * DAY_MS : 31 * DAY_MS;
      if (b.t - a.t < gap) continue;
      const drop = a.km - b.km;
      const min = Math.max(CROSS_SOURCE_DROP_MIN_KM, a.km * CROSS_SOURCE_DROP_RATIO);
      if (drop < min) continue;
      // Ja kritums redzams jau viena avota iekšienē, to rāda odometra anomāliju pārbaude (nav avotu pretruna).
      const sameFamDrop = (fam: string) =>
        list.some((x) => x.fam === fam && x.t < b.t && x.km >= b.km + min) &&
        list.some((x) => x.fam === fam && x.t > a.t && x.km <= a.km - min);
      if (sameFamDrop(a.fam) || sameFamDrop(b.fam)) continue;
      const key = `${a.fam}>${b.fam}`;
      const prev = best.get(key);
      if (!prev || drop > prev.drop) best.set(key, { a, b, drop });
    }
  }
  // Viena kritums, ko vairāki avoti pārkopējuši, ir viens punkts (pēc vēlākā rādījuma km un mēneša).
  const byLater = new Map<string, { a: R; b: R; drop: number }>();
  for (const hit of best.values()) {
    const key = `${Math.round(hit.b.km / 500)}|${dayLabel(hit.b.t).slice(3)}`;
    const prev = byLater.get(key);
    if (!prev || hit.drop > prev.drop) byLater.set(key, hit);
  }
  for (const { a, b, drop } of byLater.values()) {
    const typo = looksLikeExtraDigitOdometerTypo(Math.max(a.km, b.km), Math.min(a.km, b.km));
    // Sludinājuma km ir pārdevēja apgalvojums (bieži noapaļots) - nav kritisks fakts.
    const listing = /sludinājum/i.test(b.row.sourceLabel) || /sludinājum/i.test(a.row.sourceLabel) || Boolean(b.row.countryUnverified);
    const critical =
      !typo && !listing && (drop >= CROSS_SOURCE_DROP_CRITICAL_KM || drop >= a.km * CROSS_SOURCE_DROP_CRITICAL_RATIO);
    push(out, {
      id: `mileage_drop_${a.fam}_${b.fam}_${a.row.date}_${b.row.date}`,
      kind: "mileage_drop",
      severity: critical ? "critical" : "warn",
      title: typo
        ? `Nobraukums samazinās starp avotiem (iespējama ievades kļūda), −${fmtKm(drop)}`
        : `Nobraukums samazinās starp avotiem, −${fmtKm(drop)}`,
      values: [
        { source: a.row.sourceLabel, value: `${fmtKm(a.km)} (${a.row.date})` },
        { source: b.row.sourceLabel, value: `${fmtKm(b.km)} (${b.row.date})` },
      ],
    });
  }
}

/* ---------- 2b. Datumi nākotnē (drukājamajā laika joslā / tabulās nedrīkst palikt) ---------- */

function checkFutureDates(blocks: WorkspaceSourceBlocks, nowMs: number, listingUrl: string | null | undefined, out: SourceIssue[]): void {
  const values: SourceIssueValue[] = [];
  let inTimeline = false;
  try {
    const events = buildVehicleLifecycleEvents({
      csddForm: blocks.csdd,
      autoRecordsBlock: blocks.auto_records,
      oneautoBlock: blocks.oneauto,
      ccVinBlock: blocks.cc_vin,
      asvBlock: blocks.asv,
      manualVendorBlocks: toPdfManualVendorBlocks(blocks),
      manualLtabBlock: toPdfLtabManualBlock(blocks.ltab),
      citiAvoti: blocks.citi_avoti,
      tirgusForm: blocks.tirgus,
      listingUrl: listingUrl ?? null,
    });
    for (const e of events) {
      if (e.date && isImpossibleFutureDate(e.date, nowMs)) {
        inTimeline = true;
        values.push({ source: `Laika josla (${e.sources.join(", ") || e.title})`, value: e.date });
      }
    }
  } catch {
    /* laika josla nav obligāta pārbaudei */
  }
  for (const w of printableDealerServiceWorks(blocks.auto_records.serviceWorks ?? [])) {
    if (isImpossibleFutureDate(w.date, nowMs)) values.push({ source: SOURCE_BLOCK_LABELS.auto_records, value: w.date });
  }
  for (const key of ["carvertical", "autodna"] as const) {
    const b = blocks[key];
    for (const r of [...(b.serviceHistory ?? []), ...(b.incidents ?? []).map((x) => ({ date: x.csngDate }))]) {
      if (isImpossibleFutureDate(r.date, nowMs)) values.push({ source: SOURCE_BLOCK_LABELS[key], value: r.date });
    }
  }
  for (const r of blocks.cc_vin.sales ?? []) {
    if (isImpossibleFutureDate(r.date, nowMs)) values.push({ source: CC_VIN_ADMIN_LABEL, value: r.date });
  }
  for (const r of blocks.ltab.rows ?? []) {
    if (isImpossibleFutureDate(r.csngDate, nowMs)) values.push({ source: SOURCE_BLOCK_LABELS.ltab, value: r.csngDate });
  }
  if (values.length === 0) return;
  const uniq = values.filter((v, i) => values.findIndex((x) => x.source === v.source && x.value === v.value) === i);
  push(out, {
    id: "future_dates",
    kind: "future_date",
    severity: inTimeline ? "critical" : "warn",
    title: "Datums nākotnē",
    values: uniq.slice(0, 8),
  });
}

/* ---------- 3. Valsts / ievešana ---------- */

function checkCountry(blocks: WorkspaceSourceBlocks, lots: Lot[], out: SourceIssue[]): void {
  const prev = iso2(blocks.csdd.previousRegistrationCountry);
  if (!prev || prev === "LV") return;
  // Valstis, kur auto bijis pēc vēstures avotiem. Dīlera «Valsts / reģions» (ražotāja tirgus) apzināti NEŅEM.
  const seen = new Map<string, Set<string>>();
  const add = (code: string, source: string) => {
    if (!code || code === "LV") return;
    seen.set(code, (seen.get(code) ?? new Set()).add(source));
  };
  for (const w of blocks.auto_records.serviceWorks ?? []) add(iso2(extractCountryFromLocation(w.location ?? "")), "Dīlera vizītes");
  for (const r of blocks.auto_records.serviceHistory ?? []) add(iso2(r.country), "Dīlera vizītes");
  for (const l of lots) add(iso2(auctionArchiveLotFacts(l.record).country), "Izsoles");
  for (const key of ["carvertical", "autodna"] as const) {
    const b = blocks[key];
    for (const r of b.serviceHistory ?? []) add(iso2(r.country), SOURCE_BLOCK_LABELS[key]);
    for (const r of b.vehicleHistoryTimeline ?? []) add(iso2(r.country), SOURCE_BLOCK_LABELS[key]);
  }
  for (const r of blocks.cc_vin.mileage ?? []) add(iso2(r.country), CC_VIN_ADMIN_LABEL);
  const regs: [keyof WorkspaceSourceBlocks, string][] = [
    ["tjekbil", "DK"],
    ["carinfo", "SE"],
    ["mnt_ee", "EE"],
    ["lkf_ee", "EE"],
    ["traficom_fi", "FI"],
    ["finnik", "NL"],
  ];
  for (const [k, code] of regs) {
    const b = blocks[k] as { mileage?: { date?: string; odometer?: string }[]; timeline?: { date?: string; event?: string }[] };
    const has =
      (b.mileage ?? []).some((r) => r?.date?.trim() && r?.odometer?.trim()) ||
      (b.timeline ?? []).some((r) => r?.date?.trim() && r?.event?.trim());
    if (has) add(code, SOURCE_BLOCK_LABELS[k as keyof typeof SOURCE_BLOCK_LABELS]);
  }
  if (seen.size === 0 || seen.has(prev)) return;
  const values: SourceIssueValue[] = [{ source: "CSDD (iepriekšējā valsts)", value: countryLv(prev) }];
  for (const [code, sources] of seen) values.push({ source: [...sources].join(", "), value: countryLv(code) });
  push(out, {
    id: "country_prev",
    kind: "country",
    severity: "warn",
    title: "Iepriekšējā valsts CSDD neparādās citos avotos",
    values,
  });
}

/* ---------- 4. Pirmā reģistrācija / izlaiduma gads ---------- */

function checkFirstRegistration(blocks: WorkspaceSourceBlocks, lots: Lot[], out: SourceIssue[]): void {
  const vi = blocks.auto_records.outvinReport?.vehicleInfo;
  const cands: { source: string; raw: string; ms: number }[] = [];
  const add = (source: string, raw: string) => {
    const ms = dateMs(raw);
    if (ms > 0) cands.push({ source, raw: raw.trim(), ms });
  };
  add("CSDD", blocks.csdd.firstRegistration ?? "");
  add("Dīlera dati", vi?.firstRegistration ?? "");
  for (const l of lots) {
    add(l.label, l.get.exact("date_first_registration") || l.get.tail("firstregistration", "datefirstregistration"));
  }
  if (cands.length >= 2) {
    const sorted = [...cands].sort((a, b) => a.ms - b.ms);
    const span = sorted[sorted.length - 1]!.ms - sorted[0]!.ms;
    if (span > FIRST_REG_TOLERANCE_MS) {
      push(out, {
        id: "first_registration",
        kind: "first_registration",
        severity: "warn",
        title: "Pirmās reģistrācijas datums atšķiras",
        values: cands.map((c) => ({ source: c.source, value: dayLabel(c.ms) })),
      });
    }
  }

  // Izlaiduma gads CSDD pret ražošanas datumu (dīleris / izsole) un pirmo reģistrāciju.
  const modelYear = num(blocks.csdd.modelYear);
  if (modelYear && modelYear > 1950) {
    const prodRaw =
      vi?.productionDate ||
      lots.map((l) => l.get.tail("manufacturedate", "manufactured")).find(Boolean) ||
      "";
    const prodYear = yearOf(prodRaw);
    const regYear = yearOf(blocks.csdd.firstRegistration);
    const values: SourceIssueValue[] = [{ source: "CSDD (izlaiduma gads)", value: String(modelYear) }];
    let bad = false;
    if (prodYear && prodYear !== modelYear) {
      values.push({ source: "Ražošanas datums", value: prodRaw.trim() });
      bad = true;
    }
    if (regYear && modelYear > regYear + 1) {
      values.push({ source: "CSDD (pirmā reģistrācija)", value: String(regYear) });
      bad = true;
    }
    if (bad) {
      push(out, {
        id: "model_year",
        kind: "model_year",
        // Modeļa gads (VIN) bieži = ražošanas gads + 1: dabiska atšķirība, ja starpība 1 gads.
        severity: prodYear && Math.abs(prodYear - modelYear) === 1 && !(regYear && modelYear > regYear + 1) ? "info" : "warn",
        title: "Izlaiduma gads nesakrīt ar ražošanas / reģistrācijas datumu",
        values,
      });
    }
  }
}

/* ---------- 5. Marka / jauda / tilpums / degviela / piedziņa ---------- */

function checkVehicleIdentity(blocks: WorkspaceSourceBlocks, lots: Lot[], out: SourceIssue[]): void {
  const csdd = blocks.csdd;
  const vi = blocks.auto_records.outvinReport?.vehicleInfo;
  const csddMake = normMake(csdd.registry?.data?.make || csdd.makeModel || "");

  // Marka
  if (csddMake) {
    const bad: SourceIssueValue[] = [];
    for (const l of lots) {
      const raw = l.get.exact("clean_make", "car_identification.Make", "make") || l.get.tail("make", "brand");
      const m = normMake(raw);
      if (m && m !== csddMake && !m.startsWith(csddMake.slice(0, 4)) && !csddMake.startsWith(m.slice(0, 4))) {
        bad.push({ source: l.label, value: raw });
      }
    }
    if (bad.length) {
      push(out, {
        id: "make",
        kind: "make",
        severity: "critical",
        title: "Marka nesakrīt",
        values: [{ source: "CSDD", value: csdd.makeModel || csddMake }, ...bad],
      });
    }
  }

  // Degviela
  const fuelCands: { source: string; raw: string; kind: PowertrainFuelKind }[] = [];
  const addFuel = (source: string, raw: string) => {
    const kind = classifyFuelKind(raw ?? "");
    if (kind !== "unknown") fuelCands.push({ source, raw: raw.trim(), kind });
  };
  addFuel("CSDD", csdd.fuelType ?? "");
  addFuel("Dīlera dati", vi?.fuel ?? "");
  for (const l of lots) addFuel(l.label, l.get.exact("fuel_group", "car_identification.FuelTypeEn") || l.get.tail("fuel", "fueltype"));
  const kinds = new Set(fuelCands.map((c) => c.kind));
  if (kinds.size > 1) {
    // Hibrīds pret benzīnu / dīzeli / elektro - avoti bieži raksta tikai pamatdegvielu.
    const hard = [...kinds].filter((k) => k !== "hybrid" && k !== "lpg");
    const critical = hard.length > 1;
    push(out, {
      id: "fuel",
      kind: "fuel",
      severity: critical ? "critical" : "info",
      title: "Degviela nesakrīt",
      values: fuelCands.map((c) => ({ source: c.source, value: FUEL_LV[c.kind] || c.raw })),
    });
  }
  const electrified = [...kinds].some((k) => k === "hybrid" || k === "electric") || num(csdd.electricPowerKw) != null;

  // Jauda
  const powerCands: { source: string; kw: number }[] = [];
  const csddKw = powerKw(csdd.enginePowerKw);
  if (csddKw) powerCands.push({ source: "CSDD", kw: csddKw });
  const viKw = powerKw(vi?.power ?? "");
  if (viKw) powerCands.push({ source: "Dīlera dati", kw: viKw });
  for (const l of lots) {
    const kw = num(l.get.exact("kw") || l.get.tail("kw", "powerkw"));
    const hp = num(l.get.exact("hp") || l.get.tail("hp", "powerhp"));
    const v = kw && kw > 10 ? kw : hp && hp > 10 ? Math.round(hp / 1.35962) : null;
    if (v) powerCands.push({ source: l.label, kw: v });
  }
  if (powerCands.length >= 2) {
    const kws = powerCands.map((c) => c.kw);
    const hi = Math.max(...kws);
    const lo = Math.min(...kws);
    if (hi - lo > Math.max(5, hi * 0.05)) {
      push(out, {
        id: "power",
        kind: "power",
        severity: electrified ? "info" : "warn",
        title: "Jauda nesakrīt",
        values: powerCands.map((c) => ({ source: c.source, value: `${fmtInt(c.kw)} kW` })),
      });
    }
  }

  // Tilpums
  const ccCands: { source: string; cc: number }[] = [];
  const csddCc = num(csdd.engineDisplacementCm3);
  if (csddCc && csddCc > 400) ccCands.push({ source: "CSDD", cc: csddCc });
  for (const l of lots) {
    const cc = num(l.get.exact("cylinder_capacity") || l.get.tail("cylindercapacity", "enginecc"));
    if (cc && cc > 400) ccCands.push({ source: l.label, cc });
  }
  if (ccCands.length >= 2) {
    const ccs = ccCands.map((c) => c.cc);
    if (Math.max(...ccs) - Math.min(...ccs) > 100) {
      push(out, {
        id: "displacement",
        kind: "displacement",
        severity: "warn",
        title: "Dzinēja tilpums nesakrīt",
        values: ccCands.map((c) => ({ source: c.source, value: `${fmtInt(c.cc)} cm³` })),
      });
    }
  }

  // Piedziņa (24.11): visi avoti (rūpnīcas kodi, reģistrs, specifikācija, izsoles, katalogs). Nesakrīt -
  // brīdinājums ar visām vērtībām; AI teksta kritiskā pretruna tikai tad, ja piedziņa noteikta (checkAiTexts).
  const res = resolveVehicleDrivetrain(blocks);
  if (res.conflict) {
    const values: SourceIssueValue[] = [];
    const seen = new Set<string>();
    const order = [...res.evidence].sort((a, b) => Number(a.tier === "oem_catalog") - Number(b.tier === "oem_catalog"));
    for (const e of order) {
      const value = e.awd ? "pilnpiedziņa" : "viena ass";
      const k = `${e.source}|${value}`;
      if (seen.has(k)) continue;
      seen.add(k);
      values.push({ source: e.source, value });
    }
    push(out, {
      id: "drivetrain",
      kind: "drivetrain",
      // Tikai OneAuto katalogs (bez nopirkta aprīkojuma) runā pretī - dabiska atšķirība, ne kļūda.
      severity: res.conflictOnlyCatalog ? "info" : "warn",
      title: res.drivetrain
        ? `Piedziņa: avoti nesakrīt (noteikta pēc ${res.drivetrain.sourceLabel} - ${res.drivetrain.awd ? "pilnpiedziņa" : "viena ass"})`
        : "Piedziņa: avoti nesakrīt - piedziņa nav noteikta",
      values,
    });
  }
}

function checkAiTexts(
  blocks: WorkspaceSourceBlocks,
  vin: string | null | undefined,
  texts: readonly { label: string; text: string }[],
  out: SourceIssue[],
): void {
  if (texts.length === 0) return;
  const identity = extractLoadedPowertrainIdentity(blocks, { vin });
  const dt = extractVehicleDrivetrain(blocks);
  // Viens punkts katram pretrunas veidam; lauki (Risku analīze, Kopsavilkums ...) - vērtību sarakstā.
  const merged = new Map<string, SourceIssue>();
  const add = (id: string, kind: SourceIssueKind, title: string, label: string, sentence: string) => {
    const issue = merged.get(id) ?? { id, kind, severity: "critical" as const, title, values: [] };
    if (!issue.values.some((v) => v.source === label)) issue.values.push({ source: label, value: `«${sentence.slice(0, 160)}»` });
    merged.set(id, issue);
  };
  for (const t of texts) {
    const plain = adminRichHtmlToPlainText(t.text ?? "");
    if (!plain.trim()) continue;
    for (const hit of findPowertrainContradictions(plain, identity)) add(`ai_${hit.id}`, "ai_powertrain", hit.message, t.label, hit.sentence);
    for (const hit of findDrivetrainContradictions(plain, dt)) add("ai_drivetrain", "ai_drivetrain", hit.message, t.label, hit.sentence);
    // 24.11: īpašnieku skaits / „ārvalstīs pirms Latvijas” bez avota - brīdinājums (ne kritisks).
    for (const hit of findOwnerClaimIssues(plain, blocks)) {
      const id = `ai_${hit.id}`;
      const issue = merged.get(id) ?? { id, kind: "ai_owners" as const, severity: "warn" as const, title: hit.message, values: [] };
      if (!issue.values.some((v) => v.source === t.label)) issue.values.push({ source: t.label, value: `«${hit.sentence.slice(0, 160)}»` });
      merged.set(id, issue);
    }
  }
  for (const issue of merged.values()) push(out, issue);
}

/* ---------- 6. Bojājumi / CSNg ---------- */

function checkDamages(blocks: WorkspaceSourceBlocks, lots: Lot[], nowMs: number, out: SourceIssue[]): void {
  // Ierakstītie negadījumi / bojājumi citos avotos (datums + avots).
  const records: { source: string; ms: number; date: string }[] = [];
  for (const key of ["autodna", "carvertical"] as const) {
    const b = blocks[key];
    for (const r of b.incidents ?? []) {
      const ms = dateMs(r.csngDate);
      if (ms > 0) records.push({ source: SOURCE_BLOCK_LABELS[key], ms, date: r.csngDate.trim() });
    }
    for (const r of b.damageDetails ?? []) {
      const ms = dateMs(r.date);
      if (ms > 0) records.push({ source: SOURCE_BLOCK_LABELS[key], ms, date: r.date.trim() });
    }
  }
  for (const r of blocks.ltab.rows ?? []) {
    const ms = dateMs(r.csngDate);
    if (ms > 0) records.push({ source: SOURCE_BLOCK_LABELS.ltab, ms, date: r.csngDate.trim() });
  }

  for (const l of lots) {
    const facts = auctionArchiveLotFacts(l.record);
    if (facts.damagesDeclared !== false) continue;
    const before = records.filter((r) => !l.dateMs || r.ms <= l.dateMs);
    if (before.length === 0) continue;
    const uniq = before.filter((r, i) => before.findIndex((x) => x.source === r.source && x.date === r.date) === i);
    push(out, {
      id: `damage_auction_${l.record.id || l.label}`,
      kind: "damage",
      severity: "warn",
      title: "Izsolē bojājumi nav norādīti, citos avotos ir negadījumi",
      values: [{ source: l.label, value: "bojājumi nav norādīti" }, ...uniq.slice(0, 5).map((r) => ({ source: r.source, value: r.date }))],
    });
  }

  // CSNg: e.csdd «Informācija no apdrošinātājiem / policijas» pret LTAB.
  const signals = parseCsddRegistrySignals(blocks.csdd, nowMs);
  const ltabRows = (blocks.ltab.rows ?? []).filter((r) => r.csngDate.trim() || r.incidentNo.trim());
  const ltabChecked = Boolean(blocks.ltab.certificate) || ltabRows.length > 0;
  const csdd = signals.csngInsurers;
  if (csdd.state === "none" && ltabRows.length > 0) {
    push(out, {
      id: "csng_none_vs_ltab",
      kind: "csng",
      // LTAB rāda arī OCTA atlīdzības citiem (šis auto vainīgais) - CSDD «Būtiski bojājumi» tos neietver.
      severity: "info",
      title: "CSNg: CSDD «nav», LTAB ir ieraksti",
      values: [
        { source: "CSDD (apdrošinātāji)", value: "nav" },
        { source: SOURCE_BLOCK_LABELS.ltab, value: ltabRows.map((r) => r.csngDate.trim()).filter(Boolean).slice(0, 5).join(", ") || `${ltabRows.length}` },
      ],
    });
  }
  if (csdd.state === "present" && ltabChecked && ltabRows.length === 0) {
    push(out, {
      id: "csng_present_vs_ltab",
      kind: "csng",
      // KASKO atlīdzība CSDD sadaļā var būt bez LTAB (OCTA) ieraksta.
      severity: "info",
      title: "CSNg: CSDD «ir», LTAB ierakstu nav",
      values: [
        { source: "CSDD (apdrošinātāji)", value: csdd.text.slice(0, 120) || "ir" },
        { source: SOURCE_BLOCK_LABELS.ltab, value: "nav" },
      ],
    });
  }
}

/* ---------- 7. Izsoļu cenas ---------- */

function checkAuctionPrices(blocks: WorkspaceSourceBlocks, lots: Lot[], out: SourceIssue[]): void {
  for (const l of lots) {
    const sp = thecarapiSalePriceFromFields(l.record.fields);
    if (sp.eur == null) continue;
    // Pārdošanas tabulas rinda (agrāk importēta), kas norāda uz šo izsoli: cena / statuss jāsakrīt ar ierakstu.
    const row = (blocks.cc_vin.sales ?? []).find(
      (r) => l.record.id && r.status.split(" · ").map((x) => x.trim()).includes(l.record.id),
    );
    if (sp.conflict) {
      push(out, {
        id: `auction_price_public_${l.record.id || l.label}`,
        kind: "auction_price",
        // PDF publisko cenu nerāda (thecarapi-sale-price.ts) - avota dabiska atšķirība.
        severity: "info",
        title: "Izsoles cenu lauki atšķiras",
        values: [
          { source: `${l.label} (${sp.label.toLowerCase()})`, value: `${fmtInt(sp.eur)} €` },
          { source: `${l.label} (publiskā cena)`, value: `${fmtInt(sp.publicEur ?? 0)} €` },
          ...(row?.price.trim() ? [{ source: "Pārdošanas tabula", value: row.price.trim() }] : []),
        ],
      });
    }
  }
}

/* ---------- kopā ---------- */

export function checkSourceConsistency(input: SourceConsistencyInput): SourceIssue[] {
  const blocks = mergeSourceBlocksWithDefaults(input.sourceBlocks ?? ({} as WorkspaceSourceBlocks));
  const nowMs = input.nowMs ?? Date.now();
  const lots = auctionLots(blocks.cc_vin.thecarapiRecords);
  const out: SourceIssue[] = [];
  const steps: (() => void)[] = [
    () => checkOwners(blocks, out),
    () => checkMileage(mileageRows(blocks, input.listingUrl), out),
    () => checkFutureDates(blocks, nowMs, input.listingUrl, out),
    () => checkCountry(blocks, lots, out),
    () => checkFirstRegistration(blocks, lots, out),
    () => checkVehicleIdentity(blocks, lots, out),
    () => checkAiTexts(blocks, input.vin, input.texts ?? [], out),
    () => checkDamages(blocks, lots, nowMs, out),
    () => checkAuctionPrices(blocks, lots, out),
  ];
  for (const step of steps) {
    // Viena pārbaude ar negaidītiem datiem nedrīkst apturēt pārējās (un nekad - PDF / sūtīšanu).
    try {
      step();
    } catch {
      /* ignorē */
    }
  }
  return out.sort((a, b) => SOURCE_ISSUE_SEVERITY_ORDER[a.severity] - SOURCE_ISSUE_SEVERITY_ORDER[b.severity]);
}

/** Skaitā tikai kritiskās un brīdinājumi (info - dabiskas avotu atšķirības). */
export function countSourceIssues(issues: readonly SourceIssue[]): number {
  return issues.filter((i) => i.severity !== "info").length;
}

export function criticalSourceIssues(issues: readonly SourceIssue[]): SourceIssue[] {
  return issues.filter((i) => i.severity === "critical");
}

/** Viena rinda: «Punkts: Avots - vērtība; Avots - vērtība». */
export function formatSourceIssueLine(issue: SourceIssue): string {
  return `${issue.title}: ${issue.values.map((v) => `${v.source} - ${v.value}`).join("; ")}`;
}
