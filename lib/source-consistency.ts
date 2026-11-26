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
import { ltabNoClaimsConfirmed } from "@/lib/ltab-auto-logic";
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
import { CC_VIN_ADMIN_LABEL, ccVinSaleRowHasData } from "@/lib/cc-vin-report";
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
import { extractListingSellerClaims } from "@/lib/listing-seller-claims";
import {
  csddHasLatvianRegistryRecord,
  dealerSuffix,
  extractExplicitOwnerCount,
  ownerEventMonthKey,
  synthesizeOwnerCountsFromBlocks,
} from "@/lib/owner-count-synthesis";
import { findOwnerClaimIssues } from "@/lib/owner-claims-check";
import { printableDealerServiceWorks } from "@/lib/pdf-dealer-service-visits";
import { extractVehicleDrivetrain, findDrivetrainContradictions, resolveVehicleDrivetrain } from "@/lib/registry-drivetrain";
import { thecarapiSalePriceFromFields } from "@/lib/thecarapi-sale-price";
import {
  analyzeUnifiedMileageAnomalies,
  collectUnifiedMileageRows,
  looksLikeExtraDigitOdometerTypo,
  parseOdometerKm,
  type UnifiedMileageRow,
} from "@/lib/unified-mileage";
import {
  aggregateUnifiedIncidents,
  collectUnifiedIncidentDamageDetails,
  collectUnifiedIncidentRows,
} from "@/lib/unified-incidents";
import { buildVehicleLifecycleEvents, vehicleFirstRegistrationSummary } from "@/lib/vehicle-lifecycle-timeline";
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
  | "auction_price"
  | "listing_claim"
  | "ai_numbers"
  | "ai_first_reg_country"
  | "ai_owner_count_mismatch"
  | "ai_incident_count"
  | "cover_auctions";

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

/* ---------- 1b. Ārvalstu īpašnieku kopskaits (CARFAX pret citiem avotiem) ---------- */

/**
 * Nila lēmums 25.11: CARFAX skaita arī dīlerus (juridiski īpašnieki) - salīdzina KOPSKAITU ar citu avotu
 * tās pašas valsts skaitu (piem. car.info Zviedrijā), sadalījumu rāda vērtībā.
 */
function checkForeignOwnerCounts(blocks: WorkspaceSourceBlocks, out: SourceIssue[]): void {
  const synth = synthesizeOwnerCountsFromBlocks(blocks);
  const carfax = synth.candidates.filter((c) => c.source === SOURCE_BLOCK_LABELS.carfax && c.country !== "latvia");
  for (const cf of carfax) {
    const others = synth.candidates.filter(
      (c) => c.source !== cf.source && c.country === cf.country && cf.country !== "other" && c.count !== cf.count,
    );
    if (others.length === 0) continue;
    push(out, {
      id: `owners_foreign_${cf.country}`,
      kind: "owners",
      severity: "warn",
      title: "Ārvalstu īpašnieku skaits atšķiras starp avotiem",
      values: [
        { source: cf.source, value: `${cf.count}${dealerSuffix(cf.dealerCount)}` },
        ...others.map((c) => ({ source: c.source, value: `${c.count}${dealerSuffix(c.dealerCount)}` })),
      ],
    });
  }
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
  let changeCountOnly = false;
  let explicitMismatch = false;
  for (const key of ["carvertical", "autodna", "carfax"] as const) {
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
      if (csddCount != null && explicit !== csddCount) {
        explicitMismatch = true;
        vendorCounts.push({ source: SOURCE_BLOCK_LABELS[key], value: `${explicit}` });
      }
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
      // 24.11 audits: CarVertical / AutoDNA «maiņu» skaits ietver reģ. apliecības maiņas - tikai info.
      changeCountOnly = true;
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
    severity: changeCountOnly && !explicitMismatch ? "info" : "warn",
    title:
      changeCountOnly && !explicitMismatch
        ? "Īpašnieku maiņu skaits avotā atšķiras no CSDD (avots ietver reģ. apliecības maiņas)"
        : "Īpašnieku skaits Latvijā nesakrīt",
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

/**
 * 24.11 audits (4.1): nobraukuma avotu ticamība.
 * 1 - valsts reģistri ar datumu; 2 - oficiālā dīlera vizīte; 3 - CarVertical / AutoDNA / citi ar pilnu datumu un
 * ne-apaļu km; 4 - apaļi km, mēneša precizitāte, izsoļu arhīvs, sludinājums (pārdevēja apgalvojums).
 */
export type MileageTrust = 1 | 2 | 3 | 4;

const REGISTRY_LABEL_RE = /\bcsdd\b|reģistr|mnt\.ee|traficom|car\.info|tjekbil|rdw|finnik|bilprovning|dmr/i;
const DEALER_LABEL_RE = /dīler|dealer|oneauto/i;
const LOW_TRUST_LABEL_RE = /sludinājum|izsol|arhīv|auction|tirgus/i;

export function mileageRowTrust(row: Pick<UnifiedMileageRow, "sourceLabel" | "datePrecision" | "countryUnverified">, km: number): MileageTrust {
  const label = row.sourceLabel ?? "";
  if (row.countryUnverified || LOW_TRUST_LABEL_RE.test(label)) return 4;
  if (row.datePrecision === "month") return 4;
  if (REGISTRY_LABEL_RE.test(label)) return 1;
  if (DEALER_LABEL_RE.test(label)) return 2;
  // Vendoru apaļi km (207 000, 214 500) parasti ir pārkopēti sludinājuma km.
  if (km >= 10_000 && km % 500 === 0) return 4;
  return 3;
}

/** 999 999, 0, 1 km un nereālas vērtības - nav rādījums. */
export function isSentinelOdometerKm(km: number): boolean {
  if (km <= 1) return true;
  if (km >= 1_500_000) return true;
  return /^9{5,}$/.test(String(Math.round(km)));
}

/** «01.00.2018», «00.05.2019» - nederīgs datums. */
export function isInvalidMileageDate(raw: string): boolean {
  const t = (raw ?? "").trim();
  return /(?:^|[./-])00(?:[./-]|$)/.test(t.replace(/^(\d{4})-/, "$1."));
}

/** Kritums ≈ jūdzes rakstītas kā km (a / b ≈ 1,609 ±3 %). */
export function looksLikeMilesAsKm(hiKm: number, loKm: number): boolean {
  if (loKm <= 0) return false;
  const r = hiKm / loKm;
  return Math.abs(r - 1.609344) / 1.609344 <= 0.03;
}

/** Ziemeļamerikas VIN (1-5 pirmais simbols) - odometrs avotā bieži jūdzēs. */
export function isNorthAmericanVin(vin: string | null | undefined): boolean {
  return /^[1-5][A-HJ-NPR-Z0-9]{16}$/i.test((vin ?? "").trim());
}

function checkMileage(rows: UnifiedMileageRow[], out: SourceIssue[], opts: { vin?: string | null; nowMs: number }): void {
  type R = { row: UnifiedMileageRow; km: number; t: number; fam: string; month: boolean; trust: MileageTrust };
  const list: R[] = [];
  const usVin = isNorthAmericanVin(opts.vin);
  // 24.11 audits: viena avota ievades kļūdas / izlēcēji (dīlera vienas dienas 121 100 pie 91 794) nav salīdzināšanas punkts.
  let typoOrders = new Set<number>();
  try {
    const an = analyzeUnifiedMileageAnomalies(rows);
    typoOrders = new Set([...an.dataEntryErrorSourceOrders, ...(an.typoSpikeSourceOrders ?? [])]);
  } catch {
    /* analīze nav obligāta */
  }
  for (const row of rows) {
    if ((row as { visitOdometer?: boolean }).visitOdometer) continue;
    if (typoOrders.has(row.sourceOrder)) continue;
    const km = parseOdometerKm(row.odometer);
    if (km == null || km <= 0 || !(row.sortableTime > 0)) continue;
    if (isSentinelOdometerKm(km) || isInvalidMileageDate(row.date)) continue;
    if (row.sortableTime > opts.nowMs + DAY_MS) continue;
    list.push({
      row,
      km,
      t: row.sortableTime,
      fam: sourceFamily(row.sourceLabel),
      month: row.datePrecision === "month",
      trust: mileageRowTrust(row, km),
    });
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
    const miles = looksLikeMilesAsKm(hi, lo);
    push(out, {
      id: `mileage_same_day_${day}`,
      kind: "mileage_same_day",
      severity: miles ? "info" : "warn",
      title: miles ? `${day} dažādi rādījumi (iespējamas jūdzes)` : `${day} dažādi rādījumi`,
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
  // 24.11 audits: viens kritums, ko vairāki avoti pārkopējuši (vēlākais km ±500, jebkurš datums) = viens punkts.
  // Paliek ticamākais pāris (reģistrs pirms vendora), tad lielākais kritums.
  const groups: { a: R; b: R; drop: number }[] = [];
  const pairTrust = (h: { a: R; b: R }) => Math.max(h.a.trust, h.b.trust) * 10 + Math.min(h.a.trust, h.b.trust);
  for (const hit of [...best.values()].sort((x, y) => pairTrust(x) - pairTrust(y) || y.drop - x.drop)) {
    if (groups.some((g) => Math.abs(g.b.km - hit.b.km) <= 500)) continue;
    groups.push(hit);
  }
  for (const { a, b, drop } of groups) {
    const typo = looksLikeExtraDigitOdometerTypo(Math.max(a.km, b.km), Math.min(a.km, b.km));
    const milesCountry = (r: R) => /^(?:us|usa|ca|gb|uk|asv|kanād|lielbritān|amerik)/i.test((r.row.country ?? "").trim());
    const miles = looksLikeMilesAsKm(a.km, b.km) || usVin || milesCountry(a) || milesCountry(b);
    // Sludinājuma km ir pārdevēja apgalvojums (bieži noapaļots) - nav kritisks fakts.
    const listing = /sludinājum/i.test(b.row.sourceLabel) || /sludinājum/i.test(a.row.sourceLabel) || Boolean(b.row.countryUnverified);
    const big = drop >= CROSS_SOURCE_DROP_CRITICAL_KM || drop >= a.km * CROSS_SOURCE_DROP_CRITICAL_RATIO;
    // Kritisks tikai, ja vismaz viena puse ir valsts reģistrs un otra nav zemas ticamības (4.1).
    const trusted = Math.min(a.trust, b.trust) === 1 && Math.max(a.trust, b.trust) <= 3;
    const severity: SourceIssueSeverity = miles ? "info" : !typo && !listing && big && trusted ? "critical" : "warn";
    const lowTrust = Math.max(a.trust, b.trust) === 4;
    push(out, {
      id: `mileage_drop_${a.fam}_${b.fam}_${a.row.date}_${b.row.date}`,
      kind: "mileage_drop",
      severity,
      title: miles
        ? `Nobraukums samazinās starp avotiem (iespējamas jūdzes kā km), −${fmtKm(drop)}`
        : typo
          ? `Nobraukums samazinās starp avotiem (iespējama ievades kļūda), −${fmtKm(drop)}`
          : lowTrust
            ? `Nobraukums samazinās starp avotiem (pārdevēja / noapaļots rādījums), −${fmtKm(drop)}`
            : `Nobraukums samazinās starp avotiem, −${fmtKm(drop)}`,
      values: [
        { source: a.row.sourceLabel, value: `${fmtKm(a.km)} (${a.row.date})` },
        { source: b.row.sourceLabel, value: `${fmtKm(b.km)} (${b.row.date})` },
      ],
    });
  }
}

/* ---------- 2b. Datumi nākotnē (drukājamajā laika joslā / tabulās nedrīkst palikt) ---------- */

/** «01.01.10500» - nolasīšanas kļūda (gads > 2100), nav «nākotnes» fakts. */
function isGarbageYearDate(raw: string): boolean {
  return /\d{5,}/.test(raw) || /\b(2[1-9]\d{2}|[3-9]\d{3})\b/.test(raw);
}

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
      if (e.date && isImpossibleFutureDate(e.date, nowMs) && !isGarbageYearDate(e.date)) {
        // 24.11 audits: sludinājuma datums (parsēšana «05.12.2026» / «01.01.10500») nav kritisks fakts.
        const listingOnly = e.sources.length > 0 && e.sources.every((x) => /sludinājum|tirgus|listing/i.test(x));
        if (!listingOnly) inTimeline = true;
        values.push({ source: `Laika josla (${e.sources.join(", ") || e.title})`, value: e.date });
      }
    }
  } catch {
    /* laika josla nav obligāta pārbaudei */
  }
  for (const w of printableDealerServiceWorks(blocks.auto_records.serviceWorks ?? [])) {
    if (isImpossibleFutureDate(w.date, nowMs)) values.push({ source: SOURCE_BLOCK_LABELS.auto_records, value: w.date });
  }
  for (const key of ["carvertical", "autodna", "carfax"] as const) {
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
    // 24.11 audits: tranzīts (LT, PL) nav iepriekšējās valsts liecība.
    if (!code || code === "LV" || code === "LT" || code === "PL") return;
    seen.set(code, (seen.get(code) ?? new Set()).add(source));
  };
  for (const w of blocks.auto_records.serviceWorks ?? []) add(iso2(extractCountryFromLocation(w.location ?? "")), "Dīlera vizītes");
  for (const r of blocks.auto_records.serviceHistory ?? []) add(iso2(r.country), "Dīlera vizītes");
  for (const l of lots) add(iso2(auctionArchiveLotFacts(l.record).country), "Izsoles");
  for (const key of ["carvertical", "autodna", "carfax"] as const) {
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
    // 24.11 audits: importētam auto CSDD «pirmā reģistrācija» bieži ir LV reģistrācijas datums.
    const prevCountry = iso2(blocks.csdd.previousRegistrationCountry);
    const imported = Boolean(prevCountry) && prevCountry !== "LV";
    const others = cands.filter((c) => c.source !== "CSDD");
    const csddCand = cands.find((c) => c.source === "CSDD");
    const csddIsLvReg = imported && csddCand != null && others.length > 0 && others.every((o) => csddCand.ms > o.ms + FIRST_REG_TOLERANCE_MS);
    // Dīlera 01.01.GGGG = gada precizitāte; dīlerim pielaide 92 d (piegāde pret reģistrāciju).
    const tolFor = (c: { source: string; raw: string }) =>
      c.source === "Dīlera dati" ? (/^(?:01[./]01[./]\d{4}|\d{4}-01-01)$/.test(c.raw) ? 366 * DAY_MS : 92 * DAY_MS) : FIRST_REG_TOLERANCE_MS;
    const cmp = csddIsLvReg ? others : cands;
    let bad = false;
    for (let i = 0; i < cmp.length && !bad; i++) {
      for (let j = i + 1; j < cmp.length; j++) {
        const tol = Math.max(tolFor(cmp[i]!), tolFor(cmp[j]!));
        if (Math.abs(cmp[i]!.ms - cmp[j]!.ms) > tol) {
          bad = true;
          break;
        }
      }
    }
    if (bad || csddIsLvReg) {
      push(out, {
        id: "first_registration",
        kind: "first_registration",
        severity: bad ? "warn" : "info",
        title: bad
          ? "Pirmās reģistrācijas datums atšķiras"
          : "CSDD datums ir reģistrācija Latvijā (auto ievests) - pirmā reģistrācija ārvalstīs agrāk",
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

/** Ierakstītie negadījumi / bojājumi (AutoDNA, CarVertical, CARFAX, LTAB) ar datumu un avotu. */
function recordedDamageEvents(blocks: WorkspaceSourceBlocks): { source: string; ms: number; date: string }[] {
  const records: { source: string; ms: number; date: string }[] = [];
  for (const key of ["autodna", "carvertical", "carfax"] as const) {
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
  return records;
}

function checkDamages(blocks: WorkspaceSourceBlocks, lots: Lot[], nowMs: number, out: SourceIssue[]): void {
  // Ierakstītie negadījumi / bojājumi citos avotos (datums + avots).
  const records = recordedDamageEvents(blocks);

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
  const ltabChecked = Boolean(blocks.ltab.certificate) || ltabRows.length > 0 || ltabNoClaimsConfirmed(blocks.ltab);
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

/* ---------- 6b. Pārdevēja apgalvojumi sludinājuma aprakstā ---------- */

const LISTING_PASTE_SOURCE = "Sludinājuma apraksts";

function checkListingClaims(
  blocks: WorkspaceSourceBlocks,
  rows: UnifiedMileageRow[],
  nowMs: number,
  out: SourceIssue[],
): void {
  const claims = extractListingSellerClaims(blocks.listing_analysis.listingPasteRaw);

  if (claims.noAccidents) {
    const records = recordedDamageEvents(blocks);
    const uniq = records.filter((r, i) => records.findIndex((x) => x.source === r.source && x.date === r.date) === i);
    const values: SourceIssueValue[] = uniq.slice(0, 5).map((r) => ({ source: r.source, value: r.date }));
    const csng = parseCsddRegistrySignals(blocks.csdd, nowMs).csngInsurers;
    if (csng.state === "present") values.push({ source: "CSDD (apdrošinātāji)", value: csng.text.slice(0, 120) || "ir" });
    if (values.length > 0) {
      push(out, {
        id: "listing_claim_no_accidents",
        kind: "listing_claim",
        severity: "warn",
        title: "Sludinājumā «bez avārijām», avotos ir negadījumi",
        values: [{ source: LISTING_PASTE_SOURCE, value: `„${claims.noAccidents}”` }, ...values],
      });
    }
  }

  if (claims.km != null) {
    // Tikai fiksētie rādījumi (ne sludinājuma rindas - tas ir tas pats pārdevēja apgalvojums).
    let best: { km: number; row: UnifiedMileageRow } | null = null;
    for (const row of rows) {
      if (/sludinājum/i.test(row.sourceLabel) || row.documentValue) continue;
      const km = parseOdometerKm(row.odometer);
      if (km == null || km <= 0) continue;
      if (!best || km > best.km) best = { km, row };
    }
    if (best) {
      const drop = best.km - claims.km;
      if (drop >= Math.max(CROSS_SOURCE_DROP_MIN_KM, best.km * CROSS_SOURCE_DROP_RATIO)) {
        push(out, {
          id: "listing_claim_km_below_recorded",
          kind: "listing_claim",
          severity: "warn",
          title: `Sludinājuma aprakstā nobraukums mazāks par fiksēto, −${fmtKm(drop)}`,
          values: [
            { source: LISTING_PASTE_SOURCE, value: fmtKm(claims.km) },
            { source: best.row.sourceLabel, value: `${fmtKm(best.km)}${best.row.date ? ` (${best.row.date})` : ""}` },
          ],
        });
      }
    }
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

/* ---------- 8. Saskaņotība pirms PDF (24.11 audits, 1. punkts) ---------- */

const KM_IN_TEXT_RE = /(?<![\d.,])(\d{1,3}(?:[   ]\d{3})+|\d{4,7})\s*km\b/gu;
/** Aptuvens / aprēķināts skaitlis («ap», «~», «vidēji», «gadā», intervāls) - nav rādījums. */
const KM_APPROX_CONTEXT_RE =
  /~|≈|\bap\.?\s*$|\baptuven|\bvidēj|\bgadā\b|\bmēnesī\b|intervāl|\bvirs\s*$|\bzem\s*$|\bmazāk\s+par\s*$|\bvairāk\s+par\s*$|robež|diapazon/iu;
const DAY_DATE_RE = /(?<![\d.])(\d{1,2})\.(\d{1,2})\.((?:19|20)\d{2})(?![\d])/g;

function sentenceAround(text: string, idx: number): string {
  const start = Math.max(text.lastIndexOf(".", idx - 1 - 12), text.lastIndexOf("\n", idx), 0);
  const endDot = text.indexOf(". ", idx);
  const end = endDot < 0 ? text.length : Math.min(endDot + 1, idx + 220);
  return text.slice(start, end).replace(/^[.\s]+/, "").trim();
}

/** Visi skaitļi avotu datos (km, summas, intervāli) - ar atstarpēm grupētie arī. */
function numbersInData(haystack: string): number[] {
  const out = new Set<number>();
  for (const m of haystack.matchAll(/\d{1,3}(?:[   .,]\d{3})+|\d+/g)) {
    const n = Number(m[0].replace(/[^\d]/g, ""));
    if (Number.isFinite(n) && n >= 1000 && n < 5_000_000) out.add(n);
  }
  return [...out];
}

function dataDateSet(haystack: string): Set<number> {
  const out = new Set<number>();
  for (const m of haystack.matchAll(/(?<!\d)(\d{1,2})[./](\d{1,2})[./]((?:19|20)\d{2})(?!\d)|(?<!\d)((?:19|20)\d{2})-(\d{2})-(\d{2})(?!\d)/g)) {
    const [d, mo, y] = m[1] ? [m[1], m[2], m[3]] : [m[6], m[5], m[4]];
    const ms = Date.UTC(Number(y), Number(mo) - 1, Number(d));
    if (Number.isFinite(ms)) out.add(ms);
  }
  return out;
}

/**
 * (a) Katrs precīzs km skaitlis un dienas datums AI tekstā eksistē datos (ar pielaidi):
 * km ±10 pret jebkuru datu skaitli vai divu nobraukuma rindu starpību («kritums par 87 046 km»);
 * datums ±1 diena pret jebkuru datu datumu. Apaļi (dalās ar 1 000) un aptuveni skaitļi netiek pārbaudīti.
 */
function checkAiNumbers(
  blocks: WorkspaceSourceBlocks,
  rows: UnifiedMileageRow[],
  texts: readonly { label: string; text: string }[],
  out: SourceIssue[],
): void {
  if (texts.length === 0) return;
  const haystack = JSON.stringify(blocks);
  const dataNums = numbersInData(haystack);
  const rowKms = rows.map((r) => parseOdometerKm(r.odometer)).filter((n): n is number => n != null && n > 0);
  const diffs: number[] = [];
  for (let i = 0; i < rowKms.length; i++) for (let j = i + 1; j < rowKms.length; j++) diffs.push(Math.abs(rowKms[i]! - rowKms[j]!));
  const allowed = [...dataNums, ...rowKms, ...diffs];
  const dates = dataDateSet(haystack);
  const kmValues: SourceIssueValue[] = [];
  const dateValues: SourceIssueValue[] = [];
  for (const t of texts) {
    const plain = adminRichHtmlToPlainText(t.text ?? "");
    if (!plain.trim()) continue;
    for (const m of plain.matchAll(KM_IN_TEXT_RE)) {
      const n = Number(m[1]!.replace(/[^\d]/g, ""));
      if (!Number.isFinite(n) || n < 1000 || n % 1000 === 0) continue;
      const before = plain.slice(Math.max(0, (m.index ?? 0) - 24), m.index ?? 0);
      if (KM_APPROX_CONTEXT_RE.test(before)) continue;
      const after = plain.slice((m.index ?? 0) + m[0].length, (m.index ?? 0) + m[0].length + 14);
      if (/^\s*(?:\/|gadā|mēnesī|dienā|nedēļā|per\b|a\s+year)/iu.test(after)) continue;
      if (allowed.some((a) => Math.abs(a - n) <= 10)) continue;
      const nearest = rowKms.length ? rowKms.reduce((b, a) => (Math.abs(a - n) < Math.abs(b - n) ? a : b)) : null;
      const v = `«${fmtKm(n)}»${nearest != null ? ` (tuvākais rādījums datos ${fmtKm(nearest)})` : ""}`;
      if (!kmValues.some((x) => x.source === t.label && x.value === v)) kmValues.push({ source: t.label, value: v });
    }
    for (const m of plain.matchAll(DAY_DATE_RE)) {
      const ms = Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
      if (!Number.isFinite(ms) || Number(m[2]) > 12 || Number(m[1]) > 31) continue;
      if (dates.has(ms) || dates.has(ms - DAY_MS) || dates.has(ms + DAY_MS)) continue;
      const v = `«${m[0]}» - ${sentenceAround(plain, m.index ?? 0).slice(0, 120)}`;
      if (!dateValues.some((x) => x.source === t.label && x.value.startsWith(`«${m[0]}»`))) dateValues.push({ source: t.label, value: v });
    }
  }
  if (kmValues.length > 0) {
    push(out, { id: "ai_numbers_km", kind: "ai_numbers", severity: "warn", title: "AI tekstā km skaitlis, kura nav nobraukuma datos", values: kmValues.slice(0, 8) });
  }
  if (dateValues.length > 0) {
    push(out, { id: "ai_numbers_date", kind: "ai_numbers", severity: "warn", title: "AI tekstā datums, kura nav avotu datos", values: dateValues.slice(0, 8) });
  }
}

/** «Vācijā» -> «Vācija», «Nīderlandē» -> «Nīderlande» (lokatīvs -> nominatīvs), ISO. */
function locativeCountryIso(word: string): string {
  const w = word.trim();
  const nom = w.replace(/ā$/u, "a").replace(/ē$/u, "e").replace(/ī$/u, "is");
  return iso2(nom) || iso2(w);
}

const FIRST_REG_PHRASE_RE =
  /(?:pirm\p{L}*\s+(?:reizi\s+)?reģistr\p{L}*|pirmoreiz\s+reģistr\p{L}*|izcelsmes\s+valst\p{L}*)[^.!?\n]{0,60}?\b(\p{Lu}\p{Ll}+(?:ā|ē|ī))(?![\p{L}])/gu;

/** (b) Viena 1. reģistrācijas valsts: 1. lapa (dzīves cikls) pret AI tekstiem un CSDD iepriekšējo valsti. */
function checkFirstRegCountryConsistency(
  blocks: WorkspaceSourceBlocks,
  texts: readonly { label: string; text: string }[],
  listingUrl: string | null | undefined,
  out: SourceIssue[],
): void {
  const events = buildVehicleLifecycleEvents({
    csddForm: blocks.csdd,
    autoRecordsBlock: blocks.auto_records,
    oneautoBlock: blocks.oneauto,
    ccVinBlock: blocks.cc_vin,
    asvBlock: blocks.asv,
    manualVendorBlocks: toPdfManualVendorBlocks(blocks),
    citiAvoti: blocks.citi_avoti,
    tirgusForm: blocks.tirgus,
    listingUrl: listingUrl ?? null,
  });
  const summary = vehicleFirstRegistrationSummary(events);
  const firstIso = (summary.countryIso || iso2(summary.country)).toUpperCase();
  if (!firstIso) {
    // 26.11 (Nils, BMW X5): 1. reģistrācijas valsts nav zināma - AI tekstā to nedrīkst «aprēķināt» (piem. no CSDD iepriekšējās valsts).
    const unknownValues: SourceIssueValue[] = [];
    for (const t of texts) {
      const plain = adminRichHtmlToPlainText(t.text ?? "");
      for (const m of plain.matchAll(FIRST_REG_PHRASE_RE)) {
        const iso = locativeCountryIso(m[1]!);
        if (!iso || iso === "LV") continue;
        unknownValues.push({ source: t.label, value: `«${m[0].slice(0, 140)}»` });
      }
    }
    if (unknownValues.length === 0) return;
    push(out, {
      id: "ai_first_reg_country",
      kind: "ai_first_reg_country",
      severity: "warn",
      title: "AI tekstā 1. reģistrācijas valsts, bet tā nav pierādāma (1. lapā «Nav zināma»)",
      values: [{ source: "1. lapa", value: "Nav zināma" }, ...unknownValues.slice(0, 6)],
    });
    return;
  }
  if (firstIso === "LV") return;
  const firstLabel = countryLv(firstIso);
  const prev = iso2(blocks.csdd.previousRegistrationCountry);
  if (prev && prev !== "LV" && prev !== firstIso) {
    push(out, {
      id: "first_reg_vs_csdd_prev",
      kind: "first_registration",
      severity: "info",
      title: "1. reģistrācijas valsts nav CSDD iepriekšējā valsts - tekstā vienā teikumā jāpaskaidro ceļš",
      values: [
        { source: "1. lapa (vēstures kopsavilkums)", value: firstLabel },
        { source: "CSDD (iepriekšējā valsts)", value: countryLv(prev) },
      ],
    });
  }
  const values: SourceIssueValue[] = [];
  for (const t of texts) {
    const plain = adminRichHtmlToPlainText(t.text ?? "");
    for (const m of plain.matchAll(FIRST_REG_PHRASE_RE)) {
      const iso = locativeCountryIso(m[1]!);
      if (!iso || iso === "LV" || iso === firstIso) continue;
      values.push({ source: t.label, value: `«${m[0].slice(0, 140)}»` });
    }
  }
  if (values.length === 0) return;
  push(out, {
    id: "ai_first_reg_country",
    kind: "ai_first_reg_country",
    severity: "warn",
    title: `AI tekstā cita 1. reģistrācijas valsts (1. lapā ${firstLabel})`,
    values: [{ source: "1. lapa", value: firstLabel }, ...values.slice(0, 6)],
  });
}

const OWNER_WORDS: Record<string, number> = {
  viens: 1, viena: 1, divi: 2, divas: 2, "trīs": 3, "četri": 4, "četras": 4, pieci: 5, piecas: 5, piecus: 5,
  "seši": 6, "sešus": 6, "septiņi": 7, "septiņus": 7, "astoņi": 8, "astoņus": 8, "deviņi": 9, "deviņus": 9,
  divus: 2, "četrus": 4, desmit: 10,
};
const OWNER_TOTAL_RE = new RegExp(
  `(?<![\\p{L}\\d.])(\\d{1,2}|${Object.keys(OWNER_WORDS).join("|")})\\s+(?:\\p{L}+\\s+)?īpašniek(?!(?:u|a)\\s+maiņ)`,
  "giu",
);
/** Teikums par vienu valsti / posmu - nav kopējais skaits. */
const OWNER_SCOPED_RE = /ārvalst|ārzem|latvij|posm|periodā|līzing|turētāj|pirms\s+import|kopš/iu;

function ownerSentenceScoped(sentence: string): boolean {
  if (OWNER_SCOPED_RE.test(sentence)) return true;
  // Valsts lokatīvā («Dānijā 1 īpašnieks») - posma skaits, ne kopējais.
  for (const m of sentence.matchAll(/(?<![\p{L}])(\p{Lu}\p{Ll}+(?:ā|ē))(?![\p{L}])/gu)) {
    if (locativeCountryIso(m[1]!)) return true;
  }
  return false;
}

/** (c) Viens kopējais īpašnieku skaits visos AI tekstos. */
function checkOwnerCountAcrossTexts(texts: readonly { label: string; text: string }[], out: SourceIssue[]): void {
  const byCount = new Map<number, Set<string>>();
  for (const t of texts) {
    const plain = adminRichHtmlToPlainText(t.text ?? "");
    for (const m of plain.matchAll(OWNER_TOTAL_RE)) {
      const sentence = sentenceAround(plain, m.index ?? 0);
      if (ownerSentenceScoped(sentence)) continue;
      const raw = m[1]!.toLowerCase();
      const n = /^\d+$/.test(raw) ? Number(raw) : OWNER_WORDS[raw];
      if (!n) continue;
      byCount.set(n, (byCount.get(n) ?? new Set()).add(t.label));
    }
  }
  if (byCount.size < 2) return;
  push(out, {
    id: "ai_owner_count_mismatch",
    kind: "ai_owner_count_mismatch",
    severity: "warn",
    title: "AI tekstos dažāds kopējais īpašnieku skaits",
    values: [...byCount.entries()].map(([n, labels]) => ({ source: [...labels].join(", "), value: `${n} īpašnieki` })),
  });
}

/** «7 negadījumi», «5 incidents», «1 negadījums» AI tekstos (skaitlis tieši pirms vārda). */
const AI_INCIDENT_COUNT_RE = /(?<![\d.,])(\d{1,3})\s+(?:negadījum[a-zāčēģīķļņšūž]*|incidents?|инцидент\w*|Unfäll\w*|Unfall\w*)/giu;

/**
 * 26.11 regresija: AI tekstā «7 negadījumi», bet 1. lapas kartītē 5 unikāli negadījumi. Salīdzina katru
 * tekstā nosaukto skaitu ar unikālo negadījumu skaitu (tā pati agregācija kā kartītē «Negadījumi un bojājumi»).
 * Ja kartītē negadījumu nav (0), pārbaude klusē - kartīte tad rāda bojājumus vai «Nav ierakstu».
 */
function checkAiIncidentCount(
  blocks: WorkspaceSourceBlocks,
  texts: readonly { label: string; text: string }[],
  out: SourceIssue[],
): void {
  if (texts.length === 0) return;
  const manualVendorBlocks = toPdfManualVendorBlocks(blocks);
  const rows = collectUnifiedIncidentRows({
    manualVendorBlocks,
    manualLtabBlock: toPdfLtabManualBlock(blocks.ltab),
    ccVinBlock: blocks.cc_vin,
    asvBlock: blocks.asv,
  });
  const cardCount = aggregateUnifiedIncidents(rows, collectUnifiedIncidentDamageDetails(manualVendorBlocks)).uniqueCount;
  if (cardCount <= 0) return;
  const byCount = new Map<number, Set<string>>();
  for (const t of texts) {
    const plain = adminRichHtmlToPlainText(t.text ?? "");
    for (const m of plain.matchAll(AI_INCIDENT_COUNT_RE)) {
      const n = Number(m[1]);
      if (!Number.isFinite(n) || n <= 0 || n === cardCount) continue;
      byCount.set(n, (byCount.get(n) ?? new Set()).add(t.label));
    }
  }
  if (byCount.size === 0) return;
  push(out, {
    id: "ai_incident_count",
    kind: "ai_incident_count",
    severity: "warn",
    title: "AI tekstā cits negadījumu skaits nekā 1. lapas kartītē",
    values: [
      { source: "1. lapas kartīte", value: `${cardCount} negadījumi` },
      ...[...byCount.entries()].map(([n, labels]) => ({ source: [...labels].join(", "), value: `${n} negadījumi` })),
    ],
  });
}

/** (d) 1. lapas kartīte «Izsoles» pret izsoļu sadaļu: «Nav atrastas», bet ir izsoļu arhīva foto. */
function checkCoverAuctionCard(blocks: WorkspaceSourceBlocks, lots: Lot[], out: SourceIssue[]): void {
  const cc = blocks.cc_vin;
  const salesFound = (cc.sales ?? []).some((r) => ccVinSaleRowHasData(r) && (r.venue?.trim() || r.date?.trim()));
  const lotsFound = (cc.thecarapiRecords ?? []).some(
    (r) => (r.venue?.trim() || r.date?.trim()) && ((r.fields ?? []).some((f) => f.value.trim()) || (r.photos ?? []).length > 0 || (r.photoUrls ?? []).length > 0),
  );
  if (salesFound || lotsFound || lots.length > 0) return;
  const groupPhotos = (cc.photoGroups ?? []).reduce((n, g) => n + (g.photos ?? []).length, 0);
  const photoCount = Math.max((cc.photos ?? []).length, groupPhotos);
  if (photoCount === 0) return;
  push(out, {
    id: "cover_auctions_none_vs_photos",
    kind: "cover_auctions",
    severity: "warn",
    title: "1. lapā «Izsoles - Nav atrastas», bet izsoļu sadaļā ir arhīva foto",
    values: [
      { source: "1. lapas kartīte", value: "Nav atrastas" },
      { source: "Izsoļu arhīvs", value: `${photoCount} arhīva foto` },
    ],
  });
}

/* ---------- kopā ---------- */

export function checkSourceConsistency(input: SourceConsistencyInput): SourceIssue[] {
  const blocks = mergeSourceBlocksWithDefaults(input.sourceBlocks ?? ({} as WorkspaceSourceBlocks));
  const nowMs = input.nowMs ?? Date.now();
  const lots = auctionLots(blocks.cc_vin.thecarapiRecords);
  const out: SourceIssue[] = [];
  const steps: (() => void)[] = [
    () => checkOwners(blocks, out),
    () => checkForeignOwnerCounts(blocks, out),
    () => checkMileage(mileageRows(blocks, input.listingUrl), out, { vin: input.vin, nowMs }),
    () => checkFutureDates(blocks, nowMs, input.listingUrl, out),
    () => checkCountry(blocks, lots, out),
    () => checkFirstRegistration(blocks, lots, out),
    () => checkVehicleIdentity(blocks, lots, out),
    () => checkAiTexts(blocks, input.vin, input.texts ?? [], out),
    () => checkDamages(blocks, lots, nowMs, out),
    () => checkAuctionPrices(blocks, lots, out),
    () => checkListingClaims(blocks, mileageRows(blocks, input.listingUrl), nowMs, out),
    () => checkAiNumbers(blocks, mileageRows(blocks, input.listingUrl), input.texts ?? [], out),
    () => checkFirstRegCountryConsistency(blocks, input.texts ?? [], input.listingUrl, out),
    () => checkOwnerCountAcrossTexts(input.texts ?? [], out),
    () => checkAiIncidentCount(blocks, input.texts ?? [], out),
    () => checkCoverAuctionCard(blocks, lots, out),
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
