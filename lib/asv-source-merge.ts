/**
 * ASV: OneAuto VIN Audit + JoJ Copart/IAAI — atsevišķi avota slāņi un apvienots skats bez dublēšanas.
 * Rādītais bloks: OneAuto pēc noklusējuma, JoJ tikai aizpilda trūkumus.
 */

import type { AutoRecordsServiceRow } from "@/lib/auto-records-paste-parse";
import { autoRecordsRowHasData } from "@/lib/auto-records-paste-parse";
import { emptyCcVinBlock } from "@/lib/cc-vin-report";
import { applyCcVinParsedReport } from "@/lib/cc-vin-report-apply";
import type { CcVinParsedReport } from "@/lib/cc-vin-report-parse";
import type {
  AsvDataSourceId,
  AsvOverlapCompareRow,
  AsvOverlapStronger,
  AsvSourceAttribution,
  AsvSourceSnapshots,
  AsvSourceTableBundle,
} from "@/lib/asv-source-types";
import {
  asvBlockToCcVinView,
  asvDamageRowHasData,
  asvRecordRowHasData,
  asvSaleRowHasData,
  asvTitleRowHasData,
  emptyAsvDamageRow,
  emptyAsvMileageRow,
  emptyAsvRecordRow,
  emptyAsvSaleRow,
  emptyAsvTitleRow,
  type AsvBlockState,
  type AsvDamageRow,
  type AsvRecordRow,
  type AsvSaleRow,
  type AsvTitleRow,
} from "@/lib/asv-report";
import { vinScanAuctionsToCcVinParsed } from "@/lib/order-vin-scan";
import { buildVinScanIndicator, type VinScanParse } from "@/lib/vin-scan/types";

const JOJ_ASV_SOURCE_ID = "joj_copart_iaai" as const;

export type {
  AsvDataSourceId,
  AsvOverlapCompareRow,
  AsvOverlapStronger,
  AsvSourceAttribution,
  AsvSourceSnapshots,
  AsvSourceTableBundle,
} from "@/lib/asv-source-types";

function squish(v: string): string {
  return v.replace(/\s+/g, " ").trim().toLowerCase();
}

function odometerDigits(v: string): string {
  return v.replace(/[^\d]/g, "");
}

function sortableDate(raw: string): number {
  const m = raw.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (m) return Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (iso) return Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  return 0;
}

export function emptyAsvSourceTableBundle(): AsvSourceTableBundle {
  return {
    reportDate: "",
    attentionMarks: "",
    ownersCount: "",
    checks: [],
    mileage: [],
    damages: [],
    brands: [],
    titles: [],
    sales: [],
    liens: [],
    thefts: [],
    notes: [],
  };
}

export function bundleFromAsvDisplay(block: AsvBlockState): AsvSourceTableBundle {
  return {
    reportDate: block.reportDate.trim(),
    attentionMarks: block.attentionMarks.trim(),
    ownersCount: block.ownersCount.trim(),
    checks: [...(block.checks ?? [])],
    mileage: (block.mileage ?? []).filter(autoRecordsRowHasData),
    damages: (block.damages ?? []).filter(asvDamageRowHasData),
    brands: (block.brands ?? []).filter(asvRecordRowHasData),
    titles: (block.titles ?? []).filter(asvTitleRowHasData),
    sales: (block.sales ?? []).filter(asvSaleRowHasData),
    liens: (block.liens ?? []).filter(asvRecordRowHasData),
    thefts: (block.thefts ?? []).filter(asvRecordRowHasData),
    notes: [],
  };
}

export function bundleFromCcVinParsed(parsed: CcVinParsedReport): AsvSourceTableBundle {
  return {
    reportDate: parsed.reportDate.trim(),
    attentionMarks: parsed.attentionMarks.trim(),
    ownersCount: parsed.ownersCount.trim(),
    checks: [...parsed.checks],
    mileage: parsed.mileage.map((r) => ({ ...r })),
    damages: parsed.damages.map((r) => ({ ...r })),
    brands: parsed.brands.map((r) => ({ ...r })),
    titles: parsed.titles.map((r) => ({ ...r })),
    sales: parsed.sales.map((r) => ({ ...r })),
    liens: [],
    thefts: [],
    notes: parsed.notes.filter((n) => n.trim()),
  };
}

export function bundleFromJojVinScan(vin: string, parse: VinScanParse): AsvSourceTableBundle {
  const indicator = buildVinScanIndicator(JOJ_ASV_SOURCE_ID, vin, parse);
  const parsed = vinScanAuctionsToCcVinParsed([indicator]);
  const bundle = bundleFromCcVinParsed(parsed);
  bundle.reportDate = bundle.reportDate || parsed.reportDate;
  return bundle;
}

function mileageKey(r: AutoRecordsServiceRow): string {
  return `${squish(r.date)}|${odometerDigits(r.odometer)}`;
}

function damageKey(r: AsvDamageRow): string {
  return `${squish(r.date)}|${squish(r.description)}`;
}

function saleKey(r: AsvSaleRow): string {
  const date = squish(r.date);
  const odo = odometerDigits(r.odometer);
  if (date && odo) return `${date}|${odo}`;
  return `${date}|${squish(r.venue)}|${odo}|${squish(r.price)}`;
}

function titleKey(r: AsvTitleRow): string {
  return `${squish(r.date)}|${odometerDigits(r.odometer)}|${squish(r.region)}`;
}

function recordKey(r: AsvRecordRow): string {
  return `${squish(r.date)}|${squish(r.label)}|${squish(r.detail)}`;
}

function mergeRowLists<T>(
  oneautoRows: T[],
  jojRows: T[],
  hasData: (r: T) => boolean,
  key: (r: T) => string,
  empty: () => T,
): T[] {
  const out: T[] = oneautoRows.filter(hasData);
  const seen = new Set(out.map(key));
  for (const row of jojRows.filter(hasData)) {
    const k = key(row);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(row);
  }
  return out.length > 0 ? out : [empty()];
}

function byDateDesc<T extends { date: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => sortableDate(b.date) - sortableDate(a.date));
}

function pickScalar(
  field: keyof AsvSourceAttribution["scalars"],
  oneauto: string,
  joj: string,
  defaultSource: AsvDataSourceId,
): { value: string; chosen: AsvDataSourceId } {
  const o = oneauto.trim();
  const j = joj.trim();
  if (o) return { value: o, chosen: "oneauto" };
  if (j) return { value: j, chosen: "joj" };
  return { value: "", chosen: defaultSource };
}

function strongerScalar(
  field: string,
  oneauto: string,
  joj: string,
): { stronger: AsvOverlapStronger; chosen: AsvDataSourceId } {
  const o = oneauto.trim();
  const j = joj.trim();
  if (!o && !j) return { stronger: "tie", chosen: "oneauto" };
  if (!o) return { stronger: "joj", chosen: "joj" };
  if (!j) return { stronger: "oneauto", chosen: "oneauto" };
  if (squish(o) === squish(j)) return { stronger: "tie", chosen: "oneauto" };
  const nmvtisFields = new Set(["Atskaites datums", "Atzīmes reģistros", "Īpašnieku skaits"]);
  if (nmvtisFields.has(field)) return { stronger: "oneauto", chosen: "oneauto" };
  const auctionFields = new Set(["Jaunākās izsoles odometrs", "Jaunākās izsoles cena"]);
  if (auctionFields.has(field)) return { stronger: "joj", chosen: "joj" };
  if (o.length > j.length) return { stronger: "oneauto", chosen: "oneauto" };
  if (j.length > o.length) return { stronger: "joj", chosen: "joj" };
  return { stronger: "tie", chosen: "oneauto" };
}

function latestSale(sales: AsvSaleRow[]): AsvSaleRow | null {
  const rows = sales.filter(asvSaleRowHasData);
  if (rows.length === 0) return null;
  return byDateDesc(rows)[0] ?? null;
}

function overlapLabelStronger(stronger: AsvOverlapStronger): string {
  if (stronger === "oneauto") return "OneAuto";
  if (stronger === "joj") return "JoJ";
  return "Vienādi";
}

export function buildAsvOverlapCompareRows(snapshots: AsvSourceSnapshots): AsvOverlapCompareRow[] {
  const o = snapshots.oneauto ?? emptyAsvSourceTableBundle();
  const j = snapshots.joj ?? emptyAsvSourceTableBundle();
  const rows: AsvOverlapCompareRow[] = [];

  const scalarFields: { field: string; o: string; j: string }[] = [
    { field: "Atskaites datums", o: o.reportDate, j: j.reportDate },
    { field: "Atzīmes reģistros", o: o.attentionMarks, j: j.attentionMarks },
    { field: "Īpašnieku skaits", o: o.ownersCount, j: j.ownersCount },
  ];

  const oSale = latestSale(o.sales);
  const jSale = latestSale(j.sales);
  if (oSale || jSale) {
    scalarFields.push({
      field: "Jaunākās izsoles odometrs",
      o: oSale?.odometer ?? "",
      j: jSale?.odometer ?? "",
    });
    scalarFields.push({
      field: "Jaunākās izsoles cena",
      o: oSale?.price ?? "",
      j: jSale?.price ?? "",
    });
  }

  const oDmg = byDateDesc(o.damages.filter(asvDamageRowHasData))[0];
  const jDmg = byDateDesc(j.damages.filter(asvDamageRowHasData))[0];
  if (oDmg || jDmg) {
    scalarFields.push({
      field: "Galvenais bojājums (apraksts)",
      o: oDmg?.description ?? "",
      j: jDmg?.description ?? "",
    });
  }

  for (const { field, o: ov, j: jv } of scalarFields) {
    if (!ov.trim() || !jv.trim()) continue;
    const { stronger, chosen } = strongerScalar(field, ov, jv);
    rows.push({ field, oneauto: ov.trim(), joj: jv.trim(), stronger, chosen });
  }
  return rows;
}

export function mergeAsvSourceSnapshots(
  snapshots: AsvSourceSnapshots,
  defaultSource: AsvDataSourceId = "oneauto",
): {
  tables: AsvSourceTableBundle;
  overlapCompare: AsvOverlapCompareRow[];
  attribution: AsvSourceAttribution;
} {
  const oneauto = snapshots.oneauto ?? emptyAsvSourceTableBundle();
  const joj = snapshots.joj ?? emptyAsvSourceTableBundle();

  const reportDatePick = pickScalar("reportDate", oneauto.reportDate, joj.reportDate, defaultSource);
  const attentionPick = pickScalar("attentionMarks", oneauto.attentionMarks, joj.attentionMarks, defaultSource);
  const ownersPick = pickScalar("ownersCount", oneauto.ownersCount, joj.ownersCount, defaultSource);

  const checks = oneauto.checks.length > 0 ? oneauto.checks : joj.checks;

  const tables: AsvSourceTableBundle = {
    reportDate: reportDatePick.value,
    attentionMarks: attentionPick.value,
    ownersCount: ownersPick.value,
    checks,
    mileage: byDateDesc(
      mergeRowLists(oneauto.mileage, joj.mileage, autoRecordsRowHasData, mileageKey, emptyAsvMileageRow),
    ),
    damages: byDateDesc(
      mergeRowLists(oneauto.damages, joj.damages, asvDamageRowHasData, damageKey, emptyAsvDamageRow),
    ),
    brands: byDateDesc(
      mergeRowLists(oneauto.brands, joj.brands, asvRecordRowHasData, recordKey, emptyAsvRecordRow),
    ),
    titles: byDateDesc(
      mergeRowLists(oneauto.titles, joj.titles, asvTitleRowHasData, titleKey, emptyAsvTitleRow),
    ),
    sales: byDateDesc(
      mergeRowLists(oneauto.sales, joj.sales, asvSaleRowHasData, saleKey, emptyAsvSaleRow),
    ),
    liens: byDateDesc(
      mergeRowLists(oneauto.liens, joj.liens, asvRecordRowHasData, recordKey, emptyAsvRecordRow),
    ),
    thefts: byDateDesc(
      mergeRowLists(oneauto.thefts, joj.thefts, asvRecordRowHasData, recordKey, emptyAsvRecordRow),
    ),
    notes: [...oneauto.notes, ...joj.notes.filter((n) => !oneauto.notes.some((o) => squish(o) === squish(n)))],
  };

  const overlapCompare = buildAsvOverlapCompareRows(snapshots);
  const attribution: AsvSourceAttribution = {
    defaultSource,
    scalars: {
      reportDate: reportDatePick.chosen,
      attentionMarks: attentionPick.chosen,
      ownersCount: ownersPick.chosen,
    },
  };

  return { tables, overlapCompare, attribution };
}

export function ensureAsvSourceSnapshots(prev: AsvBlockState): AsvSourceSnapshots {
  const existing = prev.sources ?? {};
  if (existing.oneauto || existing.joj) return { ...existing };
  if (prev.lastFetchedVin.trim()) {
    return { ...existing, oneauto: bundleFromAsvDisplay(prev) };
  }
  return { ...existing };
}

export function applyMergedTablesToAsvBlock(
  prev: AsvBlockState,
  snapshots: AsvSourceSnapshots,
  merged: ReturnType<typeof mergeAsvSourceSnapshots>,
): AsvBlockState {
  const t = merged.tables;
  const jojNotes = (snapshots.joj?.notes ?? []).filter((n) => n.trim()).join("\n\n");
  const rawBase = prev.rawUnprocessedData.trim();
  const rawUnprocessedData = [rawBase, jojNotes && !rawBase.includes(jojNotes) ? jojNotes : ""]
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 200_000);
  const aiContextRaw = [prev.aiContextRaw.trim(), jojNotes].filter(Boolean).join("\n\n").slice(0, 20_000);

  const ccView = asvBlockToCcVinView(prev) ?? emptyCcVinBlock();
  const ccFromTables = applyCcVinParsedReport(
    {
      vin: "",
      vehicleLine: "",
      reportDate: t.reportDate,
      attentionMarks: t.attentionMarks,
      ownersCount: t.ownersCount,
      checks: t.checks,
      mileage: t.mileage,
      damages: t.damages,
      insurance: [],
      brands: t.brands,
      titles: t.titles,
      sales: t.sales,
      notes: t.notes,
    },
    ccView,
  );

  return {
    ...prev,
    reportDate: t.reportDate,
    attentionMarks: t.attentionMarks,
    ownersCount: t.ownersCount,
    checks: ccFromTables.checks.length > 0 ? ccFromTables.checks : t.checks,
    mileage: ccFromTables.mileage,
    damages: ccFromTables.damages,
    brands: ccFromTables.brands,
    titles: ccFromTables.titles,
    sales: ccFromTables.sales,
    liens: t.liens.length > 0 ? t.liens : prev.liens,
    thefts: t.thefts.length > 0 ? t.thefts : prev.thefts,
    rawUnprocessedData,
    aiContextRaw,
    sources: snapshots,
    overlapCompare: merged.overlapCompare,
    sourceAttribution: merged.attribution,
  };
}

export function recomputeAsvBlockFromSources(prev: AsvBlockState): AsvBlockState {
  const snapshots = ensureAsvSourceSnapshots(prev);
  const merged = mergeAsvSourceSnapshots(snapshots);
  return applyMergedTablesToAsvBlock(prev, snapshots, merged);
}

export function setAsvOneautoSnapshot(prev: AsvBlockState, oneautoBundle: AsvSourceTableBundle): AsvBlockState {
  const snapshots: AsvSourceSnapshots = {
    ...ensureAsvSourceSnapshots(prev),
    oneauto: oneautoBundle,
  };
  const merged = mergeAsvSourceSnapshots(snapshots);
  return applyMergedTablesToAsvBlock(prev, snapshots, merged);
}

export function setAsvJojSnapshot(prev: AsvBlockState, jojBundle: AsvSourceTableBundle): AsvBlockState {
  const snapshots: AsvSourceSnapshots = {
    ...ensureAsvSourceSnapshots(prev),
    joj: jojBundle,
  };
  const merged = mergeAsvSourceSnapshots(snapshots);
  return applyMergedTablesToAsvBlock(prev, snapshots, merged);
}

export function overlapStrongerDisplayLabel(row: AsvOverlapCompareRow): string {
  return overlapLabelStronger(row.stronger);
}

/** Vienreizēja migrācija: ja blokā nav sources, bet ir tikai OneAuto dati. */
export function normalizeAsvSourcesOnBlock(block: AsvBlockState): AsvBlockState {
  if (block.sources?.oneauto || block.sources?.joj) {
    if (block.overlapCompare && block.sourceAttribution) return block;
    const merged = mergeAsvSourceSnapshots(block.sources);
    return { ...block, overlapCompare: merged.overlapCompare, sourceAttribution: merged.attribution };
  }
  if (!block.lastFetchedVin.trim() && !block.jojIngest?.lastFetchedVin.trim()) return block;
  return recomputeAsvBlockFromSources(block);
}
