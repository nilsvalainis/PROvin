/**
 * Eļļas maiņas intervāli no oficiālā dīlera servisa rindu tabulas.
 * Tikai dzinēja eļļa; kārbas / Haldex / tilta eļļa netiek skaitīta kā šīs sērijas punkts.
 *
 * Gredzena / vidējā vadlīnijas (datu iztrūkums nav „garš intervāls”):
 * 1. Starp divām fiksētām dzinēja eļļas maiņām rēķinām Δ km un Δ mēnešus atsevišķi.
 * 2. Solis ir datu iztrūkums (nav gredzenā), ja Δ km > 30 000 vai Δ mēneši > 24
 *    (kanons: apkope varēja būt ārpus dīlera), vai ja tas ir statistisks izlecējs
 *    pret pārējiem dīlera soļiem (≥ 1,8 × mediāna un > 20 000 km).
 * 3. Gredzens rāda tikai nepārtrauktos dīlera soļus. Ja tādu nav, gredzenu nerāda.
 * 4. Periods (mēneši) nekad nav gredzena skaitlī; tas ir atsevišķs rādījums no tiem
 *    pašiem soļiem, kas iekļauti gredzenā.
 * 5. Krāsas (zaļa / oranža / sarkana) ir pret ŠĪ motora ražotāja intervālu.
 *    Pelēka paliek datu iztrūkumam. Bez OEM krāsa ir neitrāla zila, ne zaļa.
 */

import {
  formatServiceWorkOdometer,
  type AutoRecordsServiceWorkRow,
} from "@/lib/auto-records-service-works";
import { parseDotOrIsoDateToMs } from "@/lib/clean-date-str";
import { PDF_BRAND_BLUE_HEX } from "@/lib/client-report-pdf-layout-draft";
import {
  formatOemOilCaption,
  oilRatioTone,
  type OemOilInterval,
} from "@/lib/oem-oil-interval";

const ENGINE_OIL_RE =
  /(?:motor)?e[lļ]{1,2}as\s+mai[nņ]|motore[lļ]|engine\s+oil(?:\s+change)?|\boil\s+change\b|ölwechsel/i;
const GEARBOX_OIL_CHUNK_RE =
  /(?:automātisk[aā]s?|pārnesumu|k[aā]rbas?|dsg|cvt|haldex|aizmugurēj[aā]\s+tilt[aā]|diferenci[aā]l[aā]|transfer(?:\s+case)?|getriebe|transmission|axle|atf)\s+(?:e[lļ]{1,2}as|oil|öl)\s+(?:mai[nņ]a|change|wechsel)/gi;

/** Virs šī km soļa dīlera datos pieņemam iztrūkumu, ne reālu intervālu. */
export const OIL_DEALER_GAP_KM = 30_000;
/** Virs šī mēnešu soļa dīlera datos pieņemam iztrūkumu. */
export const OIL_DEALER_GAP_MONTHS = 24;
/** Izlecējs pret dīlera soļu mediānu. */
export const OIL_OUTLIER_RATIO = 1.8;
export const OIL_OUTLIER_MIN_KM = 20_000;

export type OilIntervalKind = "start" | "observed" | "gap";
export type OilIntervalTone = "ok" | "warn" | "stretch" | "start" | "gap" | "neutral";

export type OilChangeIntervalPoint = {
  date: string;
  odometer: string;
  km: number | null;
  intervalKm: number | null;
  intervalMonths: number | null;
  kind: OilIntervalKind;
  /** Intervāla (km) krāsa pret OEM km. */
  tone: OilIntervalTone;
  /** Perioda krāsa pret OEM mēnešiem. */
  periodTone: OilIntervalTone;
};

export type OilChangeIntervalSeries = {
  points: OilChangeIntervalPoint[];
  changeCount: number;
  /** Vidējais Δ km tikai no dīlera soļiem (gredzens). */
  ringIntervalKm: number | null;
  /** Vidējais Δ mēneši tikai no tiem pašiem soļiem, kas gredzenā. */
  ringIntervalMonths: number | null;
  ringStepCount: number;
  gapStepCount: number;
  ringNote: string;
  avgIntervalKm: number | null;
  avgIntervalMonths: number | null;
  minIntervalKm: number | null;
  maxIntervalKm: number | null;
  oem: OemOilInterval | null;
  ringTone: OilIntervalTone;
  periodChipTone: OilIntervalTone;
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function parseKm(odometer: string): number | null {
  const digits = odometer.replace(/\D/g, "");
  if (!digits) return null;
  const n = Number(digits);
  return Number.isFinite(n) ? n : null;
}

function monthsBetween(fromMs: number, toMs: number): number | null {
  if (!fromMs || !toMs || toMs < fromMs) return null;
  const days = (toMs - fromMs) / (24 * 60 * 60 * 1000);
  if (days < 20) return null;
  return Math.round(days / 30.437);
}

function groupDigits(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function median(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : Math.round((s[m - 1]! + s[m]!) / 2);
}

function avg(xs: number[]): number | null {
  return xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null;
}

/** Vai rinda fiksē dzinēja eļļas maiņu (ne kārbu / tiltu atsevišķi). */
export function isEngineOilChangeWork(works: string): boolean {
  const t = works.replace(/\s+/g, " ").trim();
  if (!t) return false;
  const withoutGear = t.replace(GEARBOX_OIL_CHUNK_RE, " ").replace(/\s+/g, " ").trim();
  return ENGINE_OIL_RE.test(withoutGear);
}

function parseRowMs(date: string): number {
  return parseDotOrIsoDateToMs(date) || 0;
}

export function collectEngineOilChangeRows(
  rows: readonly AutoRecordsServiceWorkRow[],
): AutoRecordsServiceWorkRow[] {
  const oil = rows.filter((r) => isEngineOilChangeWork(r.works));
  const sorted = [...oil].sort((a, b) => {
    const ta = parseRowMs(a.date);
    const tb = parseRowMs(b.date);
    if (ta !== tb) {
      if (!ta) return 1;
      if (!tb) return -1;
      return ta - tb;
    }
    const na = parseKm(a.odometer) ?? 0;
    const nb = parseKm(b.odometer) ?? 0;
    return na - nb;
  });
  const out: AutoRecordsServiceWorkRow[] = [];
  const seen = new Set<string>();
  for (const row of sorted) {
    const key = `${row.date.trim()}|${row.odometer.replace(/\D/g, "")}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

function isHardDataGap(km: number | null, months: number | null): boolean {
  if (km != null && km > OIL_DEALER_GAP_KM) return true;
  if (months != null && months > OIL_DEALER_GAP_MONTHS) return true;
  return false;
}

function ratioTone(value: number | null, oem: number | null | undefined): OilIntervalTone {
  return oilRatioTone(value, oem);
}

export function classifyOilIntervalKind(
  km: number | null,
  months: number | null,
  poolKm: readonly number[],
): OilIntervalKind {
  if (isHardDataGap(km, months)) return "gap";
  if (km == null) return "observed";
  if (poolKm.length < 2) return "observed";
  const med = median([...poolKm]);
  if (med == null || med <= 0) return "observed";
  if (km >= OIL_OUTLIER_MIN_KM && km >= med * OIL_OUTLIER_RATIO) return "gap";
  return "observed";
}

function buildRingNote(ringSteps: number, gapSteps: number, changeCount: number): string {
  if (changeCount <= 1) {
    return "Fiksēta viena eļļas maiņa. Intervālu un gredzenu nevar rēķināt.";
  }
  if (ringSteps === 0) {
    return "Gredzena vidējo nevar rēķināt. Starp fiksētajām maiņām soļi ir pārāk gari vai neregulāri, lai tos uzskatītu par dīlera eļļas intervālu. Iespējama apkope ārpus dīlera. Klients pārbauda dokumentus klātienē.";
  }
  if (gapSteps === 0) {
    return ringSteps === 1
      ? "Gredzens rāda vienīgo soli ar nepārtrauktiem dīlera datiem."
      : `Vidējais no visiem ${ringSteps} soļiem ar dīlera datiem.`;
  }
  const ringLabel = ringSteps === 1 ? "1 soļa" : `${ringSteps} soļiem`;
  const gapLabel = gapSteps === 1 ? "1 solis nav iekļauts" : `${gapSteps} soļi nav iekļauti`;
  return `Vidējais rēķināts no ${ringLabel}, kur dīlera eļļas maiņas seko cita citai. ${gapLabel}, jo starp tiem ir datu iztrūkums. Apkope varēja būt ārpus dīlera.`;
}

export function buildOilChangeIntervalSeries(
  rows: readonly AutoRecordsServiceWorkRow[],
  oem: OemOilInterval | null = null,
): OilChangeIntervalSeries {
  const oilRows = collectEngineOilChangeRows(rows);
  const raw: Omit<OilChangeIntervalPoint, "kind" | "tone" | "periodTone">[] = [];
  let prevKm: number | null = null;
  let prevMs = 0;

  for (const row of oilRows) {
    const km = parseKm(row.odometer);
    const ms = parseDotOrIsoDateToMs(row.date);
    let intervalKm: number | null = null;
    let intervalMonths: number | null = null;
    const isFirst = raw.length === 0;
    if (!isFirst) {
      if (km != null && prevKm != null && km > prevKm) intervalKm = km - prevKm;
      if (ms && prevMs) intervalMonths = monthsBetween(prevMs, ms);
    }
    raw.push({
      date: row.date.trim(),
      odometer: row.odometer.trim(),
      km,
      intervalKm: isFirst ? null : intervalKm,
      intervalMonths: isFirst ? null : intervalMonths,
    });
    if (km != null) prevKm = km;
    if (ms) prevMs = ms;
  }

  const poolKm = raw
    .filter((p) => p.intervalKm != null && !isHardDataGap(p.intervalKm, p.intervalMonths))
    .map((p) => p.intervalKm!);

  const points: OilChangeIntervalPoint[] = raw.map((p, i) => {
    if (i === 0) {
      return { ...p, kind: "start", tone: "start", periodTone: "start" };
    }
    const kind = classifyOilIntervalKind(p.intervalKm, p.intervalMonths, poolKm);
    if (kind === "gap") {
      return { ...p, kind, tone: "gap", periodTone: "gap" };
    }
    return {
      ...p,
      kind,
      tone: ratioTone(p.intervalKm, oem?.km),
      periodTone: ratioTone(p.intervalMonths, oem?.months),
    };
  });

  const ringKm = points.filter((p) => p.kind === "observed" && p.intervalKm != null).map((p) => p.intervalKm!);
  const ringMonths = points
    .filter((p) => p.kind === "observed" && p.intervalMonths != null)
    .map((p) => p.intervalMonths!);
  const allKm = points.filter((p) => p.intervalKm != null).map((p) => p.intervalKm!);
  const ringStepCount = points.filter((p) => p.kind === "observed").length;
  const gapStepCount = points.filter((p) => p.kind === "gap").length;
  const ringIntervalKm = avg(ringKm);
  const ringIntervalMonths = avg(ringMonths);

  return {
    points,
    changeCount: points.length,
    ringIntervalKm,
    ringIntervalMonths,
    ringStepCount,
    gapStepCount,
    ringNote: buildRingNote(ringStepCount, gapStepCount, points.length),
    avgIntervalKm: ringIntervalKm,
    avgIntervalMonths: ringIntervalMonths,
    minIntervalKm: ringKm.length ? Math.min(...ringKm) : allKm.length ? Math.min(...allKm) : null,
    maxIntervalKm: ringKm.length ? Math.max(...ringKm) : allKm.length ? Math.max(...allKm) : null,
    oem,
    ringTone: ratioTone(ringIntervalKm, oem?.km),
    periodChipTone: ratioTone(ringIntervalMonths, oem?.months),
  };
}

function barWidthPct(km: number | null, oemKm: number | null | undefined): number {
  if (km == null || km <= 0) return 8;
  const scale = oemKm && oemKm > 0 ? oemKm : OIL_DEALER_GAP_KM;
  return Math.max(10, Math.min(100, Math.round((km / scale) * 70)));
}

function intervalKmCell(p: OilChangeIntervalPoint): string {
  if (p.kind === "start" || p.intervalKm == null) {
    return p.kind === "start" ? "Sākums" : "";
  }
  const km = `${groupDigits(p.intervalKm)} km`;
  if (p.kind === "gap") {
    return `${escapeHtml(km)}<div class="pdf-oil-int__gap-tag">Datu iztrūkums</div>`;
  }
  return escapeHtml(km);
}

function periodCell(p: OilChangeIntervalPoint): string {
  if (p.kind === "start" || p.intervalMonths == null) return "";
  return `<span class="pdf-oil-int__period-val pdf-oil-int__period-val--${p.periodTone}">${escapeHtml(
    `${p.intervalMonths} mēn.`,
  )}</span>`;
}

const TONE_HEX: Record<OilIntervalTone, string> = {
  ok: "#059669",
  warn: "#D97706",
  stretch: "#DC2626",
  gap: "#94A3B8",
  start: "#CBD5E1",
  neutral: PDF_BRAND_BLUE_HEX,
};

function ringSvgHtml(km: number | null, tone: OilIntervalTone, oemKm: number | null | undefined): string {
  const r = 44;
  const c = 2 * Math.PI * r;
  const has = km != null;
  const scale = oemKm && oemKm > 0 ? oemKm * 1.3 : OIL_DEALER_GAP_KM;
  const frac = has ? Math.max(0.08, Math.min(1, km / scale)) : 0;
  const dash = (frac * c).toFixed(1);
  const color = has ? TONE_HEX[tone] : "#CBD5E1";
  const label = has ? `${groupDigits(km)}` : "Nav";
  const unit = has ? "km" : "";
  return `<svg class="pdf-oil-int__ring" viewBox="0 0 120 120" role="img" aria-label="Vidējais eļļas intervāls">
    <circle cx="60" cy="60" r="${r}" fill="none" stroke="#E2E8F0" stroke-width="10"/>
    <circle cx="60" cy="60" r="${r}" fill="none" stroke="${color}" stroke-width="10" stroke-linecap="round"
      stroke-dasharray="${dash} ${c.toFixed(1)}" transform="rotate(-90 60 60)"/>
    <text x="60" y="56" text-anchor="middle" font-size="13" font-weight="750" fill="#0f172a">${escapeHtml(label)}</text>
    <text x="60" y="72" text-anchor="middle" font-size="8" fill="#64748b">${escapeHtml(unit || "gredzens")}</text>
  </svg>`;
}

function kpiValue(raw: string): string {
  return escapeHtml(raw);
}

/** PDF: KPI kartītes augšā, tad gredzens (km) + tabula ar atsevišķu periodu. */
export function buildOilChangeIntervalPdfHtml(series: OilChangeIntervalSeries): string {
  if (series.points.length === 0) return "";
  const oemCap = series.oem ? formatOemOilCaption(series.oem) : "";
  const avgKm =
    series.ringIntervalKm != null ? `${groupDigits(series.ringIntervalKm)} km` : "Nav";
  const avgMonths =
    series.ringIntervalMonths != null ? `${series.ringIntervalMonths} mēn.` : "Nav";
  const kpis = `<div class="pdf-oil-int__kpis">
      <div class="pdf-oil-int__kpi"><b>${kpiValue(String(series.changeCount))}</b><span>fiksētas maiņas</span></div>
      <div class="pdf-oil-int__kpi pdf-oil-int__kpi--${series.ringTone}"><b>${kpiValue(avgKm)}</b><span>vidējais intervāls</span></div>
      <div class="pdf-oil-int__kpi pdf-oil-int__kpi--${series.periodChipTone}"><b>${kpiValue(avgMonths)}</b><span>vidējais laiks</span></div>
    </div>`;
  const ringCaption =
    series.ringIntervalKm != null
      ? `<span>intervāls no ${escapeHtml(String(series.ringStepCount))} ${
          series.ringStepCount === 1 ? "soļa" : "soļiem"
        }</span>`
      : `<span>gredzenu neskaita</span>`;
  const oemHtml = oemCap ? `<div class="pdf-oil-int__oem">${escapeHtml(oemCap)}</div>` : "";
  const rows = series.points
    .map((p) => {
      const kmLabel = p.odometer ? formatServiceWorkOdometer(p.odometer) : "";
      const width = barWidthPct(p.intervalKm, series.oem?.km);
      return `<tr class="pdf-oil-int__row pdf-oil-int__row--${p.tone}">
        <td>${escapeHtml(p.date)}</td>
        <td>${escapeHtml(kmLabel)}</td>
        <td>${intervalKmCell(p)}</td>
        <td>${periodCell(p)}</td>
        <td><span class="pdf-oil-int__bar pdf-oil-int__bar--${p.tone}" style="width:${width}%"></span></td>
      </tr>`;
    })
    .join("");
  return `<div class="pdf-oil-int">
    <p class="pdf-subhead">Eļļas maiņas intervāli</p>
    ${kpis}
    <div class="pdf-oil-int__head">
      <div class="pdf-oil-int__ring-col">
        ${ringSvgHtml(series.ringIntervalKm, series.ringTone, series.oem?.km)}
        <div class="pdf-oil-int__ring-cap">${ringCaption}</div>
        ${oemHtml}
      </div>
      <table class="pdf-oil-int__table">
        <thead><tr><th>Datums</th><th>Nobraukums</th><th>Intervāls</th><th>Periods</th><th aria-hidden="true"></th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <p class="pdf-oil-int__note">${escapeHtml(series.ringNote)}</p>
  </div>`;
}
