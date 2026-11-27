/**
 * Eļļas intervālu grafiks: strukturēti dati adminā + tā pati sērija kā PDF.
 */
import { dropFutureDatedRows } from "@/lib/future-date-guard";
import type { AutoRecordsBlockState } from "@/lib/admin-source-blocks";
import {
  collectEngineOilChangeRows,
  collectPossibleOilChangeRows,
  buildOilChangeIntervalSeries,
  type OilChangeIntervalSeries,
  type OilCurrentReading,
} from "@/lib/oil-change-intervals";
import type { AutoRecordsServiceWorkRow } from "@/lib/auto-records-service-works";
import {
  defaultOemOilIntervalForVehicle,
  formatOemOilCaption,
  OEM_UNKNOWN_LINE_RE,
  oilIntervalKmTolerance,
  parseOemOilIntervalFromText,
  type OemOilInterval,
} from "@/lib/oem-oil-interval";
import { parseDotOrIsoDateToMs } from "@/lib/clean-date-str";
import { isImpossibleFutureDate } from "@/lib/future-date-guard";
import { oneautoDisplayToServiceWorks } from "@/lib/oneauto-dealer";
import { getAutoRecordsOutvinBundle } from "@/lib/outvin-admin-sync";
import { outvinDealerServiceRowHasData } from "@/lib/outvin-data-bundle";
import {
  detectOilNoteLang,
  ensureOilIntervalNotes,
  findExceededOilIntervals,
  isGenericDealerRecordWork,
  oilTextClaimsExceeded,
  replaceOilStepWordingLv,
  type OilExceededInterval,
  type OilNoteLang,
} from "@/lib/oil-interval-dealer-notes";
import {
  isBatteryElectricVehicle,
  normalizeBevOemLine,
  stripOilChangeContentForBev,
  type BevSignals,
} from "@/lib/vehicle-bev";

export type OilIntervalChartRow = {
  id: string;
  date: string;
  odometer: string;
  works: string;
};

export type OilIntervalChartState = {
  rows: OilIntervalChartRow[];
  oemKm: number | null;
  oemMonths: number | null;
  highlightOverOem: boolean;
  /** Kad true, PDF un admin izmanto `rows`, nevis automātisko importu no servisa. */
  useSavedRows: boolean;
};

export function emptyOilIntervalChartRow(): OilIntervalChartRow {
  return { id: newOilIntervalRowId(), date: "", odometer: "", works: "Eļļas maiņa" };
}

export function newOilIntervalRowId(): string {
  return `oil_${Math.random().toString(36).slice(2, 11)}`;
}

export function emptyOilIntervalChart(): OilIntervalChartState {
  return {
    rows: [],
    oemKm: null,
    oemMonths: null,
    highlightOverOem: true,
    useSavedRows: false,
  };
}

function clampOemKm(n: number | null): number | null {
  if (n == null || !Number.isFinite(n)) return null;
  const v = Math.round(n);
  if (v < 3_000 || v > 40_000) return null;
  return v;
}

function clampOemMonths(n: number | null): number | null {
  if (n == null || !Number.isFinite(n)) return null;
  const v = Math.round(n);
  if (v < 6 || v > 36) return null;
  return v;
}

export function normalizeOilIntervalChart(raw: unknown): OilIntervalChartState | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const rowsIn = Array.isArray(o.rows) ? o.rows : [];
  const rows: OilIntervalChartRow[] = rowsIn
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const r = row as Record<string, unknown>;
      const date = typeof r.date === "string" ? r.date.slice(0, 32) : "";
      const odometer = typeof r.odometer === "string" ? r.odometer.slice(0, 32) : "";
      const works = typeof r.works === "string" ? r.works.slice(0, 240) : "Eļļas maiņa";
      const id = typeof r.id === "string" && r.id.trim() ? r.id.slice(0, 48) : newOilIntervalRowId();
      if (!date.trim() && !odometer.trim() && !works.trim()) return null;
      return { id, date, odometer, works: works.trim() || "Eļļas maiņa" };
    })
    .filter((r): r is OilIntervalChartRow => r != null);
  const oemKm = clampOemKm(typeof o.oemKm === "number" ? o.oemKm : null);
  const oemMonths = clampOemMonths(typeof o.oemMonths === "number" ? o.oemMonths : null);
  const highlightOverOem = o.highlightOverOem !== false;
  const useSavedRows = o.useSavedRows === true;
  if (
    rows.length === 0 &&
    oemKm == null &&
    oemMonths == null &&
    highlightOverOem &&
    !useSavedRows
  ) {
    return undefined;
  }
  return { rows, oemKm, oemMonths, highlightOverOem, useSavedRows };
}

/** Tās pašas rindas kā `dealerOilIntervalSourceRows` client-report-html. */
export function dealerOilIntervalSourceRows(b: AutoRecordsBlockState): AutoRecordsServiceWorkRow[] {
  const original = oneautoDisplayToServiceWorks({
    equipment: [],
    powertrain: [],
    serviceTimeline: b.oneautoIngest?.serviceTimelineOriginal ?? [],
  });
  const log = getAutoRecordsOutvinBundle(b)
    .dealerServiceLog.filter(outvinDealerServiceRowHasData)
    .map((r) => ({
      date: r.date,
      odometer: r.odometer,
      location: r.country,
      works: r.serviceNotes,
    }));
  return [...(b.serviceWorks ?? []), ...original, ...log];
}

/**
 * Pierādītās eļļas maiņas + iespējamās (eļļas filtra korpuss bez eļļas maiņas, Nils 27.11) hronoloģiski.
 * Iespējamās rindas paliek ar oriģinālo darbu tekstu - sērija tās atpazīst un intervālos neskaita.
 */
export function oilRowsFromServiceWorks(block: AutoRecordsBlockState): OilIntervalChartRow[] {
  const source = dealerOilIntervalSourceRows(block);
  const proven = collectEngineOilChangeRows(source);
  const possible = collectPossibleOilChangeRows(source);
  const ms = (d: string) => parseDotOrIsoDateToMs(d) || 0;
  return [...proven, ...possible]
    .map((r, i) => ({ r, i }))
    .sort((a, b) => {
      const ta = ms(a.r.date);
      const tb = ms(b.r.date);
      return ta && tb && ta !== tb ? ta - tb : a.i - b.i;
    })
    .map(({ r }) => ({
      id: newOilIntervalRowId(),
      date: r.date,
      odometer: r.odometer,
      works: r.works.trim() || "Eļļas maiņa",
    }));
}

export function chartRowsToServiceWorks(rows: OilIntervalChartRow[]): AutoRecordsServiceWorkRow[] {
  // Saglabātās eļļas rindas ar datumu nākotnē nav fakts (Nils 23.11.2026).
  return dropFutureDatedRows(rows)
    .filter((r) => r.date.trim() || r.odometer.trim())
    .map((r) => ({
      date: r.date.trim(),
      odometer: r.odometer.trim(),
      location: "",
      works: r.works.trim() || "Eļļas maiņa",
    }));
}

export function resolveOilIntervalChartRows(block: AutoRecordsBlockState): OilIntervalChartRow[] {
  const chart = block.oilIntervalChart;
  if (chart?.useSavedRows && chart.rows.length > 0) {
    return chart.rows;
  }
  const imported = oilRowsFromServiceWorks(block);
  return imported;
}

export function oemFallbackText(block: AutoRecordsBlockState): string {
  return `${block.oilChangeIntervalNotes ?? ""}\n${block.comments ?? ""}\n${block.serviceHistoryNotes ?? ""}`;
}

/** Teksta vērtības no OneAuto dekodēšanas atbildēm (marka, modelis, degviela, dzinējs). */
function oneautoVehicleStrings(block: AutoRecordsBlockState, keyRe: RegExp): string[] {
  const out: string[] = [];
  const results = block.oneautoIngest?.results ?? {};
  for (const row of Object.values(results)) {
    const payload = (row as { payload?: unknown } | undefined)?.payload as { result?: unknown } | null | undefined;
    const result = payload && typeof payload === "object" ? payload.result : null;
    if (!result || typeof result !== "object" || Array.isArray(result)) continue;
    for (const [k, v] of Object.entries(result as Record<string, unknown>)) {
      if (typeof v === "string" && keyRe.test(k)) out.push(v);
    }
  }
  return out;
}

/**
 * Ražotāja / dzinēja saimes noklusējums šim auto (BF 27.11, S4), ja tāds ir kodā
 * (`defaultOemOilIntervalForVehicle`: BMW dīzeļi 30 000 km / 24 mēn.). Citādi null - neizdomājam.
 */
export function defaultOemOilIntervalForBlock(block: AutoRecordsBlockState): OemOilInterval | null {
  const vi = block.outvinReport?.vehicleInfo;
  return defaultOemOilIntervalForVehicle({
    vin: vi?.vinCode || block.oneautoIngest?.lastFetchedVin || "",
    descriptions: [
      vi?.model,
      vi?.modelSeries,
      vi?.modelCode,
      vi?.developmentCode,
      ...oneautoVehicleStrings(block, /desc|make|manufacturer|brand|model|derivative|variant/i),
    ],
    fuel: [vi?.fuel, ...oneautoVehicleStrings(block, /fuel/i)],
    engineCodes: [vi?.engineCode, ...oneautoVehicleStrings(block, /engine/i)],
  });
}

/**
 * Nils 27.11.2026: vai dīlera bloka auto ir tīrs elektroauto (BEV). `extra` - CSDD degviela, modelis,
 * dzinēja kods no citiem blokiem; `oilText` - eļļas lauka pirmā rinda «nav piemērojams (elektroauto …)».
 */
export function oilBlockIsBev(
  block: AutoRecordsBlockState | null | undefined,
  extra?: BevSignals,
): boolean {
  const vi = block?.outvinReport?.vehicleInfo;
  const b = block ?? ({} as AutoRecordsBlockState);
  return isBatteryElectricVehicle({
    fuel: [vi?.fuel, ...(block ? oneautoVehicleStrings(b, /fuel/i) : []), ...(extra?.fuel ?? [])],
    engineCodes: [vi?.engineCode, ...(block ? oneautoVehicleStrings(b, /engine/i) : []), ...(extra?.engineCodes ?? [])],
    models: [
      vi?.model,
      vi?.modelSeries,
      ...(block ? oneautoVehicleStrings(b, /desc|model|derivative|variant/i) : []),
      ...(extra?.models ?? []),
    ],
    oilText: extra?.oilText ?? block?.oilChangeIntervalNotes ?? "",
  });
}

export function resolveOilIntervalOem(block: AutoRecordsBlockState): OemOilInterval | null {
  const chart = block.oilIntervalChart;
  if (chart?.oemKm != null) {
    return {
      km: chart.oemKm,
      kmMin: null,
      months: chart.oemMonths,
    };
  }
  return parseOemOilIntervalFromText(oemFallbackText(block)) ?? defaultOemOilIntervalForBlock(block);
}

export function withOilIntervalHighlight(
  series: OilChangeIntervalSeries,
  highlightOverOem: boolean,
): OilChangeIntervalSeries {
  if (highlightOverOem) return series;
  return {
    ...series,
    points: series.points.map((p) => ({
      ...p,
      tone: p.tone === "stretch" ? "ok" : p.tone,
      periodTone: p.periodTone === "stretch" ? "ok" : p.periodTone,
    })),
  };
}

/**
 * `current` - aktuāls nobraukums no cita avota (sludinājums, CSDD, VIN SCAN), ja pasūtījumā ir;
 * bez tā segumu līdz šodienai rēķina pēc laika.
 */
export function buildOilIntervalSeriesForBlock(
  block: AutoRecordsBlockState,
  opts?: { nowMs?: number; current?: OilCurrentReading | null },
): OilChangeIntervalSeries {
  const chart = block.oilIntervalChart;
  const rows = chartRowsToServiceWorks(resolveOilIntervalChartRows(block));
  const oem = resolveOilIntervalOem(block);
  const series = buildOilChangeIntervalSeries(rows, oem, {
    nowMs: opts?.nowMs ?? Date.now(),
    current: opts?.current ?? null,
  });
  return withOilIntervalHighlight(series, chart?.highlightOverOem !== false);
}

function rowKm(odometer: string): number | null {
  const d = (odometer ?? "").replace(/\D/g, "");
  return d ? Number(d) : null;
}

function monthsBetweenMs(fromMs: number, toMs: number): number | null {
  if (!fromMs || !toMs || toMs < fromMs) return null;
  const days = (toMs - fromMs) / (24 * 60 * 60 * 1000);
  if (days < 20) return null;
  return Math.round(days / 30.437);
}

/**
 * Periods pēc pēdējās fiksētās eļļas maiņas līdz pēdējam dīlera ierakstam (BF 27.11, S4 (4)) - ja dīleris
 * auto redzēja, bet eļļas maiņa nav fiksēta ilgāk par OEM, tas ir tāds pats pārsniegums kā starp maiņām.
 * Ja eļļas maiņu nav vispār - periods no pirmā līdz pēdējam dīlera ierakstam (piem. Toyota tikai «Apkope /
 * Lielā apkope»). Vispārīgie ieraksti periodā (ieskaitot pēdējo) - 2. piebildei. Bez OEM - nekas.
 */
function tailExceededInterval(
  series: ReturnType<typeof buildOilChangeIntervalSeries>,
  sourceRows: readonly AutoRecordsServiceWorkRow[],
  oem: OemOilInterval | null,
): OilExceededInterval | null {
  if (!oem) return null;
  const dated = sourceRows
    .filter((r) => (r.date ?? "").trim() && !isImpossibleFutureDate(r.date))
    .map((r) => ({ row: r, ms: parseDotOrIsoDateToMs(r.date) || 0 }))
    .filter((x) => x.ms > 0)
    .sort((a, b) => a.ms - b.ms);
  if (dated.length === 0) return null;
  const lastOil = series.points.at(-1) ?? null;
  const fromMs = lastOil ? parseDotOrIsoDateToMs(lastOil.date) || 0 : dated[0]!.ms;
  if (!fromMs) return null;
  const fromKm = lastOil ? lastOil.km : rowKm(dated[0]!.row.odometer);
  const last = dated.at(-1)!;
  if (last.ms <= fromMs) return null;
  const lastKm = Math.max(0, ...dated.filter((x) => x.ms === last.ms).map((x) => rowKm(x.row.odometer) ?? 0));
  const spanKm = fromKm != null && lastKm > fromKm ? lastKm - fromKm : null;
  const spanMonths = monthsBetweenMs(fromMs, last.ms);
  const overKm = spanKm != null && spanKm > oem.km + oilIntervalKmTolerance(oem.km);
  const overMonths = spanMonths != null && oem.months != null && spanMonths > oem.months;
  if (!overKm && !overMonths) return null;
  const genericDates: string[] = [];
  const seen = new Set<string>();
  for (const x of dated) {
    // Ar eļļas maiņu: pēc tās (ne pati maiņas diena); bez maiņām: viss periods.
    if (lastOil ? x.ms <= fromMs : x.ms < fromMs) continue;
    const d = x.row.date.trim();
    if (seen.has(d) || !isGenericDealerRecordWork(x.row.works)) continue;
    seen.add(d);
    genericDates.push(d);
  }
  return {
    fromDate: lastOil ? lastOil.date : dated[0]!.row.date.trim(),
    toDate: last.row.date.trim(),
    genericDates,
    ...(lastOil
      ? { afterLastChange: { fromKm: fromKm ?? null, toKm: lastKm > 0 ? lastKm : null, km: spanKm, months: spanMonths } }
      : {}),
  };
}

/**
 * Iespējamās eļļas maiņas (eļļas filtra korpuss), kas ir pārsniegtā perioda iekšpusē (Nils 27.11):
 * tās pārsniegumu neaizver, bet 3. piebilde tās nosauc («iespējams, veikta arī eļļas maiņa, bet tas nav
 * pierādīts»). Periods bez beigu datuma (pēc pēdējās maiņas) - līdz šodienai.
 */
function withPossibleOilDates(
  intervals: OilExceededInterval[],
  series: OilChangeIntervalSeries,
): OilExceededInterval[] {
  const possible = (series.possiblePoints ?? [])
    .map((p) => ({ date: p.date, ms: parseDotOrIsoDateToMs(p.date) || 0 }))
    .filter((p) => p.ms > 0);
  if (possible.length === 0) return intervals;
  return intervals.map((iv) => {
    const fromMs = parseDotOrIsoDateToMs(iv.fromDate) || 0;
    const toMs = parseDotOrIsoDateToMs(iv.toDate) || 0;
    if (!fromMs) return iv;
    const possibleDates = possible
      .filter((p) => p.ms > fromMs && (!toMs || p.ms <= toMs))
      .map((p) => p.date);
    return possibleDates.length > 0 ? { ...iv, possibleDates } : iv;
  });
}

/**
 * Pārsniegtie eļļas intervāli piebildēm (`ensureOilIntervalNotes`). Vienmēr pret OEM -
 * arī ja adminā izslēgta pārsniegumu iekrāsošana (likums attiecas uz faktu, ne krāsu).
 * `oemText` - ja OEM jāņem no jauna (vēl nesaglabāta) komentāra teksta; tas pats teksts ir arī
 * `claimText` (ko saka komentārs), ja nav dots atsevišķi.
 *
 * BF 27.11 (S4): (1) ja teksts apgalvo pārsniegumu, bet km pielaide (3 % / 750 km) to slēpj (30 405 pret
 * 30 000 km), pielaidi saskaņo ar tekstu - pārsniegums skaitās bez pielaides; ja kods pārsniegumu nerod
 * vispār (piem. eļļas rindas nav atpazītas), 1. piebilde tomēr ir, jo teksts to apgalvo.
 * (4) periods pēc pēdējās eļļas maiņas līdz pēdējam dīlera ierakstam arī tiek vērtēts.
 */
export function oilExceededIntervalsForBlock(
  block: AutoRecordsBlockState,
  opts?: { oemText?: string; claimText?: string },
): OilExceededInterval[] {
  const rows = chartRowsToServiceWorks(resolveOilIntervalChartRows(block));
  const oem =
    opts?.oemText != null
      ? (resolveOilIntervalOem({ ...block, oilChangeIntervalNotes: opts.oemText }) ??
        resolveOilIntervalOem(block))
      : resolveOilIntervalOem(block);
  const sourceRows = dealerOilIntervalSourceRows(block);
  const series = buildOilChangeIntervalSeries(rows, oem);
  const out = findExceededOilIntervals(series, sourceRows);
  const tail = tailExceededInterval(series, sourceRows, oem);
  if (tail) out.push(tail);
  if (out.length > 0) return withPossibleOilDates(out, series);
  const claim = opts?.claimText ?? opts?.oemText ?? block.oilChangeIntervalNotes ?? "";
  if (!oilTextClaimsExceeded(claim)) return out;
  const strictSeries = buildOilChangeIntervalSeries(rows, oem, { kmTolerance: 0 });
  const strict = findExceededOilIntervals(strictSeries, sourceRows);
  if (strict.length > 0) return withPossibleOilDates(strict, strictSeries);
  // Teksts saka «pārsniedz», kods periodu nenosaka - 1. piebilde vienalga (bez 2. piebildes datumiem).
  return [{ fromDate: "", toDate: "", genericDates: [] }];
}

/**
 * AI «Ražotāja intervāls: nav droši zināms», bet kodā ir ražotāja / dzinēja saimes noklusējums
 * (BMW dīzeļi 30 000 km / 24 mēn.) -> pirmā rinda ar šo intervālu (tā pati vērtība, ko lieto tabula).
 */
export function applyDefaultOemLine(block: AutoRecordsBlockState, text: string): string {
  if (!OEM_UNKNOWN_LINE_RE.test(text ?? "")) return text;
  if (block.oilIntervalChart?.oemKm != null) return text;
  const def = defaultOemOilIntervalForBlock(block);
  return def ? text.replace(OEM_UNKNOWN_LINE_RE, formatOemOilCaption(def)) : text;
}

/**
 * Eļļas komentārs ar obligātajām piebildēm (Nils 26.11.2026).
 * BEV (Nils 27.11.2026): eļļas maiņas rindkopas izmet, piebildes nepievieno, pirmā rinda
 * «Ražotāja intervāls: nav piemērojams (elektroauto, KODS).».
 */
export function oilIntervalNotesWithRequiredNotes(
  block: AutoRecordsBlockState,
  text: string,
  lang?: OilNoteLang | null,
  opts?: { bev?: boolean; engineCode?: string | null },
): string {
  if (!(text ?? "").trim()) return text ?? "";
  const bev = opts?.bev ?? oilBlockIsBev(block, { oilText: text });
  if (bev) {
    const code = opts?.engineCode ?? block.outvinReport?.vehicleInfo?.engineCode ?? "";
    return stripOilChangeContentForBev(normalizeBevOemLine(replaceOilStepWordingLv(text), code));
  }
  const worded = applyDefaultOemLine(block, replaceOilStepWordingLv(text));
  const intervals = oilExceededIntervalsForBlock(block, { oemText: worded });
  return ensureOilIntervalNotes(worded, intervals, lang ?? detectOilNoteLang(worded));
}
