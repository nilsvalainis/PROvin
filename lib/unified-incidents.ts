/**
 * Vienota negadījumu tabula PDF — AutoDNA, CarVertical, LTAB, Citi avoti (tikai rindas ar aizpildītu „Zaudējumu summu”).
 * Loģiskais apkopojums: tas pats mēnesis + valsts (arī starp avotiem) → viena karte ar katra avota
 * precīzajām summām (bez vidējiem) un kopējo diapazonu.
 */

import type { ClientManualLtabBlockPdf, ClientManualVendorBlockPdf, LtabIncidentRow } from "@/lib/admin-source-blocks";
import {
  formatAutoRecordsDateForOutput,
  formatSourceDatePreservingMonth,
  isMonthPrecisionDate,
} from "@/lib/auto-records-paste-parse";
import { CC_VIN_PDF_SOURCE_LABEL, ccVinAmountToEurDisplay, type CcVinBlockState } from "@/lib/cc-vin-report";
import { ASV_PDF_SOURCE_LABEL, asvAmountToEurDisplay, type AsvBlockState } from "@/lib/asv-report";
import { normalizeCountryNameLv } from "@/lib/country-names-lv";
import {
  damageGroupDisplayLabels,
  damageZoneDisplayLabels,
  isDamageGroupLikeLabel,
  isVendorPartLabel,
  mergeSynonymDamageGroupLabels,
  parseDamageZoneHits,
  type DamageZoneId,
} from "@/lib/damage-zones";
import { damageDetailRowHasZones, mergeDamageDetailRows, parseDamageDetailsForVendorTitle } from "@/lib/vendor-damage-hydrate";
import {
  normalizeLossAmountEurDisplay,
  parseLossAmountEurBounds,
} from "@/lib/loss-amount-format";
import { parseMileageDateForSort } from "@/lib/unified-mileage";

export type UnifiedIncidentAmountBounds = { lo: number; hi: number };

export type UnifiedIncidentKindLabel = "Negadījums" | "Bojājumu ieraksts";

export type UnifiedIncidentRow = {
  date: string;
  lossAmount: string;
  country: string;
  sortableTime: number;
  sourceOrder: number;
  sourceLabel: string;
};

export type UnifiedIncidentSourceValuation = {
  sourceLabel: string;
  displayAmount: string;
  /** Punktveida summa, ja lo === hi; diapazonam null (nekad nav vidējais). */
  amountEur: number | null;
  amountBounds: UnifiedIncidentAmountBounds | null;
  rowCount: number;
};

/** Viens loģisks ieraksts (pēc apvienošanas starp avotiem tajā pašā mēnesī). */
export type UnifiedIncidentCluster = {
  date: string;
  country: string;
  displayAmount: string;
  /** Vairs nerēķina vidējo; paliek API saderībai, vienmēr null. */
  averageEur: number | null;
  /** Vairs nav vidējo; paliek API saderībai, vienmēr false (PDF neliek „~”). */
  averaged: boolean;
  kindLabel: UnifiedIncidentKindLabel;
  sourceValuations: UnifiedIncidentSourceValuation[];
  sortableTime: number;
  damage: UnifiedIncidentDamage | null;
};

export type UnifiedIncidentDamage = {
  zoneIds: DamageZoneId[];
  zoneLabels: string[];
  partLabels: string[];
  groupLabels: string[];
};

export type UnifiedIncidentDamageInput = {
  date: string;
  country: string;
  lossAmount: string;
  damagedSides: string;
  damageGroups: string;
};

export type UnifiedIncidentAggregation = {
  clusters: UnifiedIncidentCluster[];
  uniqueCount: number;
  rawCount: number;
};

function incidentRowHasLossAmount(r: LtabIncidentRow): boolean {
  return Boolean(r.lossAmount.trim());
}

export type CollectUnifiedIncidentOptions = {
  omitVendorBlockTitles?: Set<string>;
  omitLtab?: boolean;
  omitCcVin?: boolean;
  omitAsv?: boolean;
};

export function collectUnifiedIncidentRows(args: {
  manualVendorBlocks?: ClientManualVendorBlockPdf[] | null;
  manualLtabBlock?: ClientManualLtabBlockPdf | null;
  ccVinBlock?: CcVinBlockState | null;
  asvBlock?: AsvBlockState | null;
  options?: CollectUnifiedIncidentOptions;
}): UnifiedIncidentRow[] {
  const out: UnifiedIncidentRow[] = [];
  let sourceOrder = 0;
  const omitTitles = args.options?.omitVendorBlockTitles;
  const push = (r: LtabIncidentRow, sourceLabel: string) => {
    if (!incidentRowHasLossAmount(r)) return;
    const d = r.csngDate.trim();
    out.push({
      date: d || "-",
      lossAmount: normalizeLossAmountEurDisplay(r.lossAmount) || r.lossAmount.trim(),
      country: r.incidentNo.trim() || "-",
      sortableTime: parseMileageDateForSort(d),
      sourceOrder: sourceOrder++,
      sourceLabel: sourceLabel.trim() || "Nezināms avots",
    });
  };
  for (const b of args.manualVendorBlocks ?? []) {
    if (omitTitles?.has(b.title)) continue;
    for (const r of b.incidentRows) push(r, b.title);
  }
  if (!args.options?.omitLtab) {
    for (const r of args.manualLtabBlock?.rows ?? []) push(r, "LTAB");
  }
  // Starptautiskā vēsture: tikai bojājumi ar summu — pārējie paliek savā sadaļā, lai tabulā nerastos rindas bez vērtības.
  if (!args.options?.omitCcVin) {
    for (const d of args.ccVinBlock?.damages ?? []) {
      push(
        {
          csngDate: d.date,
          lossAmount: ccVinAmountToEurDisplay(d.amount) || d.amount,
          incidentNo: d.region,
        } as LtabIncidentRow,
        CC_VIN_PDF_SOURCE_LABEL,
      );
    }
  }
  if (!args.options?.omitAsv) {
    for (const d of args.asvBlock?.damages ?? []) {
      push(
        {
          csngDate: d.date,
          lossAmount: asvAmountToEurDisplay(d.amount) || d.amount,
          incidentNo: d.region,
        } as LtabIncidentRow,
        ASV_PDF_SOURCE_LABEL,
      );
    }
  }
  return out;
}

export function collectUnifiedIncidentDamageDetails(
  manualVendorBlocks?: ClientManualVendorBlockPdf[] | null,
  options?: CollectUnifiedIncidentOptions,
): UnifiedIncidentDamageInput[] {
  const omitTitles = options?.omitVendorBlockTitles;
  const out: UnifiedIncidentDamageInput[] = [];
  const push = (d: UnifiedIncidentDamageInput) => {
    if (!d.damagedSides && !d.damageGroups) return;
    out.push(d);
  };
  for (const b of manualVendorBlocks ?? []) {
    if (omitTitles?.has(b.title)) continue;
    const saved = b.damageDetails ?? [];
    const fromRaw = parseDamageDetailsForVendorTitle(b.title, `${b.sourceRaw ?? ""}\n${b.comments ?? ""}`);
    const rows = mergeDamageDetailRows(saved, fromRaw).filter(damageDetailRowHasZones);
    for (const d of rows) {
      push({
        date: d.date.trim(),
        country: d.country.trim(),
        lossAmount: d.lossAmount.trim(),
        damagedSides: d.damagedSides.trim(),
        damageGroups: d.damageGroups.trim(),
      });
    }
  }
  return out;
}

/** Jaunākais datums augšā (kā nobraukuma tabulā). */
export function sortUnifiedIncidentsNewestFirst(rows: UnifiedIncidentRow[]): UnifiedIncidentRow[] {
  return [...rows].sort((a, b) => {
    if (a.sortableTime !== b.sortableTime) return b.sortableTime - a.sortableTime;
    return a.sourceOrder - b.sourceOrder;
  });
}

function incidentCountryKey(raw: string): string {
  const lv = normalizeCountryNameLv(raw);
  const t = (lv || raw).trim();
  if (!t || t === "-" || t === "\u2014" || t === "\u2013") return "?";
  return t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/** `2021-06` vai null, ja mēnesi nevar nolasīt. */
export function incidentYearMonthKey(row: Pick<UnifiedIncidentRow, "date" | "sortableTime">): string | null {
  if (row.sortableTime !== Number.NEGATIVE_INFINITY) {
    const d = new Date(row.sortableTime);
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth() + 1;
    if (y >= 1900 && y <= 2100 && m >= 1 && m <= 12) {
      return `${y}-${String(m).padStart(2, "0")}`;
    }
  }
  const t = row.date.trim();
  const monthYear = t.match(/^(\d{1,2})\.(\d{4})$/);
  if (monthYear) {
    const m = Number(monthYear[1]);
    const y = Number(monthYear[2]);
    if (m >= 1 && m <= 12 && y >= 1900 && y <= 2100) return `${y}-${String(m).padStart(2, "0")}`;
  }
  return null;
}

function incidentClusterKey(row: UnifiedIncidentRow): string {
  const ym = incidentYearMonthKey(row);
  const country = incidentCountryKey(row.country);
  if (!ym) return `unique:${row.sourceOrder}`;
  return `${ym}|${country}`;
}

function rowAmountBounds(raw: string): UnifiedIncidentAmountBounds | null {
  const bounds = parseLossAmountEurBounds(raw);
  if (bounds) return bounds;
  const collapsed = raw.replace(/EUR|€/gi, "").replace(/[\s\u00a0\u202f]/g, "").trim();
  if (/^\d+$/.test(collapsed)) {
    const v = Number.parseInt(collapsed, 10);
    return Number.isNaN(v) ? null : { lo: v, hi: v };
  }
  return null;
}

function unionAmountBounds(list: UnifiedIncidentAmountBounds[]): UnifiedIncidentAmountBounds | null {
  if (list.length === 0) return null;
  return {
    lo: Math.min(...list.map((b) => b.lo)),
    hi: Math.max(...list.map((b) => b.hi)),
  };
}

function formatAmountBoundsDisplay(bounds: UnifiedIncidentAmountBounds | null, fallback: string): string {
  if (!bounds) return fallback.trim() || "-";
  if (bounds.lo === bounds.hi) {
    return normalizeLossAmountEurDisplay(`${bounds.lo} €`) || fallback.trim() || "-";
  }
  return (
    normalizeLossAmountEurDisplay(`${bounds.lo} - ${bounds.hi} €`) ||
    `${bounds.lo} - ${bounds.hi} €`
  );
}

function dedupeSourceRows(rows: UnifiedIncidentRow[]): UnifiedIncidentRow[] {
  const seen = new Set<string>();
  const out: UnifiedIncidentRow[] = [];
  for (const r of rows) {
    const key = `${r.date.trim()}|${r.lossAmount.trim()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}

function formatMonthYearDisplay(ym: string): string {
  const [y, m] = ym.split("-");
  if (!y || !m) return ym;
  return `${m}.${y}`;
}

function clusterDisplayDate(members: UnifiedIncidentRow[], ym: string | null): string {
  const dayDates = new Set<string>();
  for (const m of members) {
    if (isMonthPrecisionDate(m.date)) continue;
    if (m.sortableTime === Number.NEGATIVE_INFINITY) continue;
    const lv = formatAutoRecordsDateForOutput(m.date) || m.date.trim();
    if (/^\d{2}\.\d{2}\.\d{4}$/.test(lv)) dayDates.add(lv);
  }
  if (dayDates.size === 1) return [...dayDates][0]!;
  if (ym) return formatMonthYearDisplay(ym);
  const first = sortUnifiedIncidentsNewestFirst(members)[0]?.date.trim() || "-";
  return isMonthPrecisionDate(first) ? formatSourceDatePreservingMonth(first) : first;
}

function sourceLooksLikeAccident(label: string): boolean {
  return /\bltab\b/i.test(label.trim());
}

function clusterKindLabel(members: UnifiedIncidentRow[]): UnifiedIncidentKindLabel {
  return members.some((m) => sourceLooksLikeAccident(m.sourceLabel)) ? "Negadījums" : "Bojājumu ieraksts";
}

function sourceValuation(label: string, rows: UnifiedIncidentRow[]): UnifiedIncidentSourceValuation {
  const unique = dedupeSourceRows(rows);
  unique.sort((a, b) => {
    const ba = rowAmountBounds(a.lossAmount);
    const bb = rowAmountBounds(b.lossAmount);
    if (ba && bb) return ba.lo - bb.lo || ba.hi - bb.hi;
    return a.lossAmount.localeCompare(b.lossAmount, "lv");
  });
  const displays = unique
    .map((r) => normalizeLossAmountEurDisplay(r.lossAmount) || r.lossAmount.trim())
    .filter(Boolean);
  const bounds = unionAmountBounds(
    unique.map((r) => rowAmountBounds(r.lossAmount)).filter((b): b is UnifiedIncidentAmountBounds => b != null),
  );
  return {
    sourceLabel: label,
    displayAmount: displays.join("; ") || "-",
    amountEur: bounds && bounds.lo === bounds.hi ? bounds.lo : null,
    amountBounds: bounds,
    rowCount: unique.length,
  };
}

function clusterFromMembers(members: UnifiedIncidentRow[]): UnifiedIncidentCluster {
  const newest = sortUnifiedIncidentsNewestFirst(members)[0]!;
  const bySource = new Map<string, UnifiedIncidentRow[]>();
  for (const m of members) {
    const list = bySource.get(m.sourceLabel) ?? [];
    list.push(m);
    bySource.set(m.sourceLabel, list);
  }
  const sourceValuations = [...bySource.entries()].map(([label, list]) => sourceValuation(label, list));
  const bounds = unionAmountBounds(
    sourceValuations.map((s) => s.amountBounds).filter((b): b is UnifiedIncidentAmountBounds => b != null),
  );
  const displayAmount = formatAmountBoundsDisplay(
    bounds,
    sourceValuations[0]?.displayAmount || newest.lossAmount.trim() || "-",
  );
  const country = normalizeCountryNameLv(newest.country) || newest.country.trim() || "-";
  const ym = incidentYearMonthKey(newest) ?? incidentYearMonthKey(members[0]!);
  return {
    date: clusterDisplayDate(members, ym),
    country,
    displayAmount,
    averageEur: null,
    averaged: false,
    kindLabel: clusterKindLabel(members),
    sourceValuations,
    sortableTime: newest.sortableTime,
    damage: null,
  };
}

/**
 * Apvieno to pašu mēnesi + valsti no visiem avotiem par vienu karti.
 * Kopējā summa = visu avotu diapazons (min lo - max hi), bez vidējiem.
 */
export function aggregateUnifiedIncidents(
  rows: UnifiedIncidentRow[],
  damageDetails: UnifiedIncidentDamageInput[] = [],
): UnifiedIncidentAggregation {
  const sorted = sortUnifiedIncidentsNewestFirst(rows);
  const groups = new Map<string, UnifiedIncidentRow[]>();
  for (const row of sorted) {
    const key = incidentClusterKey(row);
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }

  const clusters = [...groups.values()].map((members) => {
    const cluster = clusterFromMembers(members);
    const matched = damageDetails.filter((d) => damageDetailMatchesCluster(d, cluster));
    return { ...cluster, damage: mergeClusterDamage(matched) };
  });
  const mergedAcrossCountry = mergeIncidentClustersSameAmountAndZones(clusters);
  mergedAcrossCountry.sort((a, b) => {
    if (a.sortableTime !== b.sortableTime) return b.sortableTime - a.sortableTime;
    return a.date.localeCompare(b.date, "lv");
  });

  return {
    clusters: mergedAcrossCountry,
    uniqueCount: mergedAcrossCountry.length,
    rawCount: rows.length,
  };
}

const INCIDENT_MERGE_MAX_DAYS = 31;
const INCIDENT_AMOUNT_MATCH_EUR = 10;

function incidentZoneKey(c: UnifiedIncidentCluster): string {
  return (c.damage?.zoneIds ?? []).slice().sort().join(",");
}

function clusterAmountBounds(c: UnifiedIncidentCluster): UnifiedIncidentAmountBounds | null {
  const fromSources = unionAmountBounds(
    c.sourceValuations.map((s) => s.amountBounds).filter((b): b is UnifiedIncidentAmountBounds => b != null),
  );
  if (fromSources) return fromSources;
  return rowAmountBounds(c.displayAmount);
}

function amountsOverlapForDedupe(a: UnifiedIncidentAmountBounds | null, b: UnifiedIncidentAmountBounds | null): boolean {
  if (!a || !b) return false;
  if (a.lo === a.hi && b.lo === b.hi) {
    return Math.abs(a.lo - b.lo) <= INCIDENT_AMOUNT_MATCH_EUR;
  }
  return a.lo <= b.hi && b.lo <= a.hi;
}

function mergeTwoIncidentClusters(a: UnifiedIncidentCluster, b: UnifiedIncidentCluster): UnifiedIncidentCluster {
  const newer = a.sortableTime >= b.sortableTime ? a : b;
  const older = newer === a ? b : a;
  const valuations = [...newer.sourceValuations];
  for (const s of older.sourceValuations) {
    if (!valuations.some((v) => v.sourceLabel === s.sourceLabel && v.displayAmount === s.displayAmount)) {
      valuations.push(s);
    }
  }
  const countries = [...new Set([newer.country, older.country].map((c) => c.trim()).filter(Boolean))];
  const bounds = unionAmountBounds(
    valuations.map((s) => s.amountBounds).filter((x): x is UnifiedIncidentAmountBounds => x != null),
  );
  return {
    ...newer,
    country: countries.length === 1 ? countries[0]! : countries.join(" / "),
    sourceValuations: valuations,
    averageEur: null,
    averaged: false,
    kindLabel:
      newer.kindLabel === "Negadījums" || older.kindLabel === "Negadījums" ? "Negadījums" : "Bojājumu ieraksts",
    displayAmount: formatAmountBoundsDisplay(bounds, newer.displayAmount),
    damage: mergeClusterDamageFromClusters(newer.damage, older.damage),
  };
}

function mergeClusterDamageFromClusters(
  a: UnifiedIncidentDamage | null,
  b: UnifiedIncidentDamage | null,
): UnifiedIncidentDamage | null {
  if (!a) return b;
  if (!b) return a;
  const zoneIds = [...new Set([...a.zoneIds, ...b.zoneIds])];
  const zoneLabels = [...new Set([...a.zoneLabels, ...b.zoneLabels])];
  const partLabels = [...new Set([...a.partLabels, ...b.partLabels])];
  const groupLabels = mergeSynonymDamageGroupLabels([...a.groupLabels, ...b.groupLabels]);
  if (zoneIds.length === 0 && zoneLabels.length === 0 && partLabels.length === 0 && groupLabels.length === 0) {
    return null;
  }
  return { zoneIds, zoneLabels, partLabels, groupLabels };
}

/** 1 mēneša logā, tās pašas zonas un summa (arī ja CarVertical saka Kanāda, Copart - ASV). */
function mergeIncidentClustersSameAmountAndZones(clusters: UnifiedIncidentCluster[]): UnifiedIncidentCluster[] {
  const out: UnifiedIncidentCluster[] = [];
  for (const c of clusters) {
    const idx = out.findIndex((prev) => {
      const days =
        prev.sortableTime > 0 && c.sortableTime > 0
          ? Math.abs(prev.sortableTime - c.sortableTime) / 86_400_000
          : 999;
      if (days > INCIDENT_MERGE_MAX_DAYS) return false;
      if (!amountsOverlapForDedupe(clusterAmountBounds(prev), clusterAmountBounds(c))) return false;
      return incidentZoneKey(prev) === incidentZoneKey(c);
    });
    if (idx < 0) {
      out.push(c);
      continue;
    }
    out[idx] = mergeTwoIncidentClusters(out[idx]!, c);
  }
  return out;
}

function countriesCompatible(a: string, b: string): boolean {
  if (a === "?" || b === "?") return true;
  if (a === b) return true;
  return a.includes(b) || b.includes(a);
}

function damageDetailMatchesCluster(d: UnifiedIncidentDamageInput, c: UnifiedIncidentCluster): boolean {
  const dYm = incidentYearMonthKey({ date: d.date, sortableTime: parseMileageDateForSort(d.date) });
  const cYm = incidentYearMonthKey({ date: c.date, sortableTime: c.sortableTime });
  const dc = incidentCountryKey(d.country);
  const cc = incidentCountryKey(c.country);
  if (!countriesCompatible(dc, cc)) return false;
  if (dYm && cYm) return dYm === cYm;
  if (!dYm && dc !== "?") return true;
  return false;
}

function mergeClusterDamage(details: UnifiedIncidentDamageInput[]): UnifiedIncidentDamage | null {
  if (details.length === 0) return null;
  const zoneIds: DamageZoneId[] = [];
  const zoneLabels: string[] = [];
  const partLabels: string[] = [];
  const zoneIdSeen = new Set<DamageZoneId>();
  const zoneLabelSeen = new Set<string>();
  const partSeen = new Set<string>();
  const groupRaw: string[] = [];
  for (const d of details) {
    const hits = parseDamageZoneHits(d.damagedSides);
    for (const h of hits) {
      if (zoneIdSeen.has(h.id)) continue;
      zoneIdSeen.add(h.id);
      zoneIds.push(h.id);
    }
    for (const label of damageZoneDisplayLabels(d.damagedSides)) {
      if (isDamageGroupLikeLabel(label)) {
        groupRaw.push(label);
        continue;
      }
      const k = label.toLowerCase();
      if (!zoneLabelSeen.has(k)) {
        zoneLabelSeen.add(k);
        zoneLabels.push(label);
      }
      if (isVendorPartLabel(label) && !partSeen.has(k)) {
        partSeen.add(k);
        partLabels.push(label);
      }
    }
    groupRaw.push(...damageGroupDisplayLabels(d.damageGroups));
  }
  const groupLabels = mergeSynonymDamageGroupLabels(groupRaw);
  if (zoneIds.length === 0 && zoneLabels.length === 0 && partLabels.length === 0 && groupLabels.length === 0) {
    return null;
  }
  return { zoneIds, zoneLabels, partLabels, groupLabels };
}

export function unifiedIncidentCountKind(clusters: UnifiedIncidentCluster[]): "accident" | "damage" {
  if (clusters.length === 0) return "damage";
  return clusters.every((c) => c.kindLabel === "Negadījums") ? "accident" : "damage";
}

export function formatUnifiedIncidentCountLabel(n: number, kind: "accident" | "damage" = "damage"): string {
  if (kind === "accident") {
    if (n === 1) return "1 negadījums";
    return `${n} negadījumi`;
  }
  if (n === 1) return "1 bojājumu ieraksts";
  return `${n} bojājumu ieraksti`;
}

export function formatIncidentSourceValuationsLine(c: UnifiedIncidentCluster): string {
  if (c.sourceValuations.length <= 1) return "";
  return c.sourceValuations.map((s) => `${s.sourceLabel} ${s.displayAmount}`).join(" · ");
}
