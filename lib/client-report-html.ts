/**
 * Klienta izvērtējuma atskaite (druka / PDF) — „Ultra” struktūra, brīdinājumu loģika, diagrammas.
 */

import { extractKmCandidates } from "@/lib/admin-workspace-preview-format";
import {
  type HistoryPdfKind,
  HISTORY_PDF_KIND_LABEL_LV,
  type PdfPortfolioFileInsight,
} from "@/lib/admin-portfolio-pdf-analysis";
import { buildHistoryCompareBullets, buildHistoryCompareRows } from "@/lib/history-reports-compare";
import {
  compactDamageKindLabel,
  filterClaimRowsForClientReport,
  mergeClaimRowLists,
  parseClaimRowsFromLineBasedText,
  type ClaimTableRow,
} from "@/lib/claim-rows-parse";
import type { ListingMarketSnapshot } from "@/lib/listing-scrape";
import {
  CLIENT_REPORT_FOOTER_DISCLAIMER,
  CLIENT_REPORT_PDF_SECTIONS,
  CLIENT_REPORT_SECTION_LABELS,
  CLIENT_REPORT_SERVICE_NOTICE,
  REPORT_ODOMETER_SOURCE_LEGEND,
  REPORT_PDF_STANDARDS,
  sanitizeAttachmentFileNameForReport,
} from "@/lib/report-pdf-standards";

export type ClientReportPayload = {
  sessionId: string;
  isDemo: boolean;
  vin: string | null;
  created: number;
  amountTotal: number | null;
  currency: string | null;
  paymentStatus: string;
  listingUrl: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  customerName: string | null;
  contactMethod: string | null;
  notes: string | null;
  csdd: string;
  ltab: string;
  tirgus: string;
  citi: string;
  iriss: string;
  /** §7 Personalizēts apskates plāns — admina lauks zem IRISS. */
  apskatesPlāns: string;
  /** ss.lv u.c. automātiski nolasīts pirms PDF (admin API). */
  listingMarket?: ListingMarketSnapshot | null;
};

export type ClientReportPortfolioRow = { name: string; size: number };

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Minimālas līnijas ikonas (PDF / druka). */
const ICO = {
  user: `<svg class="pdf-ico" width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/><circle cx="12" cy="7" r="4" stroke="currentColor" stroke-width="1.75"/></svg>`,
  shield: `<svg class="pdf-ico" width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" stroke-width="1.75" stroke-linejoin="round"/></svg>`,
  car: `<svg class="pdf-ico" width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 11l1.5-4.5A2 2 0 0 1 8.4 5h7.2a2 2 0 0 1 1.9 1.5L19 11M5 11h14v6a1 1 0 0 1-1 1h-1M5 11H4a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h1m14 0h1a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1h-1" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/><circle cx="7.5" cy="17.5" r="1.5" fill="currentColor"/><circle cx="16.5" cy="17.5" r="1.5" fill="currentColor"/></svg>`,
  chart: `<svg class="pdf-ico" width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3 3v18h18" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/><path d="M7 16l4-6 4 3 5-8" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  alert: `<svg class="pdf-ico" width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" stroke="currentColor" stroke-width="1.75" stroke-linejoin="round"/><path d="M12 9v4M12 17h.01" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/></svg>`,
  tag: `<svg class="pdf-ico" width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 2H2v10l9.29 9.29a1 1 0 0 0 1.41 0l6.59-6.59a1 1 0 0 0 0-1.41L12 2z" stroke="currentColor" stroke-width="1.75" stroke-linejoin="round"/><circle cx="7.5" cy="7.5" r="1" fill="currentColor"/></svg>`,
  clip: `<svg class="pdf-ico" width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/><rect x="8" y="2" width="8" height="4" rx="1" stroke="currentColor" stroke-width="1.75"/></svg>`,
  spark: `<svg class="pdf-ico" width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m12 3 1.6 5.2h5.4l-4.4 3.4 1.7 5.4L12 15.8 7.7 17.2l1.7-5.4L5 8.2h5.4L12 3z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>`,
  layers: `<svg class="pdf-ico" width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 2 2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" stroke-width="1.75" stroke-linejoin="round"/></svg>`,
};

function sectionHead(icon: string, title: string): string {
  return `<div class="pdf-sec-head">${icon}<h2 class="pdf-sec">${escapeHtml(title)}</h2></div>`;
}

const COMPARE_KIND_SHORT: Record<HistoryPdfKind, string> = {
  euro_network: "Plašs EU",
  regional_alt: "Papildu DB",
  registry_focus: "Reģions",
  generic: "Neapr.",
};

function flagEmoji(iso2: string): string {
  const c = iso2.trim().toUpperCase();
  if (c.length !== 2 || !/^[A-Z]{2}$/.test(c)) return "🏳️";
  const A = 0x1f1e6;
  return String.fromCodePoint(
    A + c.charCodeAt(0) - 65,
    A + c.charCodeAt(1) - 65,
  );
}

function parseLvDateFragment(s: string): Date | null {
  const m = s.match(/(\d{1,2})[./](\d{1,2})[./](\d{2,4})/);
  if (!m) return null;
  let y = parseInt(m[3], 10);
  if (y < 100) y += 2000;
  const d = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10) - 1;
  const dt = new Date(y, mo, d);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

/** Nākamās TA datums / derīguma beigas no reģistra piezīmēm. */
function findTaValidUntilDate(csdd: string): Date | null {
  const patterns = [
    /nākam[āa]\s+(?:tehnisk[āa]?\s+)?apskate\s*[:\-]?\s*(\d{1,2}[./]\d{1,2}[./]\d{2,4})/i,
    /nākam[āa]\s+TA\s*[:\-]?\s*(\d{1,2}[./]\d{1,2}[./]\d{2,4})/i,
    /nākam[āa]\s+pārbaude\s*[:\-]?\s*(\d{1,2}[./]\d{1,2}[./]\d{2,4})/i,
    /der[īi]g[āa]\s+l[īi]dz\s*[:\-]?\s*(\d{1,2}[./]\d{1,2}[./]\d{2,4})/i,
    /TA\s+der[īi]g[āa]\s+l[īi]dz\s*[:\-]?\s*(\d{1,2}[./]\d{1,2}[./]\d{2,4})/i,
    /tehnisk[āa]s?\s+apskates?\s+der[īi]g[āa]\s+l[īi]dz\s*[:\-]?\s*(\d{1,2}[./]\d{1,2}[./]\d{2,4})/i,
    /apskate\s+sp[ēe]k[āa]\s+l[īi]dz\s*[:\-]?\s*(\d{1,2}[./]\d{1,2}[./]\d{2,4})/i,
    /sp[ēe]k[āa]\s+l[īi]dz\s*[:\-]?\s*(\d{1,2}[./]\d{1,2}[./]\d{2,4})/i,
  ];
  for (const re of patterns) {
    const m = csdd.match(re);
    if (m?.[1]) {
      const d = parseLvDateFragment(m[1]);
      if (d) return d;
    }
  }
  return null;
}

type TaValidityClass = "valid" | "soon" | "expired" | "unknown";

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function classifyTaValidity(validUntil: Date | null): TaValidityClass {
  if (!validUntil) return "unknown";
  const today = startOfDay(new Date());
  const target = startOfDay(validUntil);
  if (target.getTime() < today.getTime()) return "expired";
  const limit = new Date(today);
  limit.setDate(limit.getDate() + 90);
  if (target.getTime() <= limit.getTime()) return "soon";
  return "valid";
}

function daysFromTodayTo(target: Date): number {
  const a = startOfDay(new Date()).getTime();
  const b = startOfDay(target).getTime();
  return Math.round((b - a) / 86400000);
}

function buildTaValidityBanner(validUntil: Date | null): string {
  const kind = classifyTaValidity(validUntil);
  const dateStr = validUntil ? validUntil.toLocaleDateString("lv-LV") : "";

  if (kind === "unknown") {
    return `<div class="ta-status ta-unknown" role="status">
      <p class="ta-status-title">Tehniskās apskates derīgums</p>
      <p class="ta-status-text">Tekstā nav automātiski atrasts datums, līdz kuram tehniskā apskate ir derīga (meklējam „nākamā apskate”, „derīga līdz”, „TA derīga līdz” u.c.). Pārbaudiet zemāk esošās piezīmes vai CSDD izrakstu.</p>
    </div>`;
  }

  if (kind === "expired") {
    return `<div class="ta-status ta-expired" role="alert">
      <p class="ta-status-title">Tehniskā apskate nav spēkā</p>
      <p class="ta-status-text">Pēc pieejamā datuma <strong>${escapeHtml(dateStr)}</strong> (nākamā apskate / derīguma beigas) transportlīdzeklim <strong>jāveic jauna tehniskā apskate</strong>, lai būtu likumīgi ceļošanai.</p>
    </div>`;
  }

  const daysLeft = daysFromTodayTo(validUntil!);
  if (kind === "soon") {
    return `<div class="ta-status ta-soon" role="status">
      <p class="ta-status-title">Tehniskā apskate ir spēkā — termiņš tuvu</p>
      <p class="ta-status-text">Derīga līdz <strong>${escapeHtml(dateStr)}</strong>. Atlikušas aptuveni <strong>${daysLeft}</strong> dienas (≤ 90 dienām līdz termiņam). Ieteicams laikus pieteikt pārbaudi.</p>
    </div>`;
  }

  return `<div class="ta-status ta-ok" role="status">
    <p class="ta-status-title">Tehniskā apskate ir spēkā</p>
    <p class="ta-status-text">Derīga līdz <strong>${escapeHtml(dateStr)}</strong>. Līdz termiņam vairāk nekā trīs mēneši (aptuveni <strong>${daysLeft}</strong> dienas).</p>
  </div>`;
}

function collectTaSeverityWarnings(csdd: string, citi: string): string[] {
  const corpus = `${csdd}\n${citi}`;
  const t = corpus.toLowerCase();
  const out: string[] = [];
  if (/\b2\s*\/\s*5\b/.test(t) || /vērt[ēe]jums\s*:\s*2\b/.test(t) || /līmenis\s*:\s*2\b/.test(t)) {
    out.push("Konstatēts zemāks tehniskās apskates vērtējums (piem., „2”) — nepieciešama manuāla pārbaude piezīmēs.");
  }
  if (/konstat[ēe]tie\s+defekt|defekt[us]*\s*[:(]|boj[āa]jums\s*:\s*ir/i.test(corpus)) {
    out.push("Tekstā minēti konstatētie defekti / bojājumi — izcelti kā riska faktors.");
  }
  return out;
}

type KmTier = "lv" | "hist" | "hist2" | "dealer" | "other";

const TIER_EMOJI: Record<KmTier, string> = {
  lv: "🟢",
  hist: "🔵",
  hist2: "🟡",
  dealer: "🟠",
  other: "🔴",
};

const TIER_COLOR: Record<KmTier, string> = {
  lv: "#16a34a",
  hist: "#2563eb",
  hist2: "#ca8a04",
  dealer: "#ea580c",
  other: "#dc2626",
};

function tierFromHistoryKind(k: HistoryPdfKind): KmTier {
  switch (k) {
    case "euro_network":
      return "hist";
    case "regional_alt":
      return "hist2";
    case "registry_focus":
      return "other";
    default:
      return "hist";
  }
}

export type OdometerChartPoint = {
  km: number;
  label: string;
  tier: KmTier;
  emoji: string;
  /** Kārtas numurs grafikā / tabulā pēc nobraukuma (1…n). */
  plotIndex: number;
  /** Papildu dati no lauka „Citi avoti”. */
  fromCiti?: boolean;
};

function mergeCitiIntoOdometerPoints(points: OdometerChartPoint[], citi: string): void {
  const seenKm = (km: number) => points.some((p) => Math.abs(p.km - km) < 120);
  for (const km of extractKmCandidates(citi)) {
    if (km < 1_000 || km > 2_000_000) continue;
    const existing = points.find((p) => Math.abs(p.km - km) < 120);
    if (existing) {
      existing.fromCiti = true;
      if (!/citi\s+avoti/i.test(existing.label)) {
        existing.label = `${existing.label} · Citi avoti`;
      }
    } else if (!seenKm(km)) {
      points.push({
        km,
        label: "Citi avoti (piezīmes)",
        tier: "other",
        emoji: TIER_EMOJI.other,
        plotIndex: 0,
        fromCiti: true,
      });
    }
  }
}

export function buildOdometerChartPoints(
  csdd: string,
  insights: PdfPortfolioFileInsight[],
  citi: string,
): OdometerChartPoint[] {
  const points: OdometerChartPoint[] = [];
  const seen = (km: number) => points.some((p) => Math.abs(p.km - km) < 120);

  for (const km of extractKmCandidates(csdd)) {
    if (km < 1_000 || km > 2_000_000) continue;
    if (seen(km)) continue;
    points.push({
      km,
      label: "Valsts / reģistra piezīmes",
      tier: "lv",
      emoji: TIER_EMOJI.lv,
      plotIndex: 0,
    });
  }

  for (const ins of insights) {
    const base = `Pārskats ${ins.sourceOrdinal}`;
    const tier = tierFromHistoryKind(ins.historyKind);
    for (const s of ins.kmSamples) {
      const fullLabel = s.context ? `${base} · ${s.context}` : base;
      const dupHist = points.some(
        (x) =>
          x.tier !== "lv" &&
          Math.abs(x.km - s.km) < 80 &&
          odoSourceTitle(x.label) === base,
      );
      if (dupHist) continue;
      points.push({
        km: s.km,
        label: fullLabel,
        tier,
        emoji: TIER_EMOJI[tier],
        plotIndex: 0,
      });
    }
  }

  mergeCitiIntoOdometerPoints(points, citi);

  const sorted = points.sort((a, b) => a.km - b.km);
  sorted.forEach((p, i) => {
    p.plotIndex = i + 1;
  });
  return sorted;
}

/** Tabulai: pirmais datums no etiķetes (ISO vai LV); ja nav — „—”. */
function dateOnlyFromOdoLabel(label: string): string {
  const iso = label.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (iso) return iso[1]!;
  const dm = label.match(/\d{1,2}[./]\d{1,2}[./]\d{2,4}/);
  return dm ? dm[0]! : "—";
}

/** Kolonnai „Avots” — tikai publiskā daļa (Pārskats N / reģistrs), bez datņu nosaukumiem. */
function odoSourceTitle(label: string): string {
  const first = label.split(/\s*·\s*/)[0]?.trim() ?? label;
  if (/^Pārskats \d+$/i.test(first)) return first;
  return sanitizeAttachmentFileNameForReport(first);
}

/** Brīdinājums, ja „Citi avoti” satur odometra manipulācijas pazīmes. */
function buildCitiOdometerRollbackCallout(citi: string): string | null {
  const t = citi.trim();
  if (!t) return null;
  const low = t.toLowerCase();
  if (
    /rollback|atgriez|atgriezt|atgriezts|odometra\s+sv[īi]rst|nobraukuma\s+manipul|nobraukums\s+p[āa]rsk|r[āa]d[īi]t[āa]j\w*\s+atgriez|viltojums|melots\s+nobrauk/i.test(
      low,
    )
  ) {
    return "„Citi avoti” satur pazīmes par iespējamu odometra manipulāciju vai rādītāja atkārtotu maiņu — salīdziniet ar grafiku un oficiālajiem punktiem; rindas no šī lauka tabulā iezīmētas.";
  }
  return null;
}

type OdoMergedRow = { km: number; dateStr: string; pts: OdometerChartPoint[] };

/** Viena tabulas rinda: tuvi esoši km + datums; vairāki avoti → vairāki punkti šūnā. */
function mergeOdometerPointsForDisplay(pts: OdometerChartPoint[]): OdoMergedRow[] {
  const sorted = [...pts].sort((a, b) => a.km - b.km || a.plotIndex - b.plotIndex);
  const groups: OdometerChartPoint[][] = [];
  for (const p of sorted) {
    const d = dateOnlyFromOdoLabel(p.label);
    let merged = false;
    for (const g of groups) {
      const r = g[0]!;
      if (Math.abs(r.km - p.km) > 95) continue;
      const dr = dateOnlyFromOdoLabel(r.label);
      if (d !== "—" && dr !== "—" && d !== dr) continue;
      if (d === "—" && dr === "—" && Math.abs(r.km - p.km) > 55) continue;
      g.push(p);
      merged = true;
      break;
    }
    if (!merged) groups.push([p]);
  }
  return groups
    .map((g) => ({
      km: Math.round(g.reduce((s, x) => s + x.km, 0) / g.length),
      dateStr: dateOnlyFromOdoLabel(g[0]!.label),
      pts: g,
    }))
    .sort((a, b) => a.km - b.km);
}

function buildOdometerDotsOnlyCell(pts: OdometerChartPoint[]): string {
  const parts = pts.map((p) => {
    const col = TIER_COLOR[p.tier];
    const hint = escapeHtml(odoSourceTitle(p.label));
    return `<span class="odo-dot-only" style="background:${col}" title="${hint}" aria-label="${hint}"></span>`;
  });
  return `<td class="odo-dots-cell">${parts.join("")}</td>`;
}

function buildOdometerMergedTableRows(merged: OdoMergedRow[]): string {
  return merged
    .map((row) => {
      const nums = row.pts.map((p) => p.plotIndex).sort((a, b) => a - b);
      const idx = nums.join("+");
      const citiTouch = row.pts.some((p) => p.fromCiti);
      const trCls = citiTouch ? ' class="odo-row-citi"' : "";
      return `<tr${trCls}><td class="tabular odo-idx">${escapeHtml(idx)}</td>${buildOdometerDotsOnlyCell(row.pts)}<td class="tabular"><strong>${row.km.toLocaleString("lv-LV")} km</strong></td><td class="tabular">${escapeHtml(row.dateStr)}</td></tr>`;
    })
    .join("\n");
}

/** Nelielas odometra tabulas katrai avota grupai (datums · km). */
function buildOdometerMiniTablesBySource(pts: OdometerChartPoint[]): string {
  const byTitle = new Map<string, OdometerChartPoint[]>();
  for (const p of pts) {
    const t = odoSourceTitle(p.label);
    if (!byTitle.has(t)) byTitle.set(t, []);
    byTitle.get(t)!.push(p);
  }
  const blocks: string[] = [];
  for (const [title, list] of [...byTitle.entries()].sort((a, b) => a[0].localeCompare(b[0], "lv"))) {
    const col = TIER_COLOR[list[0]!.tier];
    const rows = [...list]
      .sort((a, b) => a.km - b.km)
      .map(
        (p) =>
          `<tr><td class="tabular">${escapeHtml(dateOnlyFromOdoLabel(p.label))}</td><td class="tabular">${p.km.toLocaleString("lv-LV")} km</td></tr>`,
      )
      .join("");
    blocks.push(`<div class="odo-mini-wrap">
      <p class="odo-mini-title"><span class="odo-dot-only" style="background:${col}" aria-hidden="true"></span><span class="odo-mini-title-txt">${escapeHtml(title)}</span></p>
      <table class="fmt odo-mini bordered"><tbody>${rows}</tbody></table>
    </div>`);
  }
  return blocks.length ? `<div class="odo-mini-grid">${blocks.join("")}</div>` : "";
}

function buildListingMarketScrapeHtml(
  url: string | null | undefined,
  snap: ListingMarketSnapshot | null | undefined,
): string {
  const u = url?.trim();
  if (!u) return "";

  if (!snap) {
    return `<div class="lv-scrape"><p class="lv-scrape-line">Sludinājuma automātiskie dati nav ielādēti.</p></div>`;
  }

  if (!snap.ok) {
    return `<div class="lv-scrape lv-scrape--warn">
      <p class="lv-scrape-line">${escapeHtml(snap.note ?? "Neizdevās nolasīt sludinājumu.")}</p>
      <p class="lv-scrape-link"><a href="${escapeHtml(u)}">atvērt saiti</a></p>
    </div>`;
  }

  const parts: string[] = [];
  parts.push(`<div class="lv-scrape">`);
  parts.push(`<p class="lv-scrape-title">tirgus dati no ss.lv</p>`);
  if (snap.daysListed != null && snap.postedDateRaw) {
    parts.push(
      `<p class="lv-scrape-line"><strong>pārdošanā:</strong> ~${snap.daysListed} d · kopš ${escapeHtml(snap.postedDateRaw)}</p>`,
    );
  } else {
    parts.push(
      `<p class="lv-scrape-line"><strong>pārdošanā:</strong> datums „izvietots” lapā nav atpazīts — skat. saiti.</p>`,
    );
  }
  if (snap.currentPriceEur || snap.currentKm) {
    parts.push(
      `<p class="lv-scrape-line"><strong>tagad lapā:</strong> ${escapeHtml(snap.currentPriceEur ?? "—")}${snap.currentKm ? ` · ${escapeHtml(snap.currentKm)}` : ""}</p>`,
    );
  }
  if (snap.priceChanges.length > 0) {
    parts.push(`<p class="lv-scrape-sub">cenu izmaiņas</p>`);
    parts.push(
      `<table class="fmt lv-scrape-prices bordered"><thead><tr><th>km</th><th>datums</th><th>cena</th></tr></thead><tbody>`,
    );
    for (const r of snap.priceChanges) {
      parts.push(
        `<tr><td class="tabular">${escapeHtml(r.km ?? "—")}</td><td class="tabular">${escapeHtml(r.date)}</td><td class="tabular">${escapeHtml(r.priceEur)}</td></tr>`,
      );
    }
    parts.push(`</tbody></table>`);
  } else if (snap.note) {
    parts.push(`<p class="hint-tight">${escapeHtml(snap.note)}</p>`);
  }
  parts.push(`<p class="lv-scrape-link"><a href="${escapeHtml(u)}">atvērt sludinājumu</a></p>`);
  parts.push(`</div>`);
  return parts.join("\n");
}

function buildLvSourcesBlockHtml(p: ClientReportPayload): string {
  const na = '<p class="na lv-source-empty">nav aizpildīts.</p>';
  const cell = (title: string, inner: string) => `<div class="lv-source-cell">
    <p class="lv-source-title">${escapeHtml(title)}</p>
    ${inner}
  </div>`;

  const c1 = p.csdd.trim()
    ? cell(CLIENT_REPORT_SECTION_LABELS.registryNotes, `<pre class="lv-source-pre">${escapeHtml(p.csdd.trim())}</pre>`)
    : cell(CLIENT_REPORT_SECTION_LABELS.registryNotes, na);

  const c2 = p.ltab.trim()
    ? cell(CLIENT_REPORT_SECTION_LABELS.insuranceNotes, `<pre class="lv-source-pre">${escapeHtml(p.ltab.trim())}</pre>`)
    : cell(CLIENT_REPORT_SECTION_LABELS.insuranceNotes, na);

  const scrape = buildListingMarketScrapeHtml(p.listingUrl, p.listingMarket);
  const tirgusManual = p.tirgus.trim()
    ? `<h4 class="pdf-sub2 lv-tirgus-manual-h">papildu tirgus piezīmes</h4><pre class="lv-source-pre">${escapeHtml(p.tirgus.trim())}</pre>`
    : "";
  const c3Inner = scrape || tirgusManual ? `${scrape}${tirgusManual}` : na;
  const c3 = cell(CLIENT_REPORT_SECTION_LABELS.marketNotes, c3Inner);

  const c4 = p.citi.trim()
    ? cell(CLIENT_REPORT_SECTION_LABELS.otherNotes, `<pre class="lv-source-pre">${escapeHtml(p.citi.trim())}</pre>`)
    : cell(CLIENT_REPORT_SECTION_LABELS.otherNotes, na);

  return `<div class="lv-sources-panel" role="region">
    ${sectionHead(ICO.clip, CLIENT_REPORT_PDF_SECTIONS.lvSources)}
    <p class="lv-sources-lead">viss no admina laukiem <strong>„avotu piezīmes”</strong> — reģistrs, OCTA, tirgus un papildu konteksts. pdf drukā viss redzams bez ritināšanas.</p>
    <div class="lv-source-grid">${c1}${c2}${c3}${c4}</div>
  </div>`;
}

function buildPortfolioBlockHtml(
  portfolio: ClientReportPortfolioRow[],
  pdfInsights: PdfPortfolioFileInsight[],
  formatBytes: (n: number) => string,
): string {
  const portfolioBytes = portfolio.reduce((s, r) => s + r.size, 0);
  const parts: string[] = [];
  parts.push(`<div class="portfolio-panel" role="region">`);
  parts.push(sectionHead(ICO.layers, CLIENT_REPORT_PDF_SECTIONS.portfolio));
  if (portfolio.length === 0) {
    parts.push('<p class="na">Nav importētu datņu.</p>');
    parts.push("</div>");
    return parts.join("\n");
  }
  parts.push(
    `<p class="portfolio-lead"><strong>${portfolio.length}</strong> datnes · kopā <strong>${escapeHtml(formatBytes(portfolioBytes))}</strong>. Zemāk — automātiski izvilkts kopsavilkums no PDF teksta.</p>`,
  );
  parts.push(`<ul class="portfolio-file-list">`);
  for (const r of portfolio) {
    parts.push(
      `<li><span class="pf-name">${escapeHtml(sanitizeAttachmentFileNameForReport(r.name))}</span> · ${escapeHtml(formatBytes(r.size))}</li>`,
    );
  }
  parts.push(`</ul>`);
  if (pdfInsights.length > 0) {
    parts.push(`<div class="pdf-insight-cards">`);
    for (const ins of pdfInsights) {
      const hi = ins.highlights.slice(0, 5).join(" · ") || "—";
      const km =
        ins.kmSamples.length > 0
          ? ins.kmSamples.map((s) => s.km.toLocaleString("lv-LV")).join(", ")
          : "—";
      parts.push(`<div class="pdf-insight-card">
        <p class="pdf-insight-head">Pārskats ${ins.sourceOrdinal}</p>
        <p class="pdf-insight-meta">${escapeHtml(HISTORY_PDF_KIND_LABEL_LV[ins.historyKind])} · ${ins.charCount.toLocaleString("lv-LV")} rakstz.</p>
        <p class="pdf-insight-km"><strong>Nobr. paraugi:</strong> ${escapeHtml(km)}</p>
        <p class="pdf-insight-hi"><strong>Signāli:</strong> ${escapeHtml(hi)}</p>
      </div>`);
    }
    parts.push(`</div>`);
  }
  parts.push("</div>");
  return parts.join("\n");
}

const ALL_TIERS: KmTier[] = ["lv", "hist", "hist2", "dealer", "other"];

/**
 * Katram avotam atsevišķa līkne; virsū punkti ar numuru kā tabulā.
 */
function buildOdometerSvg(points: OdometerChartPoint[]): string {
  if (points.length === 0) {
    return '<p class="na">Nav izdalītu nobraukuma punktu — pievieno reģistra datus un/vai importē vēstures materiālu salīdzinājumam.</p>';
  }
  const w = 520;
  const h = 236;
  const padL = 48;
  const padR = 16;
  const padT = 16;
  const padB = 40;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;
  const sorted = [...points].sort((a, b) => a.km - b.km);
  const kms = sorted.map((p) => p.km);
  const minK = Math.min(...kms);
  const maxK = Math.max(...kms);
  const span = Math.max(maxK - minK, 1);
  const n = sorted.length;

  const coords = sorted.map((p, i) => {
    const x = padL + (n > 1 ? (i / (n - 1)) * innerW : innerW / 2);
    const y = padT + innerH - ((p.km - minK) / span) * innerH;
    return { x, y, km: p.km, tier: p.tier, plotIndex: p.plotIndex };
  });

  const gridLines: string[] = [];
  for (let g = 0; g <= 4; g++) {
    const gy = padT + (g / 4) * innerH;
    gridLines.push(
      `<line x1="${padL.toFixed(1)}" y1="${gy.toFixed(1)}" x2="${(padL + innerW).toFixed(1)}" y2="${gy.toFixed(1)}" stroke="#eef2f6" stroke-width="1"/>`,
    );
  }

  const tierSegments: string[] = [];
  for (const tier of ALL_TIERS) {
    const idxs = coords.map((c, i) => (c.tier === tier ? i : -1)).filter((i) => i >= 0);
    for (let j = 0; j < idxs.length - 1; j++) {
      const a = coords[idxs[j]!]!;
      const b = coords[idxs[j + 1]!]!;
      const col = TIER_COLOR[tier];
      tierSegments.push(
        `<line x1="${a.x.toFixed(1)}" y1="${a.y.toFixed(1)}" x2="${b.x.toFixed(1)}" y2="${b.y.toFixed(1)}" stroke="${col}" stroke-width="2.75" stroke-linecap="round" stroke-linejoin="round" opacity="0.92"/>`,
      );
    }
  }

  const dots = coords
    .map((c) => {
      const col = TIER_COLOR[c.tier];
      return `<g class="odo-vertex">
        <circle cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" r="7" fill="${col}" stroke="#fff" stroke-width="2.5"/>
        <text x="${c.x.toFixed(1)}" y="${(c.y + 4).toFixed(1)}" text-anchor="middle" font-size="9" font-weight="700" fill="#fff">${c.plotIndex}</text>
      </g>`;
    })
    .join("");

  return `
    <div class="chart-card">
      <p class="chart-caption">Hronoloģija pēc nobraukuma · numurs = tabula · līknes pēc datu avota</p>
      <svg viewBox="0 0 ${w} ${h}" class="odo-chart" aria-hidden="true">
        ${gridLines.join("")}
        <line x1="${padL}" y1="${padT + innerH}" x2="${padL + innerW}" y2="${padT + innerH}" stroke="#e2e8f0" stroke-width="1.25"/>
        ${tierSegments.join("")}
        ${dots}
        <text x="${padL}" y="${h - 6}" font-size="10" fill="#64748b" font-weight="500">Diapazons: ${minK.toLocaleString("lv-LV")} — ${maxK.toLocaleString("lv-LV")} km</text>
      </svg>
    </div>`;
}

function buildAllClaimRows(
  ltab: string,
  citi: string,
  insights: PdfPortfolioFileInsight[],
): ClaimTableRow[] {
  return mergeClaimRowLists([
    parseClaimRowsFromLineBasedText(ltab, "OCTA / apdrošināšanas lauks"),
    parseClaimRowsFromLineBasedText(citi, "Citi avoti"),
    insights.flatMap((i) => i.claimRows),
  ]);
}

function officialKmPool(csdd: string, citi: string): number[] {
  return [...extractKmCandidates(csdd), ...extractKmCandidates(citi)];
}

/** Nobraukuma neatbilstība: sludinājums vs augstākais no CSDD + Citi avoti. */
function listingKmDeltaInfo(
  csdd: string,
  tirgus: string,
  citi: string,
): { listingKm: number; maxOfficial: number; deltaKm: number; deltaLabel: string } | null {
  const official = officialKmPool(csdd, citi);
  const listing = extractKmCandidates(tirgus);
  if (official.length === 0 || listing.length === 0) return null;
  const maxOff = Math.max(...official);
  const minList = Math.min(...listing);
  const deltaKm = maxOff - minList;
  if (deltaKm < 500) return null;
  const k = Math.round(deltaKm / 1000);
  const deltaLabel = k >= 1 ? `~${k}k km` : `${deltaKm.toLocaleString("lv-LV")} km`;
  return { listingKm: minList, maxOfficial: maxOff, deltaKm, deltaLabel };
}

function listingVsOfficialKmWarning(csdd: string, tirgus: string, citi: string): string | null {
  const info = listingKmDeltaInfo(csdd, tirgus, citi);
  if (!info || info.deltaKm < 400) return null;
  if (info.listingKm < info.maxOfficial - 400) {
    return `Brīdinājums: sludinājumā norādītais nobraukums (${info.listingKm.toLocaleString("lv-LV")} km) ir zemāks par augstāko CSDD / reģistra un „Citi avoti” piezīmēs minēto (${info.maxOfficial.toLocaleString("lv-LV")} km) — iespējama odometra neatbilstība; nepieciešama manuāla pārbaude.`;
  }
  return null;
}

function extractFirstRegistration(csdd: string): string | null {
  const m = csdd.match(/pirm[āa]\s+reģistr[āa]cij[as]*\s*[:\-]?\s*(\d{1,2}[./]\d{1,2}[./]\d{2,4})/i);
  return m?.[1] ?? null;
}

function extractVehicleMakeModel(csdd: string): string | null {
  const t = csdd.replace(/\r/g, "");
  let m = t.match(
    /(?:marka|modelis)\s*[,&]?\s*(?:modelis|marka)?\s*[:\-]\s*([^\n]{2,72})/i,
  );
  if (m) {
    const s = m[1].trim().split(/\n/)[0]?.trim() ?? "";
    if (s.length >= 2) return s.replace(/\s{2,}/g, " ");
  }
  m = t.match(
    /\b(BMW|Audi|Mercedes-Benz|Mercedes|VW|Volkswagen|Toyota|Volvo|Opel|Ford|Peugeot|Renault|Hyundai|Kia|Škoda|Skoda|Nissan|Mazda|Honda|Citro[ëe]n|Tesla)\s+[A-Za-z0-9][A-Za-z0-9\s\-]{1,32}/i,
  );
  return m ? m[0].trim().replace(/\s{2,}/g, " ") : null;
}

function estimateYearsFromFirstReg(csdd: string): number | null {
  const fr = extractFirstRegistration(csdd);
  if (!fr) return null;
  const d = parseLvDateFragment(fr);
  if (!d) return null;
  const now = new Date();
  const years = (now.getTime() - d.getTime()) / (365.25 * 24 * 3600 * 1000);
  return Math.max(0.5, years);
}

function buildMileageForecastBlock(
  points: OdometerChartPoint[],
  csdd: string,
  tirgus: string,
  citi: string,
): string {
  if (points.length < 2) {
    return `<div class="forecast-box"><div class="forecast-icon" aria-hidden="true">${ICO.spark}</div><div><strong class="forecast-title">Prognoze</strong><p class="forecast-body">Nepietiek punktu līknei — pievienojiet reģistra datus un papildu vēstures materiālu salīdzinājumam.</p></div></div>`;
  }
  const kms = points.map((p) => p.km);
  const minK = Math.min(...kms);
  const maxK = Math.max(...kms);
  const spanKm = maxK - minK;
  let years = estimateYearsFromFirstReg(csdd);
  if (years == null) {
    years = Math.max(1, Math.round(spanKm / 18_000));
  }
  const perYear = Math.round(spanKm / years);
  const perYearK = Math.round(perYear / 1000);
  const rangeLow = maxK + Math.round(perYear * 0.15);
  const rangeHigh = maxK + Math.round(perYear * 0.45);
  const info = listingKmDeltaInfo(csdd, tirgus, citi);
  let warn = "";
  if (info && info.listingKm < info.maxOfficial - 400) {
    warn = `<p class="forecast-warn">Sludinājumā norādītie <strong>${info.listingKm.toLocaleString("lv-LV")} km</strong> uzskatāmi par <strong>apzināti maldinošiem</strong> salīdzinājumā ar augstāko vērtību no CSDD / reģistra un „Citi avoti” (${info.maxOfficial.toLocaleString("lv-LV")} km; starpība ≈ ${info.deltaLabel}).</p>`;
  }
  return `<div class="forecast-box"><div class="forecast-icon" aria-hidden="true">${ICO.spark}</div><div><strong class="forecast-title">Prognoze</strong>
    <p class="forecast-body">Pēc pieejamajiem punktiem: nobraukuma starpība <strong>${minK.toLocaleString("lv-LV")} – ${maxK.toLocaleString("lv-LV")} km</strong> aptuveni <strong>${years.toFixed(1)}</strong> gadu posmā → vidēji <strong>~${perYearK}k km gadā</strong> (formula: (pēdējais − pirmais) / gadu skaits).</p>
    <p class="forecast-body">Statistiski sagaidāms diapazons šodien (orientējoši): <strong>${rangeLow.toLocaleString("lv-LV")} – ${rangeHigh.toLocaleString("lv-LV")} km</strong> — salīdziniet ar sludinājumu un vēstures atskaitēm.</p>
    ${warn}
  </div></div>`;
}

function extractListingPriceEur(tirgus: string): string | null {
  const t = tirgus.replace(/\u00a0/g, " ");
  const m = t.match(/([\d\s]{3,12})\s*(?:EUR|€)/i);
  if (!m) return null;
  const n = parseInt(m[1].replace(/\s/g, ""), 10);
  if (Number.isNaN(n) || n < 100) return null;
  return `${n.toLocaleString("lv-LV")} EUR`;
}

type RiskRow = { kind: string; statusHtml: string; note: string };

function buildRiskRows(
  csdd: string,
  tirgus: string,
  ltab: string,
  citi: string,
  insRows: ClaimTableRow[],
): RiskRow[] {
  const corpus = `${csdd}\n${ltab}\n${citi}`.toLowerCase();
  const stolen = /zagts|mekl[ēe]šan[āa]|nozagt|asl[īi]\s*zag|wanted|stolen|theft|noziedz/i.test(corpus);
  const legal: RiskRow = stolen
    ? {
        kind: "Juridiskais statuss",
        statusHtml: '<span class="st-crit">Kritiski</span>',
        note: "Tekstā minēti riska signāli attiecībā uz nozagtu transportlīdzekli vai meklēšanu — pārbaudiet oficiālos avotus.",
      }
    : {
        kind: "Juridiskais statuss",
        statusHtml: '<span class="st-ok">Tīrs</span>',
        note: "Nav reģistrēts kā zagts vai meklēšanā (pēc pieejamā teksta heuristikas).",
      };

  const kmInfo = listingKmDeltaInfo(csdd, tirgus, citi);
  const kmWarn = listingVsOfficialKmWarning(csdd, tirgus, citi);
  let mileage: RiskRow;
  if (kmWarn && kmInfo) {
    mileage = {
      kind: "Nobraukuma ticamība",
      statusHtml: '<span class="st-crit">Kritiski</span>',
      note: `Sludinājuma dati nesakrīt ar CSDD / reģistru un „Citi avoti” (≈ ${kmInfo.deltaLabel} pret augstāko fiksāciju).`,
    };
  } else if (
    extractKmCandidates(csdd).length === 0 &&
    extractKmCandidates(tirgus).length === 0 &&
    extractKmCandidates(citi).length === 0
  ) {
    mileage = {
      kind: "Nobraukuma ticamība",
      statusHtml: '<span class="st-warn">Nav datu</span>',
      note: "Nav pietiekami nobraukuma atsauču salīdzināšanai — aizpildiet reģistra un sludinājuma laukus.",
    };
  } else {
    mileage = {
      kind: "Nobraukuma ticamība",
      statusHtml: '<span class="st-ok">Salīdzināms</span>',
      note: "Nobraukums nav automātiski atzīmēts kā kritiski pretrunīgs ar reģistra rindām.",
    };
  }

  const nIns = insRows.length;
  const insCorpus = `${ltab}\n${citi}`;
  const heavy =
    insRows.some((r) => r.emphasize) ||
    /total\s*loss|piln[īi]g[aā]\s*boj|7\s+fiks/i.test(insCorpus);
  const accCount =
    nIns ||
    (() => {
      const m = insCorpus.match(/(\d+)\s*(?:fiks[ēe]ti\s*)?(?:gad[īi]jum|negad[īi]jum)/i);
      return m ? parseInt(m[1], 10) : 0;
    })();
  let damage: RiskRow;
  if (accCount >= 3 || heavy) {
    damage = {
      kind: "Bojājumu vēsture",
      statusHtml: '<span class="st-warn">Uzmanību</span>',
      note: `Fiksēti ${Math.max(accCount, nIns || 1)} negadījumi (pēc tabulas / teksta), t.sk. iespējams smags / pilnīgs bojājums — pārbaudiet detaļas sadaļā „Apdrošināšanas konteksts”.`,
    };
  } else if (nIns === 0 && !/negad[īi]jum|av[āa]rija|boj[āa]j/i.test(insCorpus)) {
    damage = {
      kind: "Bojājumu vēsture",
      statusHtml: '<span class="st-ok">Nav izcelts</span>',
      note: "Strukturētā tabulā nav atlīdzību rindu; tekstā nav spēcīgu negadījumu atslēgvārdu.",
    };
  } else {
    damage = {
      kind: "Bojājumu vēsture",
      statusHtml: '<span class="st-warn">Uzmanību</span>',
      note: "Ir vismaz daži bojājumu / atlīdzību ieraksti — skatīt apdrošināšanas tabulu.",
    };
  }

  const taSev = collectTaSeverityWarnings(csdd, citi);
  const fixed =
    /atk[āa]rtot[āa].{0,80}?vērt[ēe]jums\s*0|visi\s+defekti\s+novērst|vērt[ēe]jums\s*:\s*0\b/i.test(csdd);
  let technical: RiskRow;
  if (fixed && taSev.length === 0) {
    technical = {
      kind: "Tehniskais stāvoklis",
      statusHtml: '<span class="st-ok">Labots</span>',
      note: "Pēdējie CSDD fiksētie defekti, šķiet, novērsti (tekstā minēta atkārtotā pārbaude ar labu vērtējumu).",
    };
  } else if (taSev.length > 0) {
    technical = {
      kind: "Tehniskais stāvoklis",
      statusHtml: '<span class="st-warn">Uzmanību</span>',
      note: taSev.join(" "),
    };
  } else {
    technical = {
      kind: "Tehniskais stāvoklis",
      statusHtml: '<span class="st-ok">Nav signālu</span>',
      note: "TA piezīmēs nav automātiski atrasts vērtējums „2” vai neatrisinātu defektu apraksts.",
    };
  }

  return [legal, mileage, damage, technical];
}

function splitExpertConclusion(iriss: string): { rating: string | null; summary: string } {
  const t = iriss.trim();
  if (!t) return { rating: null, summary: "" };
  const lines = t.split(/\r?\n/);
  const first = lines[0]?.trim() ?? "";
  const looksLikeHeadline =
    first.length <= 88 &&
    (/^(IZSKATĀS|UZMANĪBU|ĻOTI|BR[ĪI]DIN|OK|LABI|SLIKTI|NAV\s+IETEIC|IETEIC|NEIESAK)/i.test(first) ||
      /[!?⚠️✅🚩]/.test(first) ||
      /^.{1,55}!$/.test(first));
  if (looksLikeHeadline && lines.length > 1) {
    return { rating: first, summary: lines.slice(1).join("\n").trim() };
  }
  if (looksLikeHeadline && lines.length === 1) {
    return { rating: first, summary: "" };
  }
  return { rating: null, summary: t };
}

function exportRowHtml(): string {
  return "";
}

function reportFooterScript(): string {
  return `<script>
function provinReportExport(){
  try{
    var blocks=[];
    document.querySelectorAll("table.report-export").forEach(function(tb){
      var rows=tb.querySelectorAll("tr");
      for(var i=0;i<rows.length;i++){
        var cells=rows[i].querySelectorAll("th,td");
        var line=[];
        for(var j=0;j<cells.length;j++) line.push('"'+cells[j].innerText.replace(/"/g,'""')+'"');
        blocks.push(line.join("\\t"));
      }
      blocks.push("");
    });
    var blob=new Blob([blocks.join("\\n")],{type:"text/csv;charset=utf-8;"});
    var a=document.createElement("a");
    a.href=URL.createObjectURL(blob);
    a.download="provin-atskaite.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }catch(e){ alert("Eksports neizdevās."); }
}
</script>`;
}

function clientReportPrintCss(): string {
  return `
      *{box-sizing:border-box;}
      body{
        font-family:Inter,system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;
        line-height:1.55;max-width:190mm;margin:0 auto;padding:10mm 12mm;color:#0f172a;
        background:#f1f5f9;
      }
      .sheet{background:#fff;border-radius:16px;box-shadow:0 1px 3px rgba(15,23,42,.06);padding:14mm 12mm;}
      @media print{.sheet{box-shadow:none;border-radius:0;padding:0}}
      .report-head{
        border-bottom:1px solid #e2e8f0;padding-bottom:16px;margin-bottom:22px;
        background:transparent;
      }
      .report-head h1{
        display:flex;flex-wrap:wrap;align-items:baseline;gap:0 6px;margin:8px 0 6px;
        font-size:1.28rem;font-weight:650;color:#1d1d1f;letter-spacing:-0.02em;line-height:1.25;
      }
      .report-head h1 .brand{font-size:0.58em;letter-spacing:0.06em;text-transform:lowercase;color:#0066d6;font-weight:700;}
      .report-head .brand-sep{color:#94a3b8;font-weight:500;font-size:0.55em;}
      .report-head h1 .title-main{font-weight:650;text-transform:lowercase;}
      .report-head .sub{font-size:0.84rem;color:#6e6e73;}
      .vin-inline{display:inline-block;margin-left:6px;padding:2px 10px;background:#f1f5f9;border-radius:6px;font-size:0.82rem;text-transform:none;}
      .pdf-sec-head{display:flex;align-items:center;gap:10px;margin:1.65rem 0 0.55rem;}
      .pdf-sec-head .pdf-ico{color:#0066d6;flex-shrink:0;}
      h2.pdf-sec{
        font-size:1.02rem;font-weight:600;margin:0;flex:1;color:#0f172a;padding:0 0 0 12px;border:none;
        text-transform:lowercase;letter-spacing:-0.02em;border-left:3px solid #0066d6;
      }
      h3.pdf-sub{font-size:0.9rem;font-weight:600;margin:1rem 0 0.4rem;color:#334155;text-transform:lowercase;}
      h4.pdf-sub2{font-size:0.84rem;font-weight:600;margin:0.65rem 0 0.25rem;color:#1d1d1f;text-transform:lowercase;}
      .client-msg{font-style:italic;color:#475569;margin:0.35rem 0 0.75rem;line-height:1.5;}
      .client-klients{margin:0 0 0.5rem;font-size:0.9rem;}
      .callout-warn{
        margin:10px 0;padding:10px 14px;border-radius:8px;background:#fef2f2;border:1px solid #fecaca;color:#991b1b;font-size:0.86rem;
      }
      .listing-warn-amber{
        margin:8px 0;padding:8px 12px;border-radius:8px;background:#fffbeb;border:1px solid #fde68a;font-size:0.86rem;color:#92400e;
      }
      .listing-delta{color:#b91c1c;font-weight:600;margin-left:6px;}
      .ta-status{
        margin:12px 0 16px;padding:14px 16px 16px;border-radius:10px;border:1px solid transparent;
        border-left-width:5px;
      }
      .ta-status-title{margin:0 0 8px;font-size:0.95rem;font-weight:700;color:#14532d;text-transform:lowercase;}
      .ta-status-text{margin:0;font-size:0.88rem;line-height:1.5;color:#166534;}
      .ta-status.ta-ok{background:#dcfce7;border-color:#86efac;border-left-color:#22c55e;}
      .ta-status.ta-ok .ta-status-title{color:#14532d;}
      .ta-status.ta-ok .ta-status-text{color:#166534;}
      .ta-status.ta-soon{background:#ffedd5;border-color:#fdba74;border-left-color:#ea580c;}
      .ta-status.ta-soon .ta-status-title{color:#9a3412;}
      .ta-status.ta-soon .ta-status-text{color:#c2410c;}
      .ta-status.ta-expired{background:#fee2e2;border-color:#fca5a5;border-left-color:#dc2626;}
      .ta-status.ta-expired .ta-status-title{color:#991b1b;}
      .ta-status.ta-expired .ta-status-text{color:#b91c1c;}
      .ta-status.ta-unknown{background:#f1f5f9;border-color:#cbd5e1;border-left-color:#64748b;}
      .ta-status.ta-unknown .ta-status-title{color:#334155;}
      .ta-status.ta-unknown .ta-status-text{color:#475569;}
      .ta-divider{margin:18px 0 10px;padding-top:14px;border-top:2px solid #e2e8f0;}
      table{width:100%;border-collapse:collapse;font-size:0.82rem;}
      table.fmt{margin:0.5rem 0;}
      table.fmt td,table.fmt th{padding:9px 0;border-bottom:1px solid #e5e7eb;vertical-align:top;}
      table.fmt thead th{text-transform:lowercase;}
      table.fmt thead th{font-weight:700;font-size:0.78rem;color:#1d1d1f;border-bottom:2px solid #cbd5e1;padding-top:4px;}
      table.fmt.bordered td,table.fmt.bordered th{padding:8px 10px;border:1px solid #e5e7eb;}
      table.fmt.bordered thead th{background:#eef2f7;}
      table.fmt.risk td,table.fmt.risk th{padding:10px 8px;border-bottom:1px solid #e5e7eb;}
      table.fmt.risk th{background:transparent;font-weight:700;text-align:left;color:#1d1d1f;}
      table.fmt.risk td:nth-child(2){white-space:nowrap;}
      .st-ok{color:#15803d;font-weight:600;}
      .st-warn{color:#b45309;font-weight:600;}
      .st-crit{color:#b91c1c;font-weight:600;}
      .tabular{font-variant-numeric:tabular-nums;}
      table.fmt.odo{font-size:0.82rem;}
      table.fmt.odo thead th{background:linear-gradient(180deg,#f8fafc 0%,#f1f5f9 100%);font-weight:700;color:#334155;border-bottom:2px solid #e2e8f0;}
      table.fmt.odo tbody tr:nth-child(even){background:#fafafa;}
      table.fmt.odo .odo-idx{font-weight:700;color:#475569;width:2rem;}
      table.fmt.odo .odo-graph-cell{text-align:center;width:3.25rem;vertical-align:middle;}
      .odo-dot-badge{
        display:inline-flex;align-items:center;justify-content:center;
        min-width:1.5rem;height:1.5rem;padding:0 4px;border-radius:999px;
        font-size:0.68rem;font-weight:800;color:#fff;letter-spacing:-0.02em;
        border:2px solid #fff;box-shadow:0 1px 3px rgba(15,23,42,.18);
        vertical-align:middle;
      }
      tr.odo-row-citi td{background:rgba(254,226,226,.5)!important;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
      tr.odo-row-citi td:first-child{box-shadow:inset 4px 0 0 #b91c1c;}
      .odo-citi-callout{
        margin:10px 0 12px;padding:10px 14px;border-radius:9px;
        background:#fef2f2;border:1px solid #fecaca;color:#991b1b;font-size:0.84rem;line-height:1.5;
      }
      table.fmt.ins td.flag-cell{width:48px;text-align:right;font-size:1.2rem;}
      table.fmt.ins tr.em td{font-weight:700;}
      table.fmt.ins tr.ins-from-report td{background:#f8fafc;}
      table.fmt.ins .ins-source{display:block;font-size:0.72rem;color:#64748b;margin-top:4px;line-height:1.35;}
      .claims-intro{font-size:0.84rem;color:#334155;line-height:1.5;margin:0 0 12px;}
      .td-warn{color:#b91c1c;font-weight:600;}
      pre.block{white-space:pre-wrap;font-size:0.82rem;background:#f8fafc;border:1px solid #e2e8f0;padding:11px 14px;border-radius:9px;margin:0.5rem 0;}
      .na{color:#86868b;font-style:italic;}
      .hint{font-size:0.76rem;color:#6e6e73;margin-top:0.45rem;line-height:1.45;}
      .ta-list{margin:0.4rem 0;padding-left:1.2rem;}
      .ta-list li{margin:0.35rem 0;}
      .chart-card,.block-minimal{
        margin:14px 0;padding:16px 18px;border-radius:12px;border:1px solid #e8eaed;background:#fafbfc;
      }
      .chart-caption{font-size:0.78rem;color:#64748b;margin:0 0 10px;font-weight:500;}
      .odo-chart{width:100%;max-width:100%;height:auto;display:block;}
      .tier-line-dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:8px;vertical-align:middle;}
      .odo-src-cell{vertical-align:middle;}
      .odo-src-txt{font-weight:500;color:#334155;}
      .portfolio-stat{margin:0;font-size:0.88rem;color:#475569;}
      .portfolio-stat-num{font-size:1.35rem;font-weight:700;color:#0066d6;margin-right:4px;}
      .compare-strip{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin:0 0 18px;}
      .compare-card{
        border:1px solid #e8eaed;border-radius:12px;padding:12px 14px;background:#fff;
      }
      .compare-card-top{font-size:0.72rem;font-weight:700;text-transform:lowercase;letter-spacing:0.04em;color:#0066d6;}
      .compare-card-type{font-size:0.75rem;color:#64748b;margin:4px 0;}
      .compare-card-km{font-size:1rem;font-weight:700;color:#0f172a;margin-top:6px;}
      .compare-card-meta{font-size:0.72rem;color:#94a3b8;margin-top:6px;}
      .hint-tight{font-size:0.78rem!important;line-height:1.45!important;}
      .legend-item{display:inline-flex;align-items:center;gap:8px;}
      .legend-dot{width:10px;height:10px;border-radius:50%;flex-shrink:0;}
      .forecast-box{
        display:flex;gap:14px;align-items:flex-start;margin:14px 0;padding:16px 18px;border-radius:12px;
        background:#fffbeb;border:1px solid #fde68a;
      }
      .forecast-icon{margin:0;line-height:0;color:#ca8a04;}
      .forecast-title{display:block;font-size:0.72rem;letter-spacing:0.04em;text-transform:lowercase;color:#92400e;margin-bottom:4px;}
      .forecast-body{margin:0.4rem 0 0;font-size:0.86rem;color:#1d1d1f;}
      .forecast-warn{margin:0.65rem 0 0;font-size:0.84rem;color:#991b1b;}
      .export-hint{font-size:0.74rem;color:#64748b;margin:10px 0 4px;display:flex;align-items:center;gap:6px;}
      .export-ico{opacity:0.85;}
      .expert-verdict{margin:12px 0 8px;}
      .expert-rating{font-size:0.95rem;margin:0 0 10px;}
      .expert-summary-label{font-size:0.82rem;margin:0 0 4px;color:#475569;}
      .expert-panel-bottom{
        margin:8px 0 18px;padding:18px 20px;border-radius:12px;
        background:#f8fafc;border:1px solid #e2e8f0;border-left:3px solid #0066d6;
      }
      .expert-panel-bottom .expert-title{
        font-size:11px;letter-spacing:0.06em;text-transform:lowercase;color:#0066d6;font-weight:700;margin:0 0 10px;
      }
      .expert-panel-bottom .expert-body{font-size:0.92rem;color:#1d1d1f;white-space:pre-wrap;line-height:1.6;}
      .visual-archive{
        margin:14px 0;padding:12px 14px;border-radius:10px;background:#f8fafc;border:1px solid #e2e8f0;
      }
      .visual-archive .va-title{font-size:0.82rem;font-weight:700;margin:0 0 8px;}
      .legend-box{margin-top:16px;padding:12px 0 8px;border-top:1px solid #e5e7eb;}
      .legend-box h3{margin:0 0 10px;font-size:0.82rem;font-weight:700;color:#1d1d1f;text-transform:lowercase;letter-spacing:0.04em;}
      .legend-inline{display:flex;flex-wrap:wrap;gap:10px 18px;font-size:0.78rem;color:#334155;}
      .legend-inline span{white-space:nowrap;}
      .history-compare-panel{
        margin:20px 0 24px;padding:20px 22px;border-radius:14px;
        background:#fff;border:1px solid #e2e8f0;
        box-shadow:0 1px 2px rgba(15,23,42,.04);
        -webkit-print-color-adjust:exact;print-color-adjust:exact;
      }
      .history-compare-panel.history-compare-empty{
        background:#fafbfc;border-color:#e2e8f0;
      }
      .history-compare-panel .pdf-sec-head{margin-top:0;}
      .history-compare-lead{font-size:0.88rem;line-height:1.55;color:#1e293b;margin:0 0 14px;}
      .history-compare-usage-grid{
        display:grid;gap:10px;margin:0 0 16px;
        grid-template-columns:repeat(auto-fit,minmax(210px,1fr));
      }
      .history-compare-usage-card{
        background:#fafbfc;border:1px solid #e8eaed;border-radius:10px;padding:12px 14px;
        font-size:0.78rem;line-height:1.45;color:#334155;
      }
      .hcu-tag{
        display:block;font-weight:700;font-size:0.68rem;text-transform:lowercase;letter-spacing:0.04em;color:#0066d6;margin-bottom:6px;
      }
      table.history-compare-table{font-size:0.78rem;}
      table.history-compare-table thead th{background:#f1f5f9!important;color:#334155!important;border-color:#e2e8f0!important;}
      .history-compare-bullets{margin:14px 0 0;padding-left:1.2rem;font-size:0.84rem;line-height:1.55;color:#0f172a;}
      .history-compare-bullets li{margin:6px 0;}
      .history-compare-foot{margin-top:12px!important;}
      .history-compare-slim .history-compare-bullets-slim{margin-top:10px;}
      .summary-panel{margin:18px 0;padding:0;}
      .summary-lead{font-size:0.88rem;color:#334155;margin:0 0 16px;line-height:1.5;}
      .lv-sources-panel{margin:20px 0;}
      .lv-sources-lead{font-size:0.86rem;color:#334155;margin:0 0 14px;line-height:1.5;}
      .lv-source-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;}
      @media(max-width:720px){.lv-source-grid{grid-template-columns:1fr;}}
      .lv-source-cell{border:1px solid #e2e8f0;border-radius:12px;padding:10px 12px;background:#fafbfc;}
      .lv-source-title{font-size:0.72rem;font-weight:700;text-transform:lowercase;letter-spacing:0.04em;color:#0066d6;margin:0 0 8px;}
      .lv-source-pre{
        margin:0;font-size:0.72rem;line-height:1.42;white-space:pre-wrap;word-break:break-word;
        color:#1e293b;text-transform:none;
      }
      .lv-tirgus-manual-h{margin-top:12px!important;}
      .lv-scrape{margin:0 0 10px;padding:10px 12px;border-radius:10px;border:1px solid #e2e8f0;background:#fff;}
      .lv-scrape--warn{background:#fffbeb;border-color:#fde68a;}
      .lv-scrape-title{font-size:0.72rem;font-weight:700;color:#0066d6;margin:0 0 8px;text-transform:lowercase;letter-spacing:0.04em;}
      .lv-scrape-sub{font-size:0.76rem;font-weight:600;color:#334155;margin:10px 0 6px;text-transform:lowercase;}
      .lv-scrape-line{font-size:0.78rem;margin:0 0 6px;line-height:1.45;color:#1e293b;text-transform:lowercase;}
      .lv-scrape-line strong{font-weight:600;text-transform:lowercase;}
      .lv-scrape-link{font-size:0.74rem;margin:8px 0 0;}
      .lv-scrape-link a{color:#0066d6;}
      table.lv-scrape-prices{font-size:0.76rem;}
      table.lv-scrape-prices thead th{text-transform:lowercase;font-size:0.7rem;}
      .lv-source-empty{margin:0;font-size:0.8rem;}
      .portfolio-panel{margin:20px 0;}
      .portfolio-lead{font-size:0.86rem;margin:0 0 10px;color:#334155;}
      .portfolio-file-list{margin:8px 0 14px;padding-left:1.1rem;font-size:0.82rem;color:#475569;}
      .pdf-insight-cards{display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));}
      .pdf-insight-card{border:1px solid #e8eaed;border-radius:10px;padding:10px 12px;background:#fff;}
      .pdf-insight-head{font-weight:700;font-size:0.82rem;margin:0 0 4px;color:#0f172a;text-transform:lowercase;}
      .pdf-insight-meta{font-size:0.72rem;color:#64748b;margin:0 0 6px;}
      .pdf-insight-km,.pdf-insight-hi{font-size:0.76rem;margin:4px 0 0;line-height:1.4;color:#334155;}
      table.odo-compact .odo-dots-th{width:88px;}
      .odo-dots-cell{display:flex;flex-wrap:wrap;align-items:center;gap:6px;vertical-align:middle;}
      .odo-dot-only{
        display:inline-block;width:12px;height:12px;border-radius:50%;flex-shrink:0;
        border:1px solid rgba(15,23,42,.12);box-shadow:0 0 0 1px #fff;
      }
      .odo-mini-grid{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));margin-top:10px;}
      .odo-mini-wrap{border:1px solid #e8eaed;border-radius:10px;padding:10px;background:#fff;}
      .odo-mini-title{display:flex;align-items:center;gap:8px;margin:0 0 8px;font-size:0.78rem;font-weight:600;color:#334155;}
      .odo-mini-title-txt{flex:1;}
      table.odo-mini{font-size:0.76rem;width:100%;}
      table.odo-mini td{padding:4px 6px;border-bottom:1px solid #f1f5f9;}
      .ins-compact{font-size:0.8rem;}
      .ins-compact td,.ins-compact th{padding:7px 8px;}
      .claims-intro-tight{margin-bottom:8px!important;}
      .legal-block{
        margin-top:18px;padding:14px 16px;border-radius:10px;background:#f5f5f7;border:1px solid #e8e8ed;
        font-size:0.74rem;color:#6e6e73;line-height:1.55;
      }
      .legal-block strong{color:#424245;font-weight:600;}
      .report-foot{margin-top:16px;padding-top:12px;border-top:1px solid #e5e5ea;font-size:0.7rem;color:#aeaeb2;line-height:1.45;}
      code{font-size:0.78rem;background:#f1f5f9;padding:2px 8px;border-radius:6px;text-transform:none;}
      .prov-uc{text-transform:none!important;}
      .expert-title{text-transform:lowercase;}
      @media print{
        body{padding:10mm 12mm;background:#fff;}
        .sheet{background:#fff}
        .no-print{display:none!important;}
        .ta-status{-webkit-print-color-adjust:exact;print-color-adjust:exact;}
      }
    `;
}

function buildHistoryCompareSectionHtml(insights: PdfPortfolioFileInsight[]): string {
  if (insights.length === 0) {
    return `<div class="history-compare-panel history-compare-empty" role="region">
      ${sectionHead(ICO.layers, CLIENT_REPORT_PDF_SECTIONS.historyCompare)}
      <p class="history-compare-lead">Nav importēta strukturēta vēstures materiāla — zemāk nobraukuma grafiks balstīsies tikai uz Latvijas laukiem.</p>
    </div>`;
  }

  const rows = buildHistoryCompareRows(insights);
  const bullets = buildHistoryCompareBullets(rows);

  const parts: string[] = [];
  parts.push(`<div class="history-compare-panel history-compare-slim" role="region">`);
  parts.push(sectionHead(ICO.layers, CLIENT_REPORT_PDF_SECTIONS.historyCompare));
  parts.push(
    `<p class="history-compare-lead">Īss <strong>starpavotu kopskats</strong> importētajiem PDF. Detalizēts teksts — <strong>§3</strong>; salīdzinājums ar LV datiem — grafiks un tabulas zemāk.</p>`,
  );

  parts.push(`<div class="compare-strip">`);
  for (const r of rows) {
    const kmR =
      r.minKm != null && r.maxKm != null
        ? `${r.minKm.toLocaleString("lv-LV")}–${r.maxKm.toLocaleString("lv-LV")} km`
        : "—";
    parts.push(`<div class="compare-card">
      <div class="compare-card-top">${escapeHtml(r.sourceLabel)}</div>
      <div class="compare-card-type">${escapeHtml(COMPARE_KIND_SHORT[r.historyKind])}</div>
      <div class="compare-card-km">${escapeHtml(kmR)}</div>
      <div class="compare-card-meta">${r.nSamples} nobr. · ${r.highlights.length} sign.</div>
    </div>`);
  }
  parts.push(`</div>`);

  if (bullets.length > 0) {
    parts.push(`<ul class="history-compare-bullets history-compare-bullets-slim">`);
    for (const b of bullets.slice(0, 6)) {
      parts.push(`<li>${escapeHtml(b)}</li>`);
    }
    parts.push(`</ul>`);
  }

  parts.push(
    `<p class="hint history-compare-foot">Avotu tips — automātiska klasifikācija; pretrunas skat. sadaļā „Pretrunas un riski”.</p>`,
  );
  parts.push(`</div>`);
  return parts.join("\n");
}

export function buildClientReportDocumentHtml(args: {
  payload: ClientReportPayload;
  portfolio: ClientReportPortfolioRow[];
  pdfInsights: PdfPortfolioFileInsight[];
  dateFmt: Intl.DateTimeFormat;
  formatBytes: (n: number) => string;
}): string {
  const { payload, portfolio, pdfInsights, dateFmt, formatBytes } = args;
  const p = payload;

  const money =
    p.amountTotal == null
      ? "—"
      : new Intl.NumberFormat("lv-LV", { style: "currency", currency: p.currency ?? "EUR" }).format(
          p.amountTotal / 100,
        );

  const allClaimRows = buildAllClaimRows(p.ltab, p.citi, pdfInsights);
  const insRows = filterClaimRowsForClientReport(allClaimRows);
  const odoPts = buildOdometerChartPoints(p.csdd, pdfInsights, p.citi);
  const odoMerged = mergeOdometerPointsForDisplay(odoPts);
  const riskRows = buildRiskRows(p.csdd, p.tirgus, p.ltab, p.citi, allClaimRows);
  const taValidUntil = findTaValidUntilDate(`${p.csdd}\n${p.citi}`);
  const makeModel = extractVehicleMakeModel(p.csdd);
  const firstReg = extractFirstRegistration(p.csdd);
  const expertParts = splitExpertConclusion(p.iriss);
  const listDelta = listingKmDeltaInfo(p.csdd, p.tirgus, p.citi);
  const listWarnLong = listingVsOfficialKmWarning(p.csdd, p.tirgus, p.citi);
  const citiOdoCallout = buildCitiOdometerRollbackCallout(p.citi);
  const priceAd = extractListingPriceEur(p.tirgus);
  const listingKms = extractKmCandidates(p.tirgus);
  const minListingKm = listingKms.length ? Math.min(...listingKms) : null;

  const lines: string[] = [];
  lines.push('<div class="sheet">');
  lines.push('<div class="report-head">');
  lines.push(
    `<h1><span class="brand">PROVIN<span style="color:#0066d6">.LV</span></span><span class="brand-sep">|</span><span class="title-main">${escapeHtml(CLIENT_REPORT_SECTION_LABELS.mainTitle)}</span></h1>`,
  );
  lines.push(
    `<p class="sub">Ģenerēts: ${escapeHtml(dateFmt.format(new Date()))}<span class="vin-inline">VIN <code>${escapeHtml(p.vin ?? "—")}</code></span></p>`,
  );
  lines.push("</div>");

  /* 1. Klients */
  lines.push(sectionHead(ICO.user, CLIENT_REPORT_PDF_SECTIONS.client));
  lines.push(`<h3 class="pdf-sub">Ziņojums</h3>`);
  lines.push(
    `<p class="client-msg">${escapeHtml(p.notes?.trim() ? p.notes : "—")}</p>`,
  );
  const klientsBits = [p.customerName?.trim(), p.customerPhone?.trim()].filter(Boolean);
  lines.push(
    `<p class="client-klients"><strong>Klients:</strong> ${escapeHtml(klientsBits.join(" · ") || "—")}</p>`,
  );
  if (p.customerEmail?.trim()) {
    lines.push(`<p class="hint" style="margin-top:0">E-pasts: ${escapeHtml(p.customerEmail)}</p>`);
  }

  /* 2. Latvijas avoti (CSDD, LTAB, Tirgus, Citi) */
  lines.push(buildLvSourcesBlockHtml(p));
  lines.push(exportRowHtml());

  /* 3. Portfelis */
  lines.push(buildPortfolioBlockHtml(portfolio, pdfInsights, formatBytes));
  lines.push(exportRowHtml());

  /* 4. Salīdzinošais kopsavilkums */
  lines.push(`<div class="summary-panel" role="region">`);
  lines.push(sectionHead(ICO.chart, CLIENT_REPORT_PDF_SECTIONS.summary));
  lines.push(
    `<p class="summary-lead">Apvieno <strong>Latvijas lauku</strong> un <strong>importēto vēsturi</strong>. Pretrunas un interpretācija — sadaļā „Pretrunas un riski”.</p>`,
  );
  lines.push(buildHistoryCompareSectionHtml(pdfInsights));

  lines.push(`<h3 class="pdf-sub">${escapeHtml(CLIENT_REPORT_PDF_SECTIONS.odometer)}</h3>`);
  lines.push(buildOdometerSvg(odoPts));
  lines.push(buildMileageForecastBlock(odoPts, p.csdd, p.tirgus, p.citi));
  if (citiOdoCallout) {
    lines.push(`<div class="odo-citi-callout"><strong>Citi avoti — odometrs:</strong> ${escapeHtml(citiOdoCallout)}</div>`);
  }
  lines.push(`<h4 class="pdf-sub2">Odometra ieraksti (apvienoti)</h4>`);
  lines.push(
    `<p class="hint hint-tight">Kolonna „Avots”: tikai krāsaini punkti (skat. leģendu). Vairāki punkti — vairāki neatkarīgi avoti; grafika # = šīs tabulas numuri.</p>`,
  );
  if (odoPts.length > 0) {
    lines.push(
      `<table class="fmt odo odo-compact bordered report-export" data-export="odo"><thead><tr><th>#</th><th class="odo-dots-th">Avots</th><th class="tabular">Nobraukums</th><th class="tabular">Datums</th></tr></thead><tbody>`,
    );
    lines.push(buildOdometerMergedTableRows(odoMerged));
    lines.push(`</tbody></table>`);
    const mini = buildOdometerMiniTablesBySource(odoPts);
    if (mini) {
      lines.push(`<h4 class="pdf-sub2">Ieraksti pēc avota</h4>`);
      lines.push(mini);
    }
  } else {
    lines.push('<p class="na">Nav odometra punktu — aizpildiet CSDD / citus laukus un/vai importējiet PDF.</p>');
  }
  lines.push(exportRowHtml());

  const insTitle =
    insRows.length > 0
      ? `${CLIENT_REPORT_PDF_SECTIONS.insurance} (${insRows.length})`
      : CLIENT_REPORT_PDF_SECTIONS.insurance;
  lines.push(`<h3 class="pdf-sub">${escapeHtml(insTitle)}</h3>`);
  lines.push(
    `<p class="claims-intro claims-intro-tight">Tikai īss veids, datums, valsts un summa. Pilns OCTA / piezīmju teksts — <strong>§2</strong>.</p>`,
  );
  if (insRows.length > 0) {
    lines.push(
      `<table class="fmt ins ins-compact bordered report-export" data-export="claims"><thead><tr><th>Datums</th><th>Veids</th><th class="tabular">∑</th><th class="flag-cell">Valsts</th></tr></thead><tbody>`,
    );
    for (const r of insRows) {
      const rowClass = r.emphasize ? ' class="em"' : "";
      const kind = compactDamageKindLabel(r);
      lines.push(
        `<tr${rowClass}><td>${escapeHtml(r.date)}</td><td>${escapeHtml(kind)}</td><td class="tabular">${escapeHtml(r.amount)}</td><td class="flag-cell">${flagEmoji(r.iso)}</td></tr>`,
      );
    }
    lines.push(`</tbody></table>`);
    lines.push(`<p class="hint hint-tight">! = smags / augsta summa. Kolonna „Valsts” — ISO karogs.</p>`);
  } else {
    lines.push(`<p class="hint">Nav filtrētu bojājumu rindu — skat. §2 (OCTA) un §3 (PDF).</p>`);
  }
  lines.push(`</div>`);
  lines.push(exportRowHtml());

  /* 5. Pretrunas un riski */
  const taSev = collectTaSeverityWarnings(p.csdd, p.citi);
  lines.push(sectionHead(ICO.shield, CLIENT_REPORT_PDF_SECTIONS.discrepancies));
  lines.push(`<h3 class="pdf-sub">${escapeHtml(CLIENT_REPORT_PDF_SECTIONS.risk)}</h3>`);
  lines.push(
    `<table class="fmt risk report-export" data-export="risk"><thead><tr><th>Joma</th><th>Statuss</th><th>Piezīme</th></tr></thead><tbody>`,
  );
  for (const r of riskRows) {
    lines.push(
      `<tr><td>${escapeHtml(r.kind)}</td><td>${r.statusHtml}</td><td>${escapeHtml(r.note)}</td></tr>`,
    );
  }
  lines.push(`</tbody></table>`);
  if (taSev.length > 0) {
    lines.push(
      `<div class="callout-warn" style="margin-top:12px"><strong>TA / defekti:</strong> ${escapeHtml(taSev.join(" "))}</div>`,
    );
  }
  if (listWarnLong) {
    lines.push(`<div class="callout-warn" style="margin-top:10px">${escapeHtml(listWarnLong)}</div>`);
  }
  lines.push(exportRowHtml());

  /* 6. Identifikācija */
  lines.push(sectionHead(ICO.car, CLIENT_REPORT_PDF_SECTIONS.vehicle));
  lines.push(`<table class="fmt"><tbody>`);
  lines.push(
    `<tr><td>Marka, modelis</td><td><strong>${escapeHtml(makeModel ?? "—")}</strong></td></tr>`,
  );
  lines.push(`<tr><td>Pirmā reģistrācija</td><td>${escapeHtml(firstReg ?? "—")}</td></tr>`);
  const nextTaCell = taValidUntil
    ? escapeHtml(taValidUntil.toLocaleDateString("lv-LV"))
    : "—";
  lines.push(`<tr><td>Nākamā TA / derīga līdz</td><td>${nextTaCell}</td></tr>`);
  lines.push(`<tr><td>VIN</td><td><code>${escapeHtml(p.vin ?? "—")}</code></td></tr>`);
  lines.push(
    `<tr><td>Sludinājuma saite</td><td>${p.listingUrl ? escapeHtml(p.listingUrl) : '<span class="na">—</span>'}</td></tr>`,
  );
  lines.push(`<tr><td>Pasūtījums</td><td><code>${escapeHtml(p.sessionId)}</code> · ${escapeHtml(p.paymentStatus)} · ${escapeHtml(money)}</td></tr>`);
  lines.push(`</tbody></table>`);
  lines.push(buildTaValidityBanner(taValidUntil));
  lines.push(
    `<p class="hint hint-tight" style="margin-top:12px">Pilnas reģistra, OCTA, tirgus un „Citi avoti” piezīmes — <strong>§2</strong>. Izvilkums par iepriekšējām TA rindām — turpat CSDD laukā.</p>`,
  );
  lines.push(exportRowHtml());

  /* 7. Sludinājums */
  lines.push(sectionHead(ICO.tag, CLIENT_REPORT_PDF_SECTIONS.listing));
  lines.push("<ul class=\"ta-list\">");
  if (priceAd) {
    lines.push(`<li><strong>Cena sludinājumā:</strong> ${escapeHtml(priceAd)}</li>`);
  }
  if (minListingKm != null) {
    let mileLine = `<strong>Sludinājuma nobraukums:</strong> ${minListingKm.toLocaleString("lv-LV")} km`;
    if (listDelta && listDelta.deltaKm >= 400) {
      mileLine += ` <span class="listing-warn-amber" style="display:inline;padding:2px 6px;border-radius:4px"><span class="listing-delta">−${escapeHtml(listDelta.deltaLabel)} pret augstāko CSDD / reģistra un „Citi avoti” fiksāciju</span></span>`;
    }
    lines.push(`<li>${mileLine}</li>`);
  }
  if (!priceAd && minListingKm == null) {
    lines.push("<li><span class=\"na\">Cenu un nobraukumu neizdevās automātiski izdalīt — skatīt piezīmes zemāk.</span></li>");
  }
  lines.push("</ul>");
  lines.push(
    `<p class="hint hint-tight">Pilnas tirgus piezīmes un sludinājuma teksts — <strong>§2</strong> (Tirgus un sludinājuma piezīmes).</p>`,
  );

  /* 8. Apskates plāns (admina lauks) */
  lines.push(sectionHead(ICO.clip, CLIENT_REPORT_PDF_SECTIONS.inspectionPlan));
  lines.push(
    `<p class="hint hint-tight" style="margin-bottom:10px">Klātienes apskatei — īss eksperta checklist.</p>`,
  );
  if (p.apskatesPlāns.trim()) {
    lines.push(`<pre class="block inspection-plan-block">${escapeHtml(p.apskatesPlāns.trim())}</pre>`);
  } else {
    lines.push('<p class="na">Nav aizpildīts.</p>');
  }

  /* 9. Eksperts */
  lines.push(sectionHead(ICO.spark, CLIENT_REPORT_PDF_SECTIONS.expert));
  lines.push(`<div class="expert-panel-bottom">`);
  if (expertParts.rating) {
    lines.push(`<div class="expert-verdict"><p class="expert-rating"><strong>Vērtējums:</strong> ${escapeHtml(expertParts.rating)}</p>`);
    if (expertParts.summary) {
      lines.push(`<p class="expert-summary-label"><strong>Kopsavilkums</strong></p>`);
      lines.push(`<div class="expert-body">${escapeHtml(expertParts.summary)}</div>`);
    }
    lines.push(`</div>`);
  } else {
    lines.push(`<p class="expert-title">${escapeHtml(REPORT_PDF_STANDARDS.firstPageExpertBlockTitle)}</p>`);
    lines.push(`<div class="expert-body">${escapeHtml(expertParts.summary || p.iriss.trim())}</div>`);
  }
  lines.push(`</div>`);

  /* Legenda */
  lines.push(`<div class="legend-box">`);
  lines.push(`<h3>${escapeHtml(CLIENT_REPORT_PDF_SECTIONS.sourcesLegend)}</h3>`);
  lines.push(`<div class="legend-inline">`);
  for (const L of REPORT_ODOMETER_SOURCE_LEGEND) {
    const c = TIER_COLOR[L.key];
    lines.push(
      `<span class="legend-item"><span class="legend-dot" style="background:${c}"></span><strong>${escapeHtml(L.label)}</strong></span>`,
    );
  }
  lines.push(`</div>`);
  lines.push(
    `<p class="hint hint-tight" style="margin-top:10px">Pārklājoties, priekšroka <strong>reģistra</strong> datiem.</p>`,
  );
  lines.push(`</div>`);

  if (p.isDemo) {
    lines.push('<p class="hint"><strong>Demonstrācijas dati</strong> — daļa lauku ir parauga rakstura.</p>');
  }

  lines.push('<div class="legal-block">');
  lines.push(`<p><strong>Juridisks pārskats.</strong> ${escapeHtml(CLIENT_REPORT_SERVICE_NOTICE)}</p>`);
  lines.push(`<p style="margin-top:8px">${escapeHtml(CLIENT_REPORT_FOOTER_DISCLAIMER)}</p>`);
  lines.push("</div>");

  lines.push(
    '<p class="no-print" style="margin-top:1rem;display:flex;flex-wrap:wrap;gap:10px;align-items:center">',
  );
  lines.push(
    '<button type="button" style="padding:10px 20px;font-size:13px;border-radius:999px;border:0;background:#0066d6;color:#fff;cursor:pointer;font-weight:600" onclick="window.print()">Drukāt / PDF</button>',
  );
  lines.push(
    '<button type="button" style="padding:10px 20px;font-size:13px;border-radius:999px;border:1px solid #cbd5e1;background:#fff;color:#1e293b;cursor:pointer;font-weight:600" onclick="provinReportExport()">Eksportēt tabulas (CSV)</button>',
  );
  lines.push("</p>");

  lines.push(
    `<div class="report-foot prov-uc">© PROVIN.LV · konsultatīva atskaite · ${escapeHtml(dateFmt.format(new Date()))}</div>`,
  );
  lines.push("</div>");

  const title = `PROVIN ${p.vin ?? p.sessionId}`;
  const html = `<!DOCTYPE html><html lang="lv"><head><meta charset="utf-8"/>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet"/>
<title>${escapeHtml(title)}</title><style>${clientReportPrintCss()}</style></head><body>${lines.join("\n")}${reportFooterScript()}</body></html>`;
  return html;
}
