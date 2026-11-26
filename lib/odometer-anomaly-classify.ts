/**
 * Nobraukuma anomāliju klases (admin brīdinājumi + galvenes „bez pretrunām”).
 * Grafika vizuāli nemaina. Nav maksas modeļa.
 */
import {
  ISOLATED_MILEAGE_DROP_MAX_RECOVERY_MS,
  UNIFIED_MILEAGE_ANOMALY_MIN_DROP_KM,
  analyzeUnifiedMileageAnomalies,
  isIsolatedMileageDrop,
  isListingMileageSource,
  isMileageCountryChange,
  isTrailingSameDaySourcePair,
  parseChartOdometerKm,
  parseOdometerKm,
  prepareUnifiedMileageDisplayRows,
  sortMileageChronological,
  type UnifiedMileageRow,
} from "@/lib/unified-mileage";

/**
 * 24.11 (Nils A): `listing_below` - sludinājumā norādīts mazāks nobraukums nekā agrāk fiksēts
 * (> 1 000 km un > 2 %). Nav odometra korekcija, bet PDF rāda sarkanu, kamēr operators karogu neatceļ.
 */
export type OdometerAnomalyClass = "typo_outlier" | "rollback" | "date_precision" | "listing_below";

export const ODOMETER_ANOMALY_LABEL_LV: Record<OdometerAnomalyClass, string> = {
  typo_outlier: "Iespējama ievades kļūda",
  rollback: "Nobraukuma kritums",
  date_precision: "Datuma neprecizitāte",
  listing_below: "Sludinājumā mazāks nobraukums",
};

export type ClassifiedOdometerAnomaly = {
  /** Stabila atslēga (`odometerAnomalyStableKey`). */
  key: string;
  /** Vecā atslēga (ar `sourceOrder`) - lai atpazītu līdz 24.11 saglabātos lēmumus. */
  legacyKey?: string;
  sourceOrder: number;
  class: OdometerAnomalyClass;
  labelLv: string;
  fromDate: string;
  toDate: string;
  fromKm: number;
  toKm: number;
  dropKm: number;
  /** `listing_below`: avoti abām pusēm (AI faktiem un panelim). */
  fromSource?: string;
  toSource?: string;
};

export type OdometerAnomalyOverrideAction = "confirm" | "dismiss";

export type OdometerAnomalyOverride = {
  key: string;
  action: OdometerAnomalyOverrideAction;
};

/** Vecie pasūtījumi bez lauka paliek `undefined` - netiek pārrakstīti. */
export function parseOdometerAnomalyOverrides(raw: unknown): OdometerAnomalyOverride[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: OdometerAnomalyOverride[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const key = typeof (item as { key?: unknown }).key === "string" ? (item as { key: string }).key.trim() : "";
    const action = (item as { action?: unknown }).action;
    if (!key || (action !== "confirm" && action !== "dismiss") || seen.has(key)) continue;
    seen.add(key);
    out.push({ key, action });
  }
  return out;
}

/** Persistences lauks - tikai ja masīvs ir, lai esošie melnraksti paliek neskarti. */
export function odometerAnomalyOverridesSnapshotField(
  overrides: OdometerAnomalyOverride[] | null | undefined,
): { odometerAnomalyOverrides?: OdometerAnomalyOverride[] } {
  return overrides != null ? { odometerAnomalyOverrides: overrides } : {};
}

/** Vecā (līdz 24.11) atslēga: `datums|odometrs|avots|sourceOrder` - mainās, kad pievieno avotu. */
export function odometerAnomalyKey(row: Pick<UnifiedMileageRow, "date" | "odometer" | "sourceLabel" | "sourceOrder">): string {
  return `${row.date}|${row.odometer}|${row.sourceLabel}|${row.sourceOrder}`;
}

/** Avota tips stabilajai atslēgai (bez «(sludinājums)» / «- vizīte ...» astēm). */
export function odometerSourceType(label: string): string {
  return (label ?? "")
    .replace(/\s*\(sludinājums\)\s*$/i, " sludinājums")
    .replace(/\s*-\s*vizīte.*$/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function normKeyDate(raw: string): string {
  const t = (raw ?? "").trim();
  const dmy = t.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2]!.padStart(2, "0")}-${dmy[1]!.padStart(2, "0")}`;
  const my = t.match(/^(\d{1,2})[./](\d{4})$/);
  if (my) return `${my[2]}-${my[1]!.padStart(2, "0")}`;
  return t.slice(0, 10);
}

/**
 * 24.11 (audits): STABILA atslēga - noteikums + datums + km (noapaļoti līdz 100) + avota tips.
 * Nav `sourceOrder`, tāpēc operatora lēmums nepazūd, kad pievieno vai izslēdz avotu.
 */
export function odometerAnomalyStableKey(
  cls: OdometerAnomalyClass,
  row: Pick<UnifiedMileageRow, "date" | "sourceLabel">,
  km: number,
): string {
  return `v2|${cls}|${normKeyDate(row.date)}|${Math.round(km / 100) * 100}|${odometerSourceType(row.sourceLabel)}`;
}

/** Vecā atslēga atbilst anomālijai pēc datuma + km (±100) - lasot migrē, saglabātos datus nemaina. */
function legacyKeyMatches(legacy: string, a: Pick<ClassifiedOdometerAnomaly, "toDate" | "toKm">): boolean {
  if (legacy.startsWith("v2|")) return false;
  const [date, odo] = legacy.split("|");
  if (!date || odo == null) return false;
  const km = parseOdometerKm(odo);
  return normKeyDate(date) === normKeyDate(a.toDate) && km != null && Math.abs(km - a.toKm) <= 100;
}

/** Operatora lēmums anomālijai: precīza atslēga, tad vecā atslēga (datums + km). */
export function findOdometerAnomalyOverride(
  a: Pick<ClassifiedOdometerAnomaly, "key" | "toDate" | "toKm"> & { legacyKey?: string },
  overrides?: OdometerAnomalyOverride[] | null,
): OdometerAnomalyOverride | undefined {
  if (!overrides?.length) return undefined;
  return (
    overrides.find((o) => o.key === a.key) ??
    (a.legacyKey ? overrides.find((o) => o.key === a.legacyKey) : undefined) ??
    overrides.find((o) => legacyKeyMatches(o.key, a))
  );
}

/** «01.00.2018» / «00.05.2019» - nederīgs datums (rindu neklasificē). */
function invalidRowDate(raw: string): boolean {
  return /(?:^|[./-])00(?:[./-]|$)/.test((raw ?? "").trim().replace(/^(\d{4})-/, "$1."));
}

/** 999 999, 0, 1 km - aizstājējvērtība, nav rādījums. */
function sentinelKm(km: number): boolean {
  return km <= 1 || km >= 1_500_000 || /^9{5,}$/.test(String(Math.round(km)));
}

const DEALER_ROW_RE = /dīler|dealer|oneauto/i;

/** 01.MM.YYYY vai avota mēneša precizitāte - diena izskatās mākslīga. */
export function looksArtificialMonthDay(row: Pick<UnifiedMileageRow, "date" | "datePrecision">): boolean {
  if (row.datePrecision === "month") return true;
  return /^01[./]\d{1,2}[./]\d{2,4}$/.test(row.date.trim());
}

function sameCalendarMonthMs(a: number, b: number): boolean {
  if (!Number.isFinite(a) || !Number.isFinite(b) || a <= 0 || b <= 0) return false;
  const da = new Date(a);
  const db = new Date(b);
  return da.getUTCFullYear() === db.getUTCFullYear() && da.getUTCMonth() === db.getUTCMonth();
}

/**
 * „Atgūšanās” = maksimums atkal sasniegts tajā pašā logā kā izolētai ievades kļūdai (183 d).
 * Pēc attīšanas auto brauc tālāk un pēc gadiem pārsniedz veco maksimumu - tas kritumu neatceļ
 * (Škoda TMBJH9NP9H7561596: SE 253 760 km 05.2020 → LV 181 345 km 09.2020 → 275 181 km 2025).
 */
function laterPointsStayBelow(
  pts: { km: number; row: Pick<UnifiedMileageRow, "sortableTime"> }[],
  fromIndex: number,
  peakKm: number,
): boolean {
  const dropTime = pts[fromIndex]?.row.sortableTime;
  const later = pts.slice(fromIndex + 1);
  if (later.length === 0) return true;
  const recovered = later.some((p) => {
    if (p.km < peakKm) return false;
    if (dropTime == null || !Number.isFinite(dropTime) || !Number.isFinite(p.row.sortableTime)) return true;
    return p.row.sortableTime - dropTime <= ISOLATED_MILEAGE_DROP_MAX_RECOVERY_MS;
  });
  return !recovered;
}

export function classifyOdometerAnomalies(rows: UnifiedMileageRow[]): ClassifiedOdometerAnomaly[] {
  // 24.11 audits: 999 999 / 0 km un nederīgi datumi («01.00.2018») nav rādījumi.
  const sorted = sortMileageChronological(
    rows.filter((r) => {
      const km = parseOdometerKm(r.odometer);
      return !invalidRowDate(r.date) && (km == null || !sentinelKm(km));
    }),
  );
  const analysis = analyzeUnifiedMileageAnomalies(sorted);
  const pts: Array<{
    row: UnifiedMileageRow;
    km: number;
  }> = [];
  for (const r of sorted) {
    const km = parseOdometerKm(r.odometer);
    if (km == null) continue;
    // Novecojuša dokumenta atkārtojums nav salīdzināšanas punkts (kā grafikā), citādi nākamais
    // rādījums tiek mērīts pret to, nevis pret īsto iepriekšējo maksimumu, un kritums pazūd.
    if (analysis.staleDocumentSourceOrders.has(r.sourceOrder)) continue;
    pts.push({ row: r, km });
  }

  const out: ClassifiedOdometerAnomaly[] = [];
  const seen = new Set<number>();

  // 24.11 (Nils A): sludinājuma rindas analīzes ciklā izlaistas - šeit atsevišķa klase ar salīdzināto fiksēto rādījumu.
  for (const r of sorted) {
    const ref = analysis.listingBelowReferenceBySourceOrder?.get(r.sourceOrder);
    const km = parseOdometerKm(r.odometer);
    if (!ref || km == null) continue;
    seen.add(r.sourceOrder);
    out.push({
      key: odometerAnomalyStableKey("listing_below", r, km),
      legacyKey: odometerAnomalyKey(r),
      sourceOrder: r.sourceOrder,
      class: "listing_below",
      labelLv: ODOMETER_ANOMALY_LABEL_LV.listing_below,
      fromDate: ref.date,
      toDate: r.date,
      fromKm: ref.km,
      toKm: km,
      dropKm: ref.km - km,
      fromSource: ref.sourceLabel,
      toSource: r.sourceLabel,
    });
  }

  const push = (
    row: UnifiedMileageRow,
    cls: OdometerAnomalyClass,
    fromDate: string,
    fromKm: number,
    toKm: number,
    hasRef = true,
  ) => {
    if (seen.has(row.sourceOrder)) return;
    // 24.11 audits: «ievades kļūda» tikai, ja ir kritums; vienāds km vai pieaugums tajā pašā dienā (dīlera vizītes
    // atvēršana / aizvēršana, ±7 d) nav anomālija.
    if (cls === "typo_outlier" && hasRef && toKm >= fromKm) {
      const fromRow = sorted.find((r) => r.date === fromDate && parseOdometerKm(r.odometer) === fromKm);
      const gap = fromRow ? Math.abs(row.sortableTime - fromRow.sortableTime) : Number.POSITIVE_INFINITY;
      const dealerPair = DEALER_ROW_RE.test(row.sourceLabel) && fromRow != null && DEALER_ROW_RE.test(fromRow.sourceLabel);
      if (toKm === fromKm || (dealerPair && gap <= 7 * 24 * 60 * 60 * 1000)) return;
    }
    seen.add(row.sourceOrder);
    out.push({
      key: odometerAnomalyStableKey(cls, row, toKm),
      legacyKey: odometerAnomalyKey(row),
      sourceOrder: row.sourceOrder,
      class: cls,
      labelLv: ODOMETER_ANOMALY_LABEL_LV[cls],
      fromDate,
      toDate: row.date,
      fromKm,
      toKm,
      // Izlēcējam uz augšu (viena cipara kļūda) starpība ir pozitīva; kritumiem nemainās.
      dropKm: Math.abs(fromKm - toKm),
    });
  };

  // 19.11: izlēcējs uz augšu (viena cipara / ×10 kļūda) - grafikā nav, un nākamais rādījums nav jāmēra pret to.
  // Tikai viena cipara izlēcējs (sērija tā līmeni sasniedz gada laikā); lielie izlēcēji (210 000 -> 120 000) paliek
  // salīdzināšanas punkts, lai īsta korekcija netiktu paslēpta.
  const isUpwardSpike = (row: UnifiedMileageRow) => analysis.typoSpikeSourceOrders?.has(row.sourceOrder) === true;

  for (let i = 0; i < pts.length; i++) {
    const curr = pts[i]!;
    // Ievades kļūda (arī kļūdains pirmais rādījums) nav salīdzināšanas punkts nākamajam.
    let prevIdx = i - 1;
    while (
      prevIdx >= 0 &&
      (analysis.dataEntryErrorSourceOrders.has(pts[prevIdx]!.row.sourceOrder) || isUpwardSpike(pts[prevIdx]!.row))
    ) {
      prevIdx -= 1;
    }
    const prev = prevIdx >= 0 ? pts[prevIdx]! : null;
    const next = i < pts.length - 1 ? pts[i + 1]! : null;
    const src = curr.row;

    if (analysis.dataEntryErrorSourceOrders.has(src.sourceOrder)) {
      push(src, "typo_outlier", prev?.row.date ?? src.date, prev?.km ?? curr.km, curr.km, prev != null);
      continue;
    }
    if (isUpwardSpike(src)) {
      push(src, "typo_outlier", prev?.row.date ?? src.date, prev?.km ?? curr.km, curr.km, prev != null);
      continue;
    }

    // Sērijas pēdējais vienas dienas viena avota pāris: augstākais partneris nav "atgūšanās" (šaubās kritumu rāda).
    const trailingPair = isTrailingSameDaySourcePair(src, next?.row, i + 2 >= pts.length);

    if (
      prev &&
      !trailingPair &&
      isIsolatedMileageDrop(curr.km, prev.km, next?.km ?? null, src.sortableTime, next?.row.sortableTime) &&
      !isListingMileageSource(src) &&
      !isMileageCountryChange(prev.row, src)
    ) {
      push(src, "typo_outlier", prev.row.date, prev.km, curr.km);
      continue;
    }

    if (prev == null) continue;
    const drop = prev.km - curr.km;
    if (drop < UNIFIED_MILEAGE_ANOMALY_MIN_DROP_KM) continue;
    if (isListingMileageSource(src)) continue;
    if (analysis.staleDocumentSourceOrders.has(src.sourceOrder)) continue;
    if (src.visitOdometer) continue;

    const sameMonth = sameCalendarMonthMs(prev.row.sortableTime, src.sortableTime);
    if (sameMonth && (looksArtificialMonthDay(prev.row) || looksArtificialMonthDay(src))) {
      push(src, "date_precision", prev.row.date, prev.km, curr.km);
      continue;
    }

    // Nils 18.11: kritums valsts maiņas brīdī ir manipulācija arī tad, ja vēlāk rādījumi atgūstas.
    if (trailingPair || isMileageCountryChange(prev.row, src) || laterPointsStayBelow(pts, i, prev.km)) {
      push(src, "rollback", prev.row.date, prev.km, curr.km);
    }
  }

  return out;
}

export function isOdometerAnomalyDismissed(
  anomaly: Pick<ClassifiedOdometerAnomaly, "key" | "toDate" | "toKm"> & { legacyKey?: string },
  overrides?: OdometerAnomalyOverride[] | null,
): boolean {
  return findOdometerAnomalyOverride(anomaly, overrides)?.action === "dismiss";
}

export function applyOdometerAnomalyOverrides(
  anomalies: ClassifiedOdometerAnomaly[],
  overrides?: OdometerAnomalyOverride[] | null,
): ClassifiedOdometerAnomaly[] {
  if (!overrides?.length) return anomalies;
  return anomalies.filter((a) => !isOdometerAnomalyDismissed(a, overrides));
}

/** 24.11 (Nils A): aktīvās (operatora neatceltās) „sludinājumā mazāk” rindas. */
export function activeListingBelowAnomalies(
  rows: UnifiedMileageRow[],
  overrides?: OdometerAnomalyOverride[] | null,
): ClassifiedOdometerAnomaly[] {
  return applyOdometerAnomalyOverrides(classifyOdometerAnomalies(rows), overrides).filter(
    (a) => a.class === "listing_below",
  );
}

/** Kopsavilkuma / PDF teksts: „sludinājumā (27.09.2015) par 13 880 km mazāk nekā fiksēts” (datums, ja zināms). */
export function formatListingBelowShortLv(dropKm: number, listingDate?: string | null): string {
  const d = (listingDate ?? "").trim();
  return `sludinājumā${d ? ` (${d})` : ""} par ${formatKmGroupedLv(dropKm)} km mazāk nekā fiksēts`;
}

/** PDF piezīme zem tabulas ar abiem skaitļiem un datumiem (tikai fakts, bez ieteikuma). */
export function formatListingBelowFactLv(a: Pick<ClassifiedOdometerAnomaly, "toDate" | "toKm" | "fromDate" | "fromKm" | "dropKm">): string {
  return `Sludinājumā (${a.toDate}) norādīts ${formatKmGroupedLv(a.toKm)} km - par ${formatKmGroupedLv(a.dropKm)} km mazāk nekā iepriekš fiksētais ${formatKmGroupedLv(a.fromKm)} km (${a.fromDate}).`;
}

function formatKmGroupedLv(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

export function hasActiveRollbackAnomaly(
  rows: UnifiedMileageRow[],
  overrides?: OdometerAnomalyOverride[] | null,
): boolean {
  const active = applyOdometerAnomalyOverrides(classifyOdometerAnomalies(rows), overrides);
  return active.some((a) => a.class === "rollback");
}

export function countChartMileageReadings(rows: UnifiedMileageRow[]): number {
  const exclude = analyzeUnifiedMileageAnomalies(rows).chartExcludeSourceOrders;
  let n = 0;
  for (const r of sortMileageChronological(rows)) {
    if (exclude.has(r.sourceOrder)) continue;
    if (parseChartOdometerKm(r.odometer) == null) continue;
    if (r.sortableTime === Number.NEGATIVE_INFINITY) continue;
    n += 1;
  }
  return n;
}

/**
 * Jaunākais APSTIPRINĀTAIS rādījums (reģistrs / dīleris / TA / vēstures avoti; ne sludinājums, ne izslēgtais
 * izlēcējs). Bez rezerves uz sludinājumu - ja apstiprināta nav, `null`. Viena izvēle faktu lapai un PDF 1. lapai
 * (26.11 regresija: kartītē bija ss.lv km, faktu lapā «nav»).
 */
export function selectLatestConfirmedMileageRow<T extends UnifiedMileageRow>(rows: T[]): T | null {
  const exclude = analyzeUnifiedMileageAnomalies(rows).chartExcludeSourceOrders;
  const visible = sortMileageChronological(rows).filter((r) => {
    if (exclude.has(r.sourceOrder)) return false;
    if (parseOdometerKm(r.odometer) == null) return false;
    if (r.sortableTime === Number.NEGATIVE_INFINITY) return false;
    return !isListingMileageSource(r);
  }) as T[];
  return visible[visible.length - 1] ?? null;
}

const LATEST_CONFIRMED_LABEL_WINDOW_MS = 62 * 24 * 60 * 60 * 1000;

/**
 * Jaunākais apstiprinātais rādījums no AVOTU rindām (km un datums - no paša apstiprinātā ieraksta, ne no
 * sludinājuma, ar ko tabulā tas apvienots) + viens avota nosaukums: tabulas rindas pirmais ne-sludinājuma avots.
 * Vienīgā izvēle faktu lapai («Jaunākais rādījums») un PDF 1. lapas odometra kartītei (26.11).
 */
export function resolveLatestConfirmedMileage(
  rows: UnifiedMileageRow[],
): { row: UnifiedMileageRow; sourceLabel: string } | null {
  const raw = selectLatestConfirmedMileageRow(rows);
  if (!raw) return null;
  const km = parseOdometerKm(raw.odometer);
  const own = raw.sourceLabel.trim().toLowerCase();
  const display = prepareUnifiedMileageDisplayRows(rows).find(
    (d) =>
      d.sourceLabels.some((l) => l.trim().toLowerCase() === own) &&
      Math.abs(d.sortableTime - raw.sortableTime) <= LATEST_CONFIRMED_LABEL_WINDOW_MS &&
      (parseOdometerKm(d.odometer) === km || d.date.trim() === raw.date.trim()),
  );
  const label = display?.sourceLabels.find((l) => !isListingMileageSource({ sourceLabel: l })) ?? raw.sourceLabel;
  return { row: raw, sourceLabel: label };
}

/** Pēdējais grafika / verificētais punkts (ne sludinājums, ne izslēgtais izlēcējs). */
export function selectNewestChartMileageRow<T extends UnifiedMileageRow>(rows: T[]): T | null {
  const exclude = analyzeUnifiedMileageAnomalies(rows).chartExcludeSourceOrders;
  const visible = sortMileageChronological(rows).filter((r) => {
    if (exclude.has(r.sourceOrder)) return false;
    if (parseOdometerKm(r.odometer) == null) return false;
    if (r.sortableTime === Number.NEGATIVE_INFINITY) return false;
    return !isListingMileageSource(r);
  }) as T[];
  if (visible.length === 0) {
    const any = sortMileageChronological(rows).filter(
      (r) => !exclude.has(r.sourceOrder) && parseOdometerKm(r.odometer) != null,
    ) as T[];
    return any[any.length - 1] ?? null;
  }
  return visible[visible.length - 1] ?? null;
}
