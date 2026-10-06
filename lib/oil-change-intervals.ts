/**
 * Eļļas maiņas intervāli no oficiālā dīlera servisa rindu tabulas.
 * Tikai dzinēja eļļa; kārbas / Haldex / tilta eļļa netiek skaitīta kā šīs sērijas punkts.
 *
 * 1. Starp divām fiksētām dzinēja eļļas maiņām rēķinām Δ km un Δ mēnešus atsevišķi.
 * 2. Solis ir datu iztrūkums, ja Δ km > 30 000 vai Δ mēneši > 24
 *    (kanons: apkope varēja būt ārpus dīlera), vai ja tas ir statistisks izlecējs
 *    pret pārējiem dīlera soļiem (≥ 1,8 × mediāna un > 20 000 km).
 * 3. Vidējais rāda tikai nepārtrauktos dīlera soļus.
 * 4. Zaļš: dīlera solis iekļaujas OEM. Sarkans: dīlera datos solis ir garāks
 *    par OEM km VAI mēnešiem. Sarkans nav apgalvojums, ka eļļa nav mainīta.
 * 5. Pelēks svītrojums: datu iztrūkums. Bez OEM nav zaļa/sarkana.
 */

import {
  formatServiceWorkOdometer,
  type AutoRecordsServiceWorkRow,
} from "@/lib/auto-records-service-works";
import { parseDotOrIsoDateToMs } from "@/lib/clean-date-str";
import {
  formatOemOilCaption,
  oilRatioTone,
  type OemOilInterval,
} from "@/lib/oem-oil-interval";

/** Drukas tintes toņi: tumšs smaragds / oksasinis, ne UI „kļūdas” sarkans. */
export const PDF_OIL_OK_HEX = "#0E4F42";
export const PDF_OIL_OVER_HEX = "#6B2030";
export const PDF_OIL_OVER_TEXT_HEX = "#5A1A26";
export const PDF_OIL_OK_WASH_HEX = "#E8EEEC";
export const PDF_OIL_NEUTRAL_HEX = "#7A828C";
export const PDF_OIL_HATCH_CSS =
  "repeating-linear-gradient(-55deg,#F3F4F6 0 3px,#C5CBD3 3px 4px)";

export const OIL_CLAIM_CAUTION_TITLE = "Svarīga piezīme par apkopes datu interpretāciju";

export function oilClaimCautionHtml(): string {
  const p = (html: string) => `<p>${html}</p>`;
  const b = (label: string, body: string) =>
    p(`<b>${escapeHtml(label)}</b> ${escapeHtml(body)}`);
  return `<aside class="pdf-oil-int__caution">
    <p class="pdf-oil-int__caution-title">${escapeHtml(OIL_CLAIM_CAUTION_TITLE)}</p>
    ${p(
      escapeHtml(
        "Dati par transportlīdzekļa tehniskajām apkopēm PROVIN datubāzēs tiek apkopoti galvenokārt no autorizētajiem dīleru centriem un atsevišķiem liela mēroga servisu tīkliem.",
      ),
    )}
    ${p(escapeHtml("Lūdzam ņemt vērā:"))}
    ${b(
      "Ierakstu robežas.",
      "Neatkarīgie autoservisi neiesūta datus starptautiskajās vai dīleru reģistru sistēmās.",
    )}
    ${b(
      "Neiztrūkstošas apkopes.",
      "Ja atskaitē novērojams ilgāks laika vai nobraukuma intervāls starp dīlera apkopēm nekā paredzējis ražotājs (vai ieraksti atsevišķos periodos iztrūkst), tas nepierāda, ka apkope nav veikta.",
    )}
    ${b(
      "Secinājums.",
      "Ieraksta trūkums atskaitē norāda tikai uz oficiālu datu neesamību konkrētajā datubāzē, nevis uz faktisko servisa kavējumu.",
    )}
    ${p(escapeHtml("Rekomendācija pilnīgai pārbaudei."))}
    ${p(
      escapeHtml(
        "Lai gūtu objektīvu priekšstatu par spēkrata faktisko tehnisko stāvokli un apkopes vēsturi, elektronisko atskaiti ieteicams kombinēt ar:",
      ),
    )}
    <ul>
      <li>${escapeHtml("Fiziskās servisa grāmatiņas ierakstiem un izrakstiem/čakiem no servisiem.")}</li>
      <li>${escapeHtml("Pirmsipirkuma diagnostiku neatkarīgā, uzticamā autoservisā.")}</li>
    </ul>
  </aside>`;
}

/** Joslas skala PDF (tā pati kā konceptā). */
export const OIL_BAR_SCALE_KM = 30_000;

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
  coverSpanKm: number | null;
  coverOkKm: number;
  coverOverKm: number;
  coverGapKm: number;
  coverStartKm: number | null;
  coverEndKm: number | null;
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

function stepIsOverOem(p: OilChangeIntervalPoint): boolean {
  return p.kind === "observed" && (p.tone === "stretch" || p.periodTone === "stretch");
}

function buildAvgNote(ringSteps: number, gapSteps: number, changeCount: number): string {
  if (changeCount <= 1) {
    return "Fiksēta viena eļļas maiņa. Intervālu nevar rēķināt.";
  }
  if (ringSteps === 0) {
    return "Vidējo intervālu nevar rēķināt. Starp fiksētajām maiņām soļi ir pārāk gari vai neregulāri, lai tos uzskatītu par dīlera eļļas intervālu.";
  }
  if (gapSteps === 0) {
    return ringSteps === 1
      ? "Vidējais rāda vienīgo soli ar nepārtrauktiem dīlera datiem."
      : `Vidējais no visiem ${ringSteps} soļiem ar dīlera datiem.`;
  }
  const ringLabel = ringSteps === 1 ? "1 soļa" : `${ringSteps} soļiem`;
  const gapLabel = gapSteps === 1 ? "1 solis nav iekļauts" : `${gapSteps} soļi nav iekļauti`;
  return `Vidējie rādītāji rēķināti tikai no ${ringLabel}, kur dīlera eļļas maiņas seko cita citai. ${gapLabel}, jo starp tiem ir datu iztrūkums.`;
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
  const withKm = points.filter((p) => p.km != null);
  const coverStartKm = withKm[0]?.km ?? null;
  const coverEndKm = withKm[withKm.length - 1]?.km ?? null;
  const coverSpanKm =
    coverStartKm != null && coverEndKm != null && coverEndKm > coverStartKm
      ? coverEndKm - coverStartKm
      : null;
  const coverOkKm = points
    .filter((p) => p.kind === "observed" && !stepIsOverOem(p) && p.intervalKm != null)
    .reduce((a, p) => a + (p.intervalKm ?? 0), 0);
  const coverOverKm = points
    .filter((p) => stepIsOverOem(p) && p.intervalKm != null)
    .reduce((a, p) => a + (p.intervalKm ?? 0), 0);
  const coverGapKm =
    coverSpanKm != null ? Math.max(0, coverSpanKm - coverOkKm - coverOverKm) : 0;

  return {
    points,
    changeCount: points.length,
    ringIntervalKm,
    ringIntervalMonths,
    ringStepCount,
    gapStepCount,
    ringNote: buildAvgNote(ringStepCount, gapStepCount, points.length),
    avgIntervalKm: ringIntervalKm,
    avgIntervalMonths: ringIntervalMonths,
    minIntervalKm: ringKm.length ? Math.min(...ringKm) : allKm.length ? Math.min(...allKm) : null,
    maxIntervalKm: ringKm.length ? Math.max(...ringKm) : allKm.length ? Math.max(...allKm) : null,
    oem,
    ringTone: ratioTone(ringIntervalKm, oem?.km),
    periodChipTone: ratioTone(ringIntervalMonths, oem?.months),
    coverSpanKm,
    coverOkKm,
    coverOverKm,
    coverGapKm,
    coverStartKm,
    coverEndKm,
  };
}

function pctOfScale(km: number): number {
  return Math.max(0, Math.min(100, (km / OIL_BAR_SCALE_KM) * 100));
}

function intervalKmCell(p: OilChangeIntervalPoint): string {
  if (p.kind === "start") return `<span class="pdf-oil-int__start">Sākums</span>`;
  if (p.intervalKm == null) return "";
  const km = `${groupDigits(p.intervalKm)} km`;
  if (p.kind === "gap") {
    return `<span class="pdf-oil-int__dim">${escapeHtml(km)}</span><div class="pdf-oil-int__gap-tag">Datu iztrūkums</div>`;
  }
  if (p.tone === "stretch") return `<b class="pdf-oil-int__over">${escapeHtml(km)}</b>`;
  return `<b>${escapeHtml(km)}</b>`;
}

function periodCell(p: OilChangeIntervalPoint): string {
  if (p.kind === "start" || p.intervalMonths == null) return "";
  if (p.kind === "gap") {
    return `<span class="pdf-oil-int__dim">${escapeHtml(`${p.intervalMonths} mēn.`)}</span>`;
  }
  if (p.periodTone === "stretch") {
    return `<span class="pdf-oil-int__over">${escapeHtml(`${p.intervalMonths} mēn.`)}</span>`;
  }
  return escapeHtml(`${p.intervalMonths} mēn.`);
}

function oemTickHtml(oem: OemOilInterval | null): string {
  if (!oem) return "";
  return `<i class="pdf-oil-int__tk" style="left:${pctOfScale(oem.km)}%"></i>`;
}

function oemBandHtml(oem: OemOilInterval | null): string {
  if (!oem || oem.kmMin == null || oem.kmMin >= oem.km) return "";
  const left = pctOfScale(oem.kmMin);
  const width = pctOfScale(oem.km) - left;
  return `<i class="pdf-oil-int__band" style="left:${left}%;width:${width}%"></i>`;
}

function stepBarHtml(p: OilChangeIntervalPoint, oem: OemOilInterval | null): string {
  const tick = oemTickHtml(oem);
  const band = oemBandHtml(oem);
  if (p.kind === "start") {
    return `<div class="pdf-oil-int__bw"><span class="pdf-oil-int__seg pdf-oil-int__seg--dot"></span></div>`;
  }
  if (p.kind === "gap") {
    return `<div class="pdf-oil-int__bw">${tick}<span class="pdf-oil-int__seg pdf-oil-int__seg--hatch" style="width:100%"></span></div>`;
  }
  const cls = stepIsOverOem(p) ? "over" : p.tone === "ok" ? "ok" : "neutral";
  if (p.intervalKm == null) {
    return `<div class="pdf-oil-int__bw">${tick}<span class="pdf-oil-int__seg pdf-oil-int__seg--${cls} pdf-oil-int__seg--dot"></span></div>`;
  }
  const w = pctOfScale(Math.min(p.intervalKm, OIL_BAR_SCALE_KM));
  if (oem && p.tone === "stretch") {
    const tp = pctOfScale(oem.km);
    const rest = Math.max(0, w - tp);
    return `<div class="pdf-oil-int__bw">${band}${tick}<span class="pdf-oil-int__seg pdf-oil-int__seg--ok" style="width:${tp}%"></span><span class="pdf-oil-int__seg pdf-oil-int__seg--over" style="width:${rest}%"></span></div>`;
  }
  return `<div class="pdf-oil-int__bw">${band}${tick}<span class="pdf-oil-int__seg pdf-oil-int__seg--${cls}" style="width:${w}%"></span></div>`;
}

function coverPercents(series: OilChangeIntervalSeries): {
  pOk: number;
  pOver: number;
  pGap: number;
  pCover: number;
} {
  const total = series.coverSpanKm ?? 0;
  if (total <= 0) return { pOk: 0, pOver: 0, pGap: 0, pCover: 0 };
  const pGap = Math.round((series.coverGapKm / total) * 100);
  const pOk = Math.round((series.coverOkKm / total) * 100);
  const pOver = series.oem ? Math.max(0, 100 - pGap - pOk) : 0;
  return { pOk, pOver, pGap, pCover: 100 - pGap };
}

function oemRefHtml(oem: OemOilInterval | null): string {
  if (!oem) {
    return `<div class="pdf-oil-int__ref">Ražotāja intervāls nav droši zināms. Ievērošanu nevērtējam. Joslas rāda tikai, cik kilometru dīlera dati apliecina.</div>`;
  }
  const cap = formatOemOilCaption(oem);
  const extra =
    oem.kmMin != null && oem.kmMin < oem.km
      ? " Gaišā zona ir pieļaujamās robežas, melnā atzīme ir augšējā robeža."
      : " Melnā atzīme joslā ir šis intervāls.";
  return `<div class="pdf-oil-int__ref"><b>${escapeHtml(cap)}</b>${escapeHtml(extra)}</div>`;
}

function coverageHtml(series: OilChangeIntervalSeries): string {
  const total = series.coverSpanKm;
  if (total == null || total <= 0 || series.coverStartKm == null || series.coverEndKm == null) {
    return "";
  }
  const { pOk, pOver, pGap, pCover } = coverPercents(series);
  const oem = series.oem;
  const okW = (series.coverOkKm / total) * 100;
  const overW = (series.coverOverKm / total) * 100;
  const gapW = (series.coverGapKm / total) * 100;
  const seg = oem
    ? `<i class="pdf-oil-int__cov-ok" style="width:${okW}%"></i><i class="pdf-oil-int__cov-over" style="width:${overW}%"></i>`
    : `<i class="pdf-oil-int__cov-neutral" style="width:${okW}%"></i>`;
  const key = oem
    ? `<span><i class="pdf-oil-int__sw pdf-oil-int__sw--ok"></i><b>${pOk}%</b> dīlera datos atbilst intervālam</span><span><i class="pdf-oil-int__sw pdf-oil-int__sw--over"></i><b>${pOver}%</b> dīlera datos virs intervāla</span><span><i class="pdf-oil-int__sw pdf-oil-int__sw--hatch"></i><b>${pGap}%</b> nav dīlera datu</span>`
    : `<span><i class="pdf-oil-int__sw pdf-oil-int__sw--neutral"></i><b>${pCover}%</b> nobraukuma ar dīlera datiem</span><span><i class="pdf-oil-int__sw pdf-oil-int__sw--hatch"></i><b>${pGap}%</b> nav dīlera datu</span>`;
  return `<div class="pdf-oil-int__cov">${seg}<i class="pdf-oil-int__cov-hatch" style="width:${gapW}%"></i></div>
    <div class="pdf-oil-int__covkey">${key}</div>
    <p class="pdf-oil-int__summary">Dīlera dati apliecina ${pCover}% nobraukuma<span>${groupDigits(series.coverStartKm)} km līdz ${groupDigits(series.coverEndKm)} km.</span></p>`;
}

function kpiValue(raw: string): string {
  return escapeHtml(raw);
}

/** PDF: KPI, nobraukuma segums, tabula ar joslām pret OEM. */
export function buildOilChangeIntervalPdfHtml(series: OilChangeIntervalSeries): string {
  if (series.points.length === 0) return "";
  const avgKm =
    series.ringIntervalKm != null ? `${groupDigits(series.ringIntervalKm)} km` : "Nav";
  const avgMonths =
    series.ringIntervalMonths != null ? `${series.ringIntervalMonths} mēn.` : "Nav";
  const kpis = `<div class="pdf-oil-int__kpis">
      <div class="pdf-oil-int__kpi"><b>${kpiValue(String(series.changeCount))}</b><span>fiksētas maiņas</span></div>
      <div class="pdf-oil-int__kpi"><b>${kpiValue(avgKm)}</b><span>vidējais intervāls</span></div>
      <div class="pdf-oil-int__kpi"><b>${kpiValue(avgMonths)}</b><span>vidējais laiks</span></div>
    </div>`;
  const rows = series.points
    .map((p) => {
      const kmLabel = p.odometer ? formatServiceWorkOdometer(p.odometer) : "";
      return `<tr class="pdf-oil-int__row pdf-oil-int__row--${p.tone}">
        <td>${escapeHtml(p.date)}</td>
        <td>${escapeHtml(kmLabel)}</td>
        <td>${intervalKmCell(p)}</td>
        <td>${periodCell(p)}</td>
        <td>${stepBarHtml(p, series.oem)}</td>
      </tr>`;
    })
    .join("");
  return `<div class="pdf-oil-int">
    <p class="pdf-subhead">Eļļas maiņas intervāli</p>
    ${kpis}
    ${coverageHtml(series)}
    ${oemRefHtml(series.oem)}
    <table class="pdf-oil-int__table">
      <thead><tr><th>Datums</th><th>Nobraukums</th><th>Intervāls</th><th>Periods</th><th>Pret ražotāja intervālu</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    ${oilClaimCautionHtml()}
    <p class="pdf-oil-int__note">${escapeHtml(series.ringNote)}</p>
  </div>`;
}
