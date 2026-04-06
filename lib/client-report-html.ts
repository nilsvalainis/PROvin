/**
 * Klienta izvērtējuma atskaite (druka / PDF) — „Ultra” struktūra, brīdinājumu loģika, diagrammas.
 */

import { extractKmCandidates } from "@/lib/admin-workspace-preview-format";
import { type HistoryPdfKind, type PdfPortfolioFileInsight } from "@/lib/admin-portfolio-pdf-analysis";
import { buildHistoryCompareBullets, buildHistoryCompareRows } from "@/lib/history-reports-compare";
import {
  amountToIntRough,
  damageSymbolKindForReport,
  filterClaimRowsForClientReport,
  mergeClaimRowLists,
  parseClaimRowsFromLineBasedText,
  type ClaimTableRow,
} from "@/lib/claim-rows-parse";
import {
  earliestInsuranceYearFromClaims,
  extractRegistryStructuredFields,
  normalizeRoadTaxDisplay,
  parseBrakeAssPairs,
  parseLvRegistryBasics,
  parseTaRating0Snippet,
  parseTaRating2DefectLines,
} from "@/lib/client-report-lv-parse";
import type { ListingMarketSnapshot } from "@/lib/listing-scrape";
import {
  SOURCE_BLOCK_LABELS,
  type ClientManualLtabBlockPdf,
  type ClientManualVendorBlockPdf,
  type CsddFormFields,
  type TirgusFormFields,
} from "@/lib/admin-source-blocks";
import {
  CSDD_FORM_SHORT_FIELDS,
  CSDD_LABEL_COMMENTS,
  CSDD_LABEL_PREV_RATING,
  csddFormHasContent,
  TIRGUS_LABEL_COMMENTS,
  TIRGUS_LABEL_CREATED,
  TIRGUS_LABEL_LISTED,
  TIRGUS_LABEL_PRICE_DROP,
  tirgusFormHasContent,
} from "@/lib/admin-source-blocks";
import {
  buildPdfAdminMirrorClientBlock,
  buildPdfAdminMirrorNotesBlock,
  buildPdfAdminMirrorPaymentBlock,
  buildPdfAdminMirrorVehicleBlock,
  pdfLayoutDraftExtraCss,
  provincLogoSvg,
} from "@/lib/client-report-pdf-layout-draft";
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
  /** Ja aizpildīta, PDF 2.1/2.2 CSDD daļa ar tām pašām etiķetēm kā adminā; tukši lauki netiek drukāti. */
  csddForm?: CsddFormFields | null;
  ltab: string;
  tirgus: string;
  /** Strukturēti „Tirgus dati” — PDF V ar precīzām etiķetēm; tukši lauki netiek drukāti. */
  tirgusForm?: TirgusFormFields | null;
  citi: string;
  iriss: string;
  /** §7 Personalizēts apskates plāns — admina lauks zem IRISS. */
  apskatesPlāns: string;
  /** ss.lv u.c. automātiski nolasīts pirms PDF (admin API). */
  listingMarket?: ListingMarketSnapshot | null;
  /** Manuāli ievadīti trešās puses avoti — tikai ar saturu (tukši bloki netiek drukāti). */
  manualVendorBlocks?: ClientManualVendorBlockPdf[];
  /** LTAB strukturētais bloks — atsevišķs PDF panelis pēc pārējiem manuālajiem avotiem. */
  manualLtabBlock?: ClientManualLtabBlockPdf | null;
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

/** DD.MM.YYYY vai ISO pēc ievades lauka (CSDD eksports, tabulas). */
function parseFlexibleDateFragment(s: string): Date | null {
  const t = s.trim();
  if (!t) return null;
  const lv = parseLvDateFragment(t);
  if (lv) return lv;
  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const y = parseInt(iso[1], 10);
    const mo = parseInt(iso[2], 10) - 1;
    const d = parseInt(iso[3], 10);
    const dt = new Date(y, mo, d);
    return Number.isNaN(dt.getTime()) ? null : dt;
  }
  return null;
}

/** „Atgāzu cietās daļiņas” — vesels skaitlis no ievades (tikai cipari). */
function parseSolidParticleNumeric(raw: string): number | null {
  const digits = raw.replace(/[^\d]/g, "");
  if (!digits) return null;
  const n = parseInt(digits, 10);
  return Number.isNaN(n) ? null : n;
}

function formatCsddSolidParticlesCell(v: string): string {
  const esc = escapeHtml(v);
  const n = parseSolidParticleNumeric(v);
  if (n == null) return esc;
  if (n > 1_000_000) return `<span class="pdf-heat-red">${esc}\u00a0❗</span>`;
  if (n >= 200_000 && n <= 1_000_000) return `<span class="pdf-heat-orange">${esc}\u00a0⚠️</span>`;
  return esc;
}

/** „Nākamās apskates datums”: sarkanā ≤ šodienai; oranžā, ja līdz termiņam ≤ 90 dienas. */
function formatCsddNextInspectionCell(v: string): string {
  const esc = escapeHtml(v);
  const d = parseFlexibleDateFragment(v);
  if (!d) return esc;
  const today = startOfDay(new Date());
  const target = startOfDay(d);
  const t0 = today.getTime();
  const d0 = target.getTime();
  if (d0 <= t0) return `<span class="pdf-heat-red">${esc}</span>`;
  const days = Math.round((d0 - t0) / 86400000);
  if (days <= 90) return `<span class="pdf-heat-orange">${esc}</span>`;
  return esc;
}

/** „Zaudējumu summa” PDF šūna (EUR). */
function formatLossAmountEurCell(raw: string): string {
  const t = raw.trim();
  const esc = escapeHtml(t);
  if (!t) return esc;
  const n = amountToIntRough(raw);
  if (n <= 0) return esc;
  if (n < 2000) return `<span class="pdf-heat-orange">${esc}\u00a0⚠️</span>`;
  if (n > 2001) return `<span class="pdf-heat-red">${esc}\u00a0❗</span>`;
  return esc;
}

/** Nākamās TA datums / derīguma beigas no CSDD, LTAB un citām piezīmēm. */
function findTaValidUntilDate(corpus: string): Date | null {
  const patterns = [
    // Bieži CSDD / PDF: virsraksts „Nākamās apskates datums” + datums tajā pašā vai nākamajā rindā
    /nākam[āa]s?\s+(?:tehnisk[āa]s?\s+)?apskates?\s+datums?\s*[:\-]?\s*(\d{1,2}[./]\d{1,2}[./]\d{2,4}|\d{4}-\d{2}-\d{2})/i,
    /nākam[āa]\s+tehnisk[āa]s?\s+apskates?\s+datums?\s*[:\-]?\s*(\d{1,2}[./]\d{1,2}[./]\d{2,4}|\d{4}-\d{2}-\d{2})/i,
    /tehnisk[āa]s?\s+apskates?\s+der[īi]gums?\s*[:\-]?\s*(\d{1,2}[./]\d{1,2}[./]\d{2,4}|\d{4}-\d{2}-\d{2})/i,
    /nākam[āa]\s+(?:tehnisk[āa]?\s+)?apskate\s*[:\-]?\s*(\d{1,2}[./]\d{1,2}[./]\d{2,4}|\d{4}-\d{2}-\d{2})/i,
    /nākam[āa]\s+TA\s*[:\-]?\s*(\d{1,2}[./]\d{1,2}[./]\d{2,4}|\d{4}-\d{2}-\d{2})/i,
    /nākam[āa]\s+pārbaude\s*[:\-]?\s*(\d{1,2}[./]\d{1,2}[./]\d{2,4}|\d{4}-\d{2}-\d{2})/i,
    /der[īi]g[āa]\s+l[īi]dz\s*[:\-]?\s*(\d{1,2}[./]\d{1,2}[./]\d{2,4}|\d{4}-\d{2}-\d{2})/i,
    /TA\s+der[īi]g[āa]\s+l[īi]dz\s*[:\-]?\s*(\d{1,2}[./]\d{1,2}[./]\d{2,4}|\d{4}-\d{2}-\d{2})/i,
    /tehnisk[āa]s?\s+apskates?\s+der[īi]g[āa]\s+l[īi]dz\s*[:\-]?\s*(\d{1,2}[./]\d{1,2}[./]\d{2,4}|\d{4}-\d{2}-\d{2})/i,
    /apskate\s+sp[ēe]k[āa]\s+l[īi]dz\s*[:\-]?\s*(\d{1,2}[./]\d{1,2}[./]\d{2,4}|\d{4}-\d{2}-\d{2})/i,
    /sp[ēe]k[āa]\s+l[īi]dz\s*[:\-]?\s*(\d{1,2}[./]\d{1,2}[./]\d{2,4}|\d{4}-\d{2}-\d{2})/i,
  ];
  for (const re of patterns) {
    const m = corpus.match(re);
    if (m?.[1]) {
      const d = parseFlexibleDateFragment(m[1]);
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
      <p class="ta-status-text">Dokumentos derīgums bieži norādīts pie „Nākamās apskates datums”, „Tehniskās apskates derīgums” u.tml. Automātika meklē „nākamā apskate”, „nākamās apskates datums”, „derīga līdz”, „TA derīga līdz” un līdzīgus pierakstus — šeit datums nav ticis atpazīts. Pārbaudiet zemāk esošās piezīmes un CSDD izrakstu.</p>
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
  /** Sludinājuma lauka nobraukums (laika līnijai / 🚩). */
  fromListing?: boolean;
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

function appendListingOdometerPoints(
  points: OdometerChartPoint[],
  tirgus: string,
  listingMarket: ListingMarketSnapshot | null | undefined,
): void {
  const kms = extractKmCandidates(tirgus);
  if (kms.length === 0) return;
  const raw =
    listingMarket?.ok && listingMarket.postedDateRaw?.trim()
      ? listingMarket.postedDateRaw.trim()
      : new Date().toISOString().slice(0, 10);
  const dateIso =
    raw.match(/\d{4}-\d{2}-\d{2}/)?.[0] ??
    raw.match(/\d{1,2}[./]\d{1,2}[./]\d{2,4}/)?.[0] ??
    new Date().toISOString().slice(0, 10);
  for (const km of kms) {
    if (km < 500) continue;
    if (points.some((p) => p.fromListing && Math.abs(p.km - km) < 120)) continue;
    points.push({
      km,
      label: `Sludinājums · ${dateIso}`,
      tier: "other",
      emoji: TIER_EMOJI.other,
      plotIndex: 0,
      fromListing: true,
    });
  }
}

function reindexOdometerPoints(points: OdometerChartPoint[]): void {
  points.sort((a, b) => a.km - b.km);
  points.forEach((p, i) => {
    p.plotIndex = i + 1;
  });
}

/** Tabulai: pirmais datums no etiķetes (ISO vai LV); ja nav — „—”. */
function dateOnlyFromOdoLabel(label: string): string {
  const iso = label.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (iso) return iso[1]!;
  const dm = label.match(/\d{1,2}[./]\d{1,2}[./]\d{2,4}/);
  if (dm) return dm[0]!;
  const my = label.match(/\b(\d{1,2})[./](\d{4})\b/);
  if (my) return `${my[1].padStart(2, "0")}.${my[2]}.`;
  return "—";
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

function odoTierDotSvg(tier: KmTier): string {
  const col = TIER_COLOR[tier];
  return `<svg class="odo-dot-svg" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><circle cx="6" cy="6" r="5" fill="${col}" stroke="#fff" stroke-width="1"/></svg>`;
}

function buildOdometerDotsOnlyCell(pts: OdometerChartPoint[]): string {
  const parts = pts.map((p) => {
    const hint = escapeHtml(odoSourceTitle(p.label));
    return `<span class="odo-dot-wrap" title="${hint}" aria-label="${hint}">${odoTierDotSvg(p.tier)}</span>`;
  });
  return `<td class="odo-dots-cell">${parts.join("")}</td>`;
}

function buildOdometerMergedTableRows(merged: OdoMergedRow[], listingMismatch: boolean): string {
  return merged
    .map((row) => {
      const nums = row.pts.map((p) => p.plotIndex).sort((a, b) => a - b);
      const idx = nums.join("+");
      const citiTouch = row.pts.some((p) => p.fromCiti);
      const trCls = citiTouch ? ' class="odo-row-citi"' : "";
      const listFlag = listingMismatch && row.pts.some((p) => p.fromListing);
      const kmHtml = `<strong>${row.km.toLocaleString("lv-LV")} km</strong>${listFlag ? '<span class="odo-rollback-flag"> 🚩</span>' : ""}`;
      return `<tr${trCls}><td class="tabular odo-idx">${escapeHtml(idx)}</td>${buildOdometerDotsOnlyCell(row.pts)}<td class="tabular">${kmHtml}</td><td class="tabular">${escapeHtml(row.dateStr)}</td></tr>`;
    })
    .join("\n");
}

function timeFromDateStr(dateStr: string): number {
  if (!dateStr || dateStr === "—") return Number.MAX_SAFE_INTEGER - 86400000 * 365 * 40;
  const iso = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const t = new Date(+iso[1], +iso[2] - 1, +iso[3]).getTime();
    return Number.isNaN(t) ? Number.MAX_SAFE_INTEGER : t;
  }
  const my = dateStr.match(/^(\d{1,2})\.(\d{4})\.?$/);
  if (my) {
    const t = new Date(parseInt(my[2], 10), parseInt(my[1], 10) - 1, 15).getTime();
    return Number.isNaN(t) ? Number.MAX_SAFE_INTEGER : t;
  }
  const m = dateStr.match(/^(\d{1,2})[./](\d{1,2})[./](\d{2,4})$/);
  if (m) {
    let y = parseInt(m[3], 10);
    if (y < 100) y += 2000;
    const t = new Date(y, parseInt(m[2], 10) - 1, parseInt(m[1], 10)).getTime();
    return Number.isNaN(t) ? Number.MAX_SAFE_INTEGER : t;
  }
  return Number.MAX_SAFE_INTEGER - 86400000 * 365 * 20;
}

function formatMonthYearLv(dateStr: string): string {
  if (!dateStr || dateStr === "—") return "—";
  const iso = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return `${iso[2]}.${iso[1]}.`;
  const myShort = dateStr.match(/^(\d{1,2})\.(\d{4})\.?$/);
  if (myShort) return `${myShort[1].padStart(2, "0")}.${myShort[2]}.`;
  const m = dateStr.match(/^(\d{1,2})[./](\d{1,2})[./](\d{2,4})$/);
  if (m) {
    let y = m[3];
    if (y.length === 2) y = `${parseInt(y, 10) < 50 ? "20" : "19"}${y}`;
    return `${m[2].padStart(2, "0")}.${y}.`;
  }
  return dateStr;
}

type ChronoOdoGroup = { sortT: number; dateStr: string; km: number; pts: OdometerChartPoint[] };

const FAR_FUTURE = Number.MAX_SAFE_INTEGER - 86400000 * 365 * 15;

function hasUsableOdoDate(label: string): boolean {
  const ds = dateOnlyFromOdoLabel(label);
  if (ds === "—") return false;
  return timeFromDateStr(ds) < FAR_FUTURE;
}

/** Datētiem punktiem — laiks no etiķetes; bez datuma — interpolācija starp kaimiņiem pēc km. */
function assignChronologicalSortTimes(pts: OdometerChartPoint[]): Map<OdometerChartPoint, number> {
  const map = new Map<OdometerChartPoint, number>();
  const dated: { p: OdometerChartPoint; t: number; km: number }[] = [];
  const undated: OdometerChartPoint[] = [];
  for (const p of pts) {
    const ds = dateOnlyFromOdoLabel(p.label);
    if (hasUsableOdoDate(p.label)) {
      const t = timeFromDateStr(ds);
      map.set(p, t);
      dated.push({ p, t, km: p.km });
    } else {
      undated.push(p);
    }
  }
  dated.sort((a, b) => a.t - b.t || a.km - b.km);
  if (dated.length === 0) {
    const sorted = [...undated].sort((a, b) => a.km - b.km);
    let t = Date.now() - 86400000 * 365 * 25;
    for (const p of sorted) {
      map.set(p, t);
      t += 86400000;
    }
    return map;
  }
  const minKm = Math.min(...dated.map((d) => d.km));
  const maxKm = Math.max(...dated.map((d) => d.km));
  const minT = dated[0]!.t;
  const maxT = dated[dated.length - 1]!.t;
  for (const p of undated) {
    const below = [...dated].filter((d) => d.km <= p.km).sort((a, b) => b.km - a.km)[0];
    const above = [...dated].filter((d) => d.km >= p.km).sort((a, b) => a.km - b.km)[0];
    let t: number;
    if (!below && !above) t = minT;
    else if (!below) t = minT - 86400000 * (1 + Math.max(0, minKm - p.km) / 40000);
    else if (!above) t = maxT + 86400000 * (1 + Math.max(0, p.km - maxKm) / 40000);
    else if (Math.abs(below.km - above.km) < 1) t = (below.t + above.t) / 2;
    else
      t = below.t + ((p.km - below.km) / Math.max(above.km - below.km, 1)) * (above.t - below.t);
    map.set(p, t);
  }
  return map;
}

function groupOdometerPointsChronologically(pts: OdometerChartPoint[]): ChronoOdoGroup[] {
  const timeMap = assignChronologicalSortTimes(pts);
  const sortedPts = [...pts].sort((a, b) => {
    const ta = timeMap.get(a)!;
    const tb = timeMap.get(b)!;
    if (ta !== tb) return ta - tb;
    if (!!a.fromListing !== !!b.fromListing) return a.fromListing ? 1 : -1;
    return a.km - b.km;
  });
  const groups: ChronoOdoGroup[] = [];
  for (const p of sortedPts) {
    const dateStr = dateOnlyFromOdoLabel(p.label);
    const sortT = timeMap.get(p)!;
    let merged = false;
    for (const g of groups) {
      if (g.dateStr !== dateStr) continue;
      if (Math.abs(g.km - p.km) > 95) continue;
      const n = g.pts.length;
      g.km = Math.round((g.km * n + p.km) / (n + 1));
      g.pts.push(p);
      g.sortT = Math.min(g.sortT, sortT);
      merged = true;
      break;
    }
    if (!merged) groups.push({ sortT, dateStr, km: p.km, pts: [p] });
  }
  groups.sort((a, b) => a.sortT - b.sortT || a.km - b.km);
  return groups;
}

function buildOdometerChronoTimelineHtml(pts: OdometerChartPoint[], listingMismatch: boolean): string {
  const groups = groupOdometerPointsChronologically(pts);
  if (groups.length === 0) return "";
  const rows: string[] = [];
  for (const g of groups) {
    const hasListing = g.pts.some((p) => p.fromListing);
    const dots = g.pts
      .map((p) => `<span class="odo-dot-wrap" title="${escapeHtml(odoSourceTitle(p.label))}">${odoTierDotSvg(p.tier)}</span>`)
      .join("");
    const flag =
      listingMismatch && hasListing ? '<span class="odo-rollback-flag" aria-hidden="true"> 🚩</span>' : "";
    rows.push(
      `<div class="odo-timeline-row" role="listitem"><span class="odo-tl-date">${escapeHtml(formatMonthYearLv(g.dateStr))}</span><span class="odo-tl-km">${g.km.toLocaleString("lv-LV")} km</span><span class="odo-tl-dots">${dots}${flag}</span></div>`,
    );
  }
  return `<div class="odo-timeline" role="list">${rows.join("")}</div>`;
}

type QuickPanelFlags = { legalWarn: boolean; mileageCrit: boolean; damageHeavy: boolean; damageWarn: boolean };

function computeQuickPanelFlags(
  csdd: string,
  tirgus: string,
  ltab: string,
  citi: string,
  insRows: ClaimTableRow[],
  pdfInsights: PdfPortfolioFileInsight[],
): QuickPanelFlags {
  const corpus = `${csdd}\n${ltab}\n${citi}`.toLowerCase();
  const stolen = /zagts|mekl[ēe]šan[āa]|nozagt|asl[īi]\s*zag|wanted|stolen|theft|noziedz/i.test(corpus);
  const mileageCrit = listingKmStrictlyBelowHistory(csdd, tirgus, citi, pdfInsights);
  const insCorpus = `${ltab}\n${citi}`;
  const heavy =
    insRows.some((r) => r.emphasize) ||
    /total\s*loss|piln[īi]g[aā]\s*boj|7\s+fiks/i.test(insCorpus);
  const nIns = insRows.length;
  const accCount =
    nIns ||
    (() => {
      const m = insCorpus.match(/(\d+)\s*(?:fiks[ēe]ti\s*)?(?:gad[īi]jum|negad[īi]jum)/i);
      return m ? parseInt(m[1], 10) : 0;
    })();
  const damageWarn =
    !heavy && (nIns > 0 || accCount >= 1 || /negad[īi]jum|av[āa]rija|boj[āa]j/i.test(insCorpus));
  return { legalWarn: stolen, mileageCrit, damageHeavy: heavy, damageWarn };
}

function buildQuickControlPanelHtml(
  p: ClientReportPayload,
  flags: QuickPanelFlags,
  opts?: { includeNotesLine?: boolean },
): string {
  const includeNotes = opts?.includeNotesLine !== false;
  const contact = [p.customerName?.trim(), p.customerPhone?.trim()].filter(Boolean).join(" · ") || "—";
  const legalLine = flags.legalWarn ? "⚠️ riska zona" : "✅ tīrs";
  const mileLine = flags.mileageCrit ? "🚩 Neatbilstība" : "✅ salīdzināms";
  let dmgLine = "✅ nav izcelts";
  if (flags.damageHeavy) dmgLine = "💥 smagi / total loss";
  else if (flags.damageWarn) dmgLine = "⚠️ ir ieraksti";
  const notesLine = includeNotes
    ? `<p class="quick-panel-meta"><strong>ziņojums:</strong> ${escapeHtml(p.notes?.trim() ? p.notes : "—")}</p>`
    : "";
  return `<div class="quick-panel" role="region">
    ${sectionHead(ICO.user, CLIENT_REPORT_PDF_SECTIONS.quickPanel)}
    ${notesLine}
    <p class="quick-panel-meta"><strong>vin:</strong> <code>${escapeHtml(p.vin ?? "—")}</code> · <strong>kontakts:</strong> ${escapeHtml(contact)}</p>
    <div class="quick-panel-grid">
      <div class="quick-ind"><span class="quick-ind-k">juridiskais</span><span class="quick-ind-v">${legalLine}</span></div>
      <div class="quick-ind"><span class="quick-ind-k">nobraukuma ticamība</span><span class="quick-ind-v">${mileLine}</span></div>
      <div class="quick-ind"><span class="quick-ind-k">bojājumu vēsture</span><span class="quick-ind-v">${dmgLine}</span></div>
    </div>
  </div>`;
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

/** Admin secība: Tirgus dati atsevišķi pirms pārējiem manuālajiem avotiem. */
function buildTirgusListingSectionHtml(
  p: ClientReportPayload,
  pdfInsights: PdfPortfolioFileInsight[],
  ctx: {
    priceAd: string | null;
    minListingKm: number | null;
    listDelta: ReturnType<typeof listingKmDeltaInfo> | null;
    listWarnLong: string | null;
    scrapeBlock: string;
  },
): string {
  const hasManualTirgusForm = tirgusFormHasContent(p.tirgusForm);
  const hasListingSection =
    Boolean(ctx.priceAd) ||
    ctx.minListingKm != null ||
    Boolean(p.listingUrl?.trim()) ||
    Boolean(ctx.scrapeBlock) ||
    hasManualTirgusForm ||
    Boolean(p.tirgus.trim());
  if (!hasListingSection) return "";

  const parts: string[] = [];
  parts.push(`<div class="tirgus-mirror-panel" role="region">`);
  parts.push(sectionHead(ICO.tag, "Tirgus dati"));
  parts.push('<ul class="ta-list">');
  if (ctx.priceAd) {
    parts.push(`<li><strong>cena (no piezīmēm):</strong> ${escapeHtml(ctx.priceAd)}</li>`);
  }
  if (ctx.minListingKm != null) {
    let mileLine = `<strong>sludinājuma nobraukums:</strong> ${ctx.minListingKm.toLocaleString("lv-LV")} km`;
    if (ctx.listDelta && listingKmStrictlyBelowHistory(p.csdd, p.tirgus, p.citi, pdfInsights)) {
      mileLine += ` <span class="listing-warn-amber" style="display:inline;padding:2px 6px;border-radius:4px"><span class="listing-delta">🚩 −${escapeHtml(ctx.listDelta.deltaLabel)} pret augstāko vēsturisko fiksāciju</span></span>`;
    }
    parts.push(`<li>${mileLine}</li>`);
  }
  if (p.listingUrl?.trim()) {
    parts.push(
      `<li><strong>saite:</strong> <span style="word-break:break-all">${escapeHtml(p.listingUrl)}</span></li>`,
    );
  }
  parts.push("</ul>");
  if (ctx.listWarnLong) {
    parts.push(`<div class="listing-odo-alert">${escapeHtml(ctx.listWarnLong)}</div>`);
  }
  if (ctx.scrapeBlock) parts.push(ctx.scrapeBlock);
  if (hasManualTirgusForm && p.tirgusForm) {
    parts.push(buildManualTirgusStructuredHtml(p.tirgusForm));
  } else if (p.tirgus.trim()) {
    parts.push(
      `<h4 class="pdf-sub2 lv-tirgus-manual-h">papildu tirgus piezīmes</h4><pre class="lv-source-pre">${escapeHtml(p.tirgus.trim())}</pre>`,
    );
  }
  parts.push("</div>");
  return parts.join("\n");
}

function buildLvStructuredSourcesHtml(
  p: ClientReportPayload,
  taValidUntil: Date | null,
  insRows: ClaimTableRow[],
  makeModel: string | null,
  layoutOpts?: { mainHeading?: string; omitIntroLead?: boolean },
): string {
  const hasStructuredCsdd = Boolean(p.csddForm && csddFormHasContent(p.csddForm));
  const hasLegacyCsddText = p.csdd.trim().length > 0;
  const hasCsdd = hasStructuredCsdd || hasLegacyCsddText;
  const lvRows = insRows.filter((r) => r.iso === "LV");
  const insDates = insRows.map((r) => r.date);
  const insFromYEarly = earliestInsuranceYearFromClaims(insDates);
  const hasOctaContent = lvRows.length > 0 || Boolean(insFromYEarly);
  if (!hasCsdd && !hasOctaContent) return "";

  const insFromY = insFromYEarly;

  const parts: string[] = [];
  const mainHeading = layoutOpts?.mainHeading ?? CLIENT_REPORT_PDF_SECTIONS.lvSources;
  parts.push(`<div class="lv-sources-panel pdf-v1-after-admin" role="region">`);
  parts.push(sectionHead(ICO.clip, mainHeading));
  if (!layoutOpts?.omitIntroLead) {
    parts.push(
      `<p class="lv-sources-lead">Strukturēti dati <strong>2.1–2.3</strong>. Tirgus — atsevišķā sadaļā zemāk.</p>`,
    );
  }

  if (hasCsdd) {
    if (hasStructuredCsdd && p.csddForm) {
      const f = p.csddForm;
      parts.push(`<h3 class="pdf-sub">${escapeHtml(CLIENT_REPORT_PDF_SECTIONS.lvRegistry)}</h3>`);
      const regRows: string[] = [];
      for (const { key, label } of CSDD_FORM_SHORT_FIELDS) {
        const v = f[key].trim();
        if (!v) continue;
        let cellHtml: string;
        if (key === "solidParticlesCm3") cellHtml = formatCsddSolidParticlesCell(v);
        else if (key === "nextInspectionDate") cellHtml = formatCsddNextInspectionCell(v);
        else cellHtml = escapeHtml(v);
        regRows.push(`<tr><td>${escapeHtml(label)}</td><td>${cellHtml}</td></tr>`);
      }
      if (regRows.length > 0) {
        parts.push(`<table class="fmt lv-reg-table bordered"><tbody>${regRows.join("\n    ")}</tbody></table>`);
      }
      if (f.prevInspectionRating.trim()) {
        parts.push(`<p class="pdf-sub2" style="margin-top:10px">${escapeHtml(CSDD_LABEL_PREV_RATING)}</p>`);
        parts.push(`<pre class="block manual-vendor-comments">${escapeHtml(f.prevInspectionRating.trim())}</pre>`);
      }
      if (f.comments.trim()) {
        parts.push(`<p class="pdf-sub2" style="margin-top:10px">${escapeHtml(CSDD_LABEL_COMMENTS)}</p>`);
        parts.push(`<pre class="block manual-vendor-comments">${escapeHtml(f.comments.trim())}</pre>`);
      }
      parts.push(`<h3 class="pdf-sub">${escapeHtml(CLIENT_REPORT_PDF_SECTIONS.lvTa)}</h3>`);
      parts.push(buildTaValidityBanner(taValidUntil));
    } else if (hasLegacyCsddText) {
      const basics = parseLvRegistryBasics(p.csdd);
      const structured = extractRegistryStructuredFields(p.csdd);
      const mm =
        structured.makeModel?.trim() || basics.markModel || makeModel || "—";
      const regNr = structured.plateNumber?.trim() || basics.regNr || "—";
      const firstReg =
        structured.firstReg?.trim() || basics.firstReg || extractFirstRegistration(p.csdd) || "—";
      const euro = structured.euroStandard?.trim() || basics.euro || "—";
      const power =
        structured.enginePower?.trim() ||
        (basics.powerKw ? `${basics.powerKw} kW` : "—");
      const grossMass =
        structured.grossWeight?.trim() ||
        (basics.grossMassKg ? `${basics.grossMassKg} kg` : "—");
      const curbMass =
        structured.curbWeight?.trim() ||
        (basics.curbWeightKg ? `${basics.curbWeightKg} kg` : "—");
      const fuel = structured.fuelType?.trim() || "—";
      const smokeRaw = structured.smokeOpacity?.trim() || basics.smokeOpacity?.trim() || "";
      const smoke = smokeRaw || "—";
      const regStatus = structured.status?.trim() || "";
      const roadRaw =
        structured.roadTax?.trim() ||
        (basics.roadTaxEur ? `${basics.roadTaxEur} EUR` : "");
      const road = roadRaw ? normalizeRoadTaxDisplay(roadRaw) : "—";

      const taSoon = taValidUntil != null && classifyTaValidity(taValidUntil) === "soon";
      const taCellHtml = taValidUntil
        ? escapeHtml(taValidUntil.toLocaleDateString("lv-LV"))
        : "—";

      const ta0 = parseTaRating0Snippet(p.csdd);
      const ta2 = parseTaRating2DefectLines(p.csdd);
      const brakes = parseBrakeAssPairs(p.csdd);

      parts.push(`<h3 class="pdf-sub">${escapeHtml(CLIENT_REPORT_PDF_SECTIONS.lvRegistry)}</h3>`);
      const regRows: string[] = [];
      regRows.push(
        `<tr><td>marka / modelis</td><td><strong>${escapeHtml(mm)}</strong></td></tr>`,
        `<tr><td>reģ. nr.</td><td>${escapeHtml(regNr)}</td></tr>`,
      );
      if (regStatus)
        regRows.push(`<tr><td>statuss</td><td>${escapeHtml(regStatus)}</td></tr>`);
      regRows.push(
        `<tr><td>pirmā reģistrācija</td><td>${escapeHtml(firstReg)}</td></tr>`,
        `<tr><td>euro / emisijas</td><td>${escapeHtml(euro)}</td></tr>`,
        `<tr><td>jauda</td><td>${escapeHtml(power)}</td></tr>`,
        `<tr><td>pilnā masa</td><td>${escapeHtml(grossMass)}</td></tr>`,
        `<tr><td>pašmasa</td><td>${escapeHtml(curbMass)}</td></tr>`,
        `<tr><td>degvielas veids</td><td>${escapeHtml(fuel)}</td></tr>`,
      );
      if (smokeRaw) regRows.push(`<tr><td>dūmainības (m⁻¹)</td><td>${escapeHtml(smoke)}</td></tr>`);
      regRows.push(
        `<tr><td>nākamā apskate</td><td class="${taSoon ? "td-warn" : ""}">${taCellHtml}</td></tr>`,
        `<tr><td>ekspluatācijas / ceļa nodoklis (gadā)</td><td>${escapeHtml(road)}</td></tr>`,
      );
      parts.push(`<table class="fmt lv-reg-table bordered"><tbody>${regRows.join("\n    ")}</tbody></table>`);

      parts.push(`<h3 class="pdf-sub">${escapeHtml(CLIENT_REPORT_PDF_SECTIONS.lvTa)}</h3>`);
      parts.push(buildTaValidityBanner(taValidUntil));
      if (ta0) parts.push(`<p class="lv-ta-snippet">${escapeHtml(ta0)}</p>`);
      if (ta2.length > 0) {
        parts.push(
          `<p class="pdf-sub2" style="margin-top:8px">pamatpārbaude (vērtējums 2) — kodi un trūkumi</p><ul class="lv-ta2-list">`,
        );
        for (const line of ta2) {
          parts.push(`<li>${escapeHtml(line)}</li>`);
        }
        parts.push(`</ul>`);
      }
      if (brakes) {
        parts.push(
          `<table class="fmt bordered lv-brake-table"><thead><tr><th>Ass 1</th><th>Ass 2</th></tr></thead><tbody><tr><td>${escapeHtml(brakes.ass1)}</td><td>${escapeHtml(brakes.ass2)}</td></tr></tbody></table>`,
        );
      }
    }
  }

  if (hasOctaContent) {
    parts.push(`<h3 class="pdf-sub">${escapeHtml(CLIENT_REPORT_PDF_SECTIONS.lvOcta)}</h3>`);
    if (insFromY) {
      parts.push(
        `<p class="lv-octa-line">apdrošināšanas konteksts: agrākie strukturētie ieraksti no <strong>${escapeHtml(insFromY)}</strong>. g.</p>`,
      );
    }
    if (lvRows.length > 0) {
      parts.push(`<p class="pdf-sub2">negadījumi LV</p>`);
      parts.push(
        `<table class="fmt ins ins-compact bordered"><thead><tr><th>datums</th><th>bojājums</th><th class="tabular">Zaudējumu summa</th><th class="flag-cell">valsts</th></tr></thead><tbody>`,
      );
      for (const r of lvRows) {
        const rowClass = r.emphasize ? ' class="em"' : "";
        const kind = damageSymbolKindForReport(r);
        parts.push(
          `<tr${rowClass}><td>${escapeHtml(r.date)}</td><td>${escapeHtml(kind)}</td><td class="tabular">${formatLossAmountEurCell(r.amount)}</td><td class="flag-cell">${flagEmoji(r.iso)}</td></tr>`,
        );
      }
      parts.push(`</tbody></table>`);
    }
  }

  parts.push(`</div>`);
  return parts.join("\n");
}

function buildManualTirgusStructuredHtml(f: TirgusFormFields): string {
  const rows: string[] = [];
  if (f.listedForSale.trim()) {
    rows.push(
      `<tr><td>${escapeHtml(TIRGUS_LABEL_LISTED)}</td><td>${escapeHtml(f.listedForSale.trim())}</td></tr>`,
    );
  }
  if (f.listingCreated.trim()) {
    rows.push(
      `<tr><td>${escapeHtml(TIRGUS_LABEL_CREATED)}</td><td>${escapeHtml(f.listingCreated.trim())}</td></tr>`,
    );
  }
  if (f.priceDrop.trim()) {
    rows.push(
      `<tr><td>${escapeHtml(TIRGUS_LABEL_PRICE_DROP)}</td><td>${escapeHtml(f.priceDrop.trim())}</td></tr>`,
    );
  }
  const parts: string[] = [];
  if (rows.length > 0) {
    parts.push(`<table class="fmt lv-reg-table bordered"><tbody>${rows.join("\n    ")}</tbody></table>`);
  }
  if (f.comments.trim()) {
    parts.push(`<p class="pdf-sub2" style="margin-top:10px">${escapeHtml(TIRGUS_LABEL_COMMENTS)}</p>`);
    parts.push(`<pre class="block manual-vendor-comments">${escapeHtml(f.comments.trim())}</pre>`);
  }
  return parts.join("\n");
}

/** Katrs starptautiskais avots — atsevišķs panelis (.pdf-v1-panel), secība kā admin režģī. */
function pdfIconForVendorTitle(title: string): string {
  if (title === SOURCE_BLOCK_LABELS.autodna) return ICO.layers;
  if (title === SOURCE_BLOCK_LABELS.carvertical) return ICO.chart;
  if (title === SOURCE_BLOCK_LABELS.auto_records) return ICO.spark;
  return ICO.layers;
}

function buildManualVendorSinglePanelHtml(b: ClientManualVendorBlockPdf): string {
  const hasTable = b.rows.length > 0;
  const hasComments = b.comments.trim().length > 0;
  if (!hasTable && !hasComments) return "";
  const parts: string[] = [];
  const icon = pdfIconForVendorTitle(b.title);
  parts.push(`<div class="pdf-v1-panel pdf-v1-panel--clean pdf-source-mirror-panel" role="region">`);
  parts.push(
    `<div class="pdf-v1-panel-head"><span class="pdf-v1-ico" aria-hidden="true">${icon}</span><p class="pdf-v1-panel-title pdf-v1-panel-title--src">${escapeHtml(b.title)}</p></div>`,
  );
  if (hasTable) {
    const amountTh = escapeHtml(b.amountColumnLabel ?? "Zaudējumu summa");
    parts.push(
      `<table class="fmt bordered ins-compact"><thead><tr><th>Gads / Datums</th><th class="tabular">KM</th><th class="tabular">${amountTh}</th></tr></thead><tbody>`,
    );
    for (const r of b.rows) {
      parts.push(
        `<tr><td>${escapeHtml(r.date)}</td><td class="tabular">${escapeHtml(r.km)}</td><td class="tabular">${formatLossAmountEurCell(r.amount)}</td></tr>`,
      );
    }
    parts.push(`</tbody></table>`);
  }
  if (hasComments) {
    parts.push(`<pre class="block manual-vendor-comments">${escapeHtml(b.comments.trim())}</pre>`);
  }
  parts.push(`</div>`);
  return parts.join("\n");
}

function buildManualLtabPanelHtml(b: ClientManualLtabBlockPdf | null | undefined): string {
  if (!b) return "";
  const hasTable = b.rows.length > 0;
  const hasComments = b.comments.trim().length > 0;
  if (!hasTable && !hasComments) return "";
  const parts: string[] = [];
  parts.push(`<div class="pdf-v1-panel pdf-v1-panel--clean pdf-source-mirror-panel" role="region">`);
  parts.push(
    `<div class="pdf-v1-panel-head"><span class="pdf-v1-ico" aria-hidden="true">${ICO.shield}</span><p class="pdf-v1-panel-title pdf-v1-panel-title--src">${escapeHtml(SOURCE_BLOCK_LABELS.ltab)}</p></div>`,
  );
  if (hasTable) {
    parts.push(
      `<table class="fmt bordered ins-compact"><thead><tr><th>Negadījumu skaits</th><th class="tabular">CSNg datums</th><th class="tabular">Zaudējumu summa</th></tr></thead><tbody>`,
    );
    for (const r of b.rows) {
      parts.push(
        `<tr><td>${escapeHtml(r.incidentNo)}</td><td class="tabular">${escapeHtml(r.csngDate)}</td><td class="tabular">${formatLossAmountEurCell(r.lossAmount)}</td></tr>`,
      );
    }
    parts.push(`</tbody></table>`);
  }
  if (hasComments) {
    parts.push(`<pre class="block manual-vendor-comments">${escapeHtml(b.comments.trim())}</pre>`);
  }
  parts.push(`</div>`);
  return parts.join("\n");
}

function buildInternationalManualSourcePanelsHtml(
  vendorBlocks: ClientManualVendorBlockPdf[] | undefined,
  ltabBlock: ClientManualLtabBlockPdf | null | undefined,
): string {
  const chunks: string[] = [];
  for (const b of vendorBlocks ?? []) {
    const html = buildManualVendorSinglePanelHtml(b);
    if (html) chunks.push(html);
  }
  const ltabHtml = buildManualLtabPanelHtml(ltabBlock);
  if (ltabHtml) chunks.push(ltabHtml);
  return chunks.join("\n");
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
    <div class="chart-card chart-card--clean">
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

function officialKmPool(csdd: string, citi: string, insights: PdfPortfolioFileInsight[]): number[] {
  const fromPdf = insights.flatMap((i) => i.kmSamples.map((s) => s.km));
  return [...extractKmCandidates(csdd), ...extractKmCandidates(citi), ...fromPdf];
}

function maxHistoricalKmFromSources(
  csdd: string,
  citi: string,
  insights: PdfPortfolioFileInsight[],
): number | null {
  const vals = officialKmPool(csdd, citi, insights);
  if (vals.length === 0) return null;
  return Math.max(...vals);
}

/** Sludinājuma mazākais km < jebkura vēsturiskā ieraksta maksimums (reģistrs, PDF, citi). */
function listingKmStrictlyBelowHistory(
  csdd: string,
  tirgus: string,
  citi: string,
  insights: PdfPortfolioFileInsight[],
): boolean {
  const listing = extractKmCandidates(tirgus);
  if (listing.length === 0) return false;
  const maxH = maxHistoricalKmFromSources(csdd, citi, insights);
  if (maxH == null) return false;
  return Math.min(...listing) < maxH;
}

/** Nobraukuma starpība sludinājumam pret vēsturisko maksimumu (ja ir neatbilstība). */
function listingKmDeltaInfo(
  csdd: string,
  tirgus: string,
  citi: string,
  insights: PdfPortfolioFileInsight[],
): { listingKm: number; maxOfficial: number; deltaKm: number; deltaLabel: string } | null {
  const listing = extractKmCandidates(tirgus);
  if (listing.length === 0) return null;
  const maxOff = maxHistoricalKmFromSources(csdd, citi, insights);
  if (maxOff == null) return null;
  const minList = Math.min(...listing);
  if (minList >= maxOff) return null;
  const deltaKm = maxOff - minList;
  const k = Math.round(deltaKm / 1000);
  const deltaLabel = k >= 1 ? `~${k}k km` : `${deltaKm.toLocaleString("lv-LV")} km`;
  return { listingKm: minList, maxOfficial: maxOff, deltaKm, deltaLabel };
}

function listingVsOfficialKmWarning(
  csdd: string,
  tirgus: string,
  citi: string,
  insights: PdfPortfolioFileInsight[],
): string | null {
  if (!listingKmStrictlyBelowHistory(csdd, tirgus, citi, insights)) return null;
  const minList = Math.min(...extractKmCandidates(tirgus));
  const maxOff = maxHistoricalKmFromSources(csdd, citi, insights)!;
  return `Brīdinājums: sludinājumā norādītais nobraukums (${minList.toLocaleString("lv-LV")} km) ir zemāks par augstāko vēsturisko fiksāciju (${maxOff.toLocaleString("lv-LV")} km) — iespējama odometra neatbilstība.`;
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
  pdfInsights: PdfPortfolioFileInsight[],
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
  const info = listingKmDeltaInfo(csdd, tirgus, citi, pdfInsights);
  let warn = "";
  if (info && listingKmStrictlyBelowHistory(csdd, tirgus, citi, pdfInsights)) {
    warn = `<p class="forecast-warn">Sludinājumā norādītie <strong>${info.listingKm.toLocaleString("lv-LV")} km</strong> ir <strong>zemāki</strong> par augstāko vēsturisko fiksāciju (${info.maxOfficial.toLocaleString("lv-LV")} km; starpība ≈ ${info.deltaLabel}).</p>`;
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
  pdfInsights: PdfPortfolioFileInsight[],
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

  const kmInfo = listingKmDeltaInfo(csdd, tirgus, citi, pdfInsights);
  const kmMismatch = listingKmStrictlyBelowHistory(csdd, tirgus, citi, pdfInsights);
  let mileage: RiskRow;
  if (kmMismatch && kmInfo) {
    mileage = {
      kind: "Nobraukuma ticamība",
      statusHtml: '<span class="st-crit">🚩 Neatbilstība</span>',
      note: `Sludinājuma nobraukums ir zemāks par augstāko vēsturisko fiksāciju (starpība ≈ ${kmInfo.deltaLabel}).`,
    };
  } else if (
    extractKmCandidates(csdd).length === 0 &&
    extractKmCandidates(tirgus).length === 0 &&
    extractKmCandidates(citi).length === 0 &&
    !pdfInsights.some((i) => i.kmSamples.length > 0)
  ) {
    mileage = {
      kind: "Nobraukuma ticamība",
      statusHtml: '<span class="st-warn">Nav datu</span>',
      note: "Nav pietiekami nobraukuma atsauču salīdzināšanai — aizpildiet reģistra, sludinājuma laukus un/vai importējiet PDF.",
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
  if (heavy) {
    damage = {
      kind: "Bojājumu vēsture",
      statusHtml: '<span class="st-crit">💥 Smagi</span>',
      note: `Konstatēts smags bojājums / total loss vai ļoti augsta summa — skat. sadaļu „${CLIENT_REPORT_PDF_SECTIONS.insurance}”.`,
    };
  } else if (accCount >= 3) {
    damage = {
      kind: "Bojājumu vēsture",
      statusHtml: '<span class="st-warn">⚠️ Uzmanību</span>',
      note: `Fiksēti ${Math.max(accCount, nIns || 1)} negadījumi (pēc tabulas / teksta) — pārbaudiet detaļas.`,
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
      statusHtml: '<span class="st-warn">⚠️ Uzmanību</span>',
      note: "Ir vismaz daži bojājumu / atlīdzību ieraksti — skatīt apvienoto tabulu.",
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
        font-family:Inter,sans-serif;
        font-size:12px;
        line-height:1.45;max-width:190mm;margin:0 auto;padding:8mm 11mm;color:#1d1d1f;
        background:#ffffff;
        -webkit-font-smoothing:antialiased;
      }
      .sheet{background:#fff;border-radius:0;box-shadow:none;padding:0 0 10mm;}
      @media print{.sheet{padding:0}}
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
      .pdf-sec-head{display:flex;align-items:center;gap:8px;margin:0.85rem 0 0.35rem;}
      .pdf-sec-head .pdf-ico{color:#0066d6;flex-shrink:0;width:14px;height:14px;}
      h2.pdf-sec{
        font-size:0.88rem;font-weight:600;margin:0;flex:1;color:#1d1d1f;padding:0 0 0 8px;border:none;
        text-transform:lowercase;letter-spacing:-0.02em;border-left:2px solid #0066d6;
      }
      h3.pdf-sub{font-size:0.78rem;font-weight:600;margin:0.65rem 0 0.25rem;color:#424245;text-transform:lowercase;}
      h4.pdf-sub2{font-size:0.74rem;font-weight:600;margin:0.45rem 0 0.2rem;color:#1d1d1f;text-transform:lowercase;}
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
      table{width:100%;border-collapse:collapse;font-size:0.72rem;}
      table.fmt{margin:0.35rem 0;}
      table.fmt td,table.fmt th{padding:5px 0;border-bottom:1px solid #ececee;vertical-align:top;}
      table.fmt thead th{text-transform:lowercase;}
      table.fmt thead th{font-weight:600;font-size:0.68rem;color:#424245;border-bottom:1px solid #d2d2d7;padding-top:2px;}
      table.fmt.bordered td,table.fmt.bordered th{padding:5px 0;border:none;border-bottom:1px solid #ececee;background:transparent;}
      table.fmt.bordered thead th{background:transparent;border-bottom:1px solid #d2d2d7;}
      table.fmt.risk td,table.fmt.risk th{padding:10px 8px;border-bottom:1px solid #e5e7eb;}
      table.fmt.risk th{background:transparent;font-weight:700;text-align:left;color:#1d1d1f;}
      table.fmt.risk td:nth-child(2){white-space:nowrap;}
      .st-ok{color:#15803d;font-weight:600;}
      .st-warn{color:#b45309;font-weight:600;}
      .st-crit{color:#b91c1c;font-weight:600;}
      .tabular{font-variant-numeric:tabular-nums;}
      table.fmt.odo{font-size:0.82rem;}
      table.fmt.odo thead th{background:transparent;font-weight:600;color:#424245;border-bottom:1px solid #d2d2d7;}
      table.fmt.odo tbody tr:nth-child(even){background:transparent;}
      table.fmt.odo .odo-idx{font-weight:700;color:#475569;width:2rem;}
      table.fmt.odo .odo-graph-cell{text-align:center;width:3.25rem;vertical-align:middle;}
      .odo-dot-badge{
        display:inline-flex;align-items:center;justify-content:center;
        min-width:1.5rem;height:1.5rem;padding:0 4px;border-radius:999px;
        font-size:0.65rem;font-weight:700;color:#fff;letter-spacing:-0.02em;
        border:1px solid rgba(255,255,255,.9);
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
      .pdf-heat-red{color:#b91c1c!important;font-weight:700!important;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
      .pdf-heat-orange{color:#c2410c!important;font-weight:700!important;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
      pre.block{white-space:pre-wrap;font-size:0.72rem;background:#fafafa;border:none;border-bottom:1px solid #ececee;padding:8px 0;margin:0.35rem 0;border-radius:0;}
      .na{color:#86868b;font-style:italic;}
      .hint{font-size:0.76rem;color:#6e6e73;margin-top:0.45rem;line-height:1.45;}
      .ta-list{margin:0.4rem 0;padding-left:1.2rem;}
      .ta-list li{margin:0.35rem 0;}
      .chart-card,.block-minimal{
        margin:8px 0;padding:0 0 8px;border:none;border-bottom:1px solid #ececee;background:transparent;border-radius:0;
      }
      .chart-card--clean{margin:6px 0 8px;padding:0 0 6px;}
      .chart-caption{font-size:0.68rem;color:#86868b;margin:0 0 6px;font-weight:500;}
      .odo-chart{width:100%;max-width:100%;height:auto;display:block;}
      .tier-line-dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:8px;vertical-align:middle;}
      .odo-src-cell{vertical-align:middle;}
      .odo-src-txt{font-weight:500;color:#334155;}
      .compare-strip{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:6px;margin:0 0 10px;}
      .compare-card{
        border:none;border-bottom:1px solid #ececee;border-radius:0;padding:6px 4px 8px 0;background:transparent;
      }
      .compare-card-top{font-size:0.72rem;font-weight:700;text-transform:lowercase;letter-spacing:0.04em;color:#0066d6;}
      .compare-card-type{font-size:0.75rem;color:#64748b;margin:4px 0;}
      .compare-card-km{font-size:1rem;font-weight:700;color:#0f172a;margin-top:6px;}
      .compare-card-meta{font-size:0.72rem;color:#94a3b8;margin-top:6px;}
      .hint-tight{font-size:0.78rem!important;line-height:1.45!important;}
      .legend-item{display:inline-flex;align-items:center;gap:6px;}
      .legend-emoji{font-size:0.85rem;line-height:1;flex-shrink:0;}
      .legend-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
      .ins-sum-high{color:#b91c1c;font-weight:700;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
      .odo-dot-svg{display:inline-block;vertical-align:middle;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
      .quick-panel{margin:0 0 8px;}
      .quick-panel-meta{font-size:0.84rem;margin:0.35rem 0;line-height:1.5;color:#334155;}
      .quick-panel-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:8px;}
      @media(max-width:640px){.quick-panel-grid{grid-template-columns:1fr;}}
      .quick-ind{border:none;border-bottom:1px solid #ececee;border-radius:0;padding:6px 4px 8px 0;background:transparent;}
      .quick-ind-k{display:block;font-size:0.68rem;font-weight:700;text-transform:lowercase;letter-spacing:0.04em;color:#0066d6;margin-bottom:6px;}
      .quick-ind-v{font-size:0.88rem;font-weight:600;color:#0f172a;}
      .odo-timeline{margin:6px 0 8px;padding:0;border:none;background:transparent;}
      .odo-timeline-row{display:grid;grid-template-columns:5.5rem 1fr auto;gap:8px;align-items:center;padding:4px 0;border-bottom:1px solid #ececee;font-size:0.72rem;}
      .odo-timeline-row:last-child{border-bottom:0;}
      .odo-tl-date{color:#64748b;font-variant-numeric:tabular-nums;}
      .odo-tl-km{font-weight:600;color:#0f172a;font-variant-numeric:tabular-nums;}
      .odo-tl-dots{text-align:right;font-size:1rem;letter-spacing:2px;}
      .odo-rollback-flag{color:#b91c1c;font-weight:700;}
      .lv-reg-table{font-size:0.8rem;}
      .lv-reg-table td:first-child{width:38%;color:#64748b;}
      .lv-ta-snippet{font-size:0.82rem;margin:8px 0;color:#166534;}
      .lv-ta2-list{margin:6px 0 10px;padding-left:1.1rem;font-size:0.8rem;line-height:1.45;}
      .lv-ta2-list li{margin:4px 0;color:#b91c1c;font-weight:500;}
      .lv-brake-table{font-size:0.78rem;margin-top:8px;}
      .lv-octa-line{font-size:0.82rem;margin:0 0 8px;color:#334155;}
      .listing-odo-alert{margin:12px 0;padding:10px 14px;border-radius:8px;background:#fef2f2;border:1px solid #fecaca;color:#991b1b;font-size:0.86rem;font-weight:600;}
      .forecast-box{
        display:flex;gap:10px;align-items:flex-start;margin:6px 0 8px;padding:6px 0 8px;border:none;border-bottom:1px solid #ececee;
        background:transparent;border-radius:0;
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
        margin:6px 0 12px;padding:8px 0 10px 10px;border:none;border-left:2px solid #0066d6;border-bottom:1px solid #ececee;
        background:transparent;border-radius:0;
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
        margin:8px 0 10px;padding:0 0 8px;border:none;border-bottom:1px solid #ececee;
        background:transparent;border-radius:0;
        box-shadow:none;
        -webkit-print-color-adjust:exact;print-color-adjust:exact;
      }
      .history-compare-panel--clean .pdf-sec-head{margin-top:0;}
      .history-compare-panel.history-compare-empty{
        background:#fafbfc;border-color:#e2e8f0;
      }
      .history-compare-panel .pdf-sec-head{margin-top:0;}
      .history-compare-lead{font-size:0.74rem;line-height:1.45;color:#424245;margin:0 0 8px;}
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
      .summary-panel{margin:8px 0;padding:0;}
      .summary-lead{font-size:0.74rem;color:#424245;margin:0 0 8px;line-height:1.45;}
      .lv-sources-panel{margin:8px 0;}
      .tirgus-mirror-panel{margin:8px 0;padding:0 0 8px;border:none;border-bottom:1px solid #ececee;background:transparent;}
      .lv-sources-lead{font-size:0.74rem;color:#424245;margin:0 0 8px;line-height:1.45;}
      .lv-source-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;}
      @media(max-width:720px){.lv-source-grid{grid-template-columns:1fr;}}
      .lv-source-cell{border:none;border-bottom:1px solid #ececee;border-radius:0;padding:6px 0 8px;background:transparent;}
      .lv-source-title{font-size:0.72rem;font-weight:700;text-transform:lowercase;letter-spacing:0.04em;color:#0066d6;margin:0 0 8px;}
      .lv-source-pre{
        margin:0;font-size:0.72rem;line-height:1.42;white-space:pre-wrap;word-break:break-word;
        color:#1e293b;text-transform:none;
      }
      .lv-tirgus-manual-h{margin-top:12px!important;}
      .lv-scrape{margin:0 0 6px;padding:6px 0 8px;border:none;border-bottom:1px solid #ececee;background:transparent;border-radius:0;}
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
      .manual-vendor-comments{margin-top:6px;font-size:0.72rem;}
      .pdf-v1-notes-body{font-size:0.74rem;line-height:1.45;color:#424245;}
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
        margin-top:12px;padding:8px 0 0;border-top:1px solid #ececee;border-radius:0;background:transparent;
        font-size:0.68rem;color:#86868b;line-height:1.45;
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
    ` + pdfLayoutDraftExtraCss();
}

function buildHistoryCompareSectionHtml(insights: PdfPortfolioFileInsight[]): string {
  if (insights.length === 0) return "";

  const rows = buildHistoryCompareRows(insights);
  const bullets = buildHistoryCompareBullets(rows);

  const parts: string[] = [];
  parts.push(`<div class="history-compare-panel history-compare-slim history-compare-panel--clean" role="region">`);
  parts.push(sectionHead(ICO.layers, CLIENT_REPORT_PDF_SECTIONS.historyCompare));
  parts.push(
    `<p class="history-compare-lead">Īss <strong>starpavotu kopskats</strong> importētajiem PDF. Pilns teksts — avota PDF datnēs; salīdzinājums ar LV — grafiks un tabulas zemāk.</p>`,
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
    `<p class="hint history-compare-foot">Avotu tips — automātiska klasifikācija; papildu riski — skat. risku tabulu.</p>`,
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
  const { payload, pdfInsights, dateFmt } = args;
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
  appendListingOdometerPoints(odoPts, p.tirgus, p.listingMarket);
  reindexOdometerPoints(odoPts);
  const odoMerged = mergeOdometerPointsForDisplay(odoPts);
  const riskRows = buildRiskRows(p.csdd, p.tirgus, p.ltab, p.citi, insRows, pdfInsights);
  const taFromCsddForm =
    p.csddForm?.nextInspectionDate?.trim() != null && p.csddForm.nextInspectionDate.trim()
      ? parseFlexibleDateFragment(p.csddForm.nextInspectionDate.trim())
      : null;
  const taValidUntil =
    taFromCsddForm ?? findTaValidUntilDate(`${p.csdd}\n${p.ltab}\n${p.citi}`);
  const makeModel =
    p.csddForm?.makeModel?.trim() || extractVehicleMakeModel(p.csdd) || null;
  const expertParts = splitExpertConclusion(p.iriss);
  const listDelta = listingKmDeltaInfo(p.csdd, p.tirgus, p.citi, pdfInsights);
  const listWarnLong = listingVsOfficialKmWarning(p.csdd, p.tirgus, p.citi, pdfInsights);
  const citiOdoCallout = buildCitiOdometerRollbackCallout(p.citi);
  const priceAd = extractListingPriceEur(p.tirgus);
  const listingKms = extractKmCandidates(p.tirgus);
  const minListingKm = listingKms.length ? Math.min(...listingKms) : null;
  const quickFlags = computeQuickPanelFlags(p.csdd, p.tirgus, p.ltab, p.citi, insRows, pdfInsights);
  const scrapeBlock = buildListingMarketScrapeHtml(p.listingUrl, p.listingMarket);

  const lines: string[] = [];
  lines.push('<div class="sheet">');
  lines.push('<header class="pdf-v1-hero">');
  lines.push('<div class="pdf-v1-hero-inner">');
  lines.push(provincLogoSvg());
  lines.push('<div class="pdf-v1-hero-text">');
  lines.push(`<h1 class="pdf-v1-doc-title">${escapeHtml(CLIENT_REPORT_SECTION_LABELS.mainTitle)}</h1>`);
  lines.push(
    `<p class="pdf-v1-meta">Ģenerēts: ${escapeHtml(dateFmt.format(new Date()))} · VIN <code>${escapeHtml(p.vin ?? "—")}</code></p>`,
  );
  lines.push("</div></div></header>");

  const payBlock = buildPdfAdminMirrorPaymentBlock(p, money, dateFmt, ICO.chart);
  if (payBlock) {
    lines.push(payBlock);
    lines.push(exportRowHtml());
  }
  const vehicleBlock = buildPdfAdminMirrorVehicleBlock(p, makeModel, ICO.car);
  if (vehicleBlock) {
    lines.push(vehicleBlock);
    lines.push(exportRowHtml());
  }
  const clientBlock = buildPdfAdminMirrorClientBlock(p, ICO.user);
  if (clientBlock) {
    lines.push(clientBlock);
    lines.push(exportRowHtml());
  }

  lines.push(buildQuickControlPanelHtml(p, quickFlags, { includeNotesLine: false }));
  lines.push(exportRowHtml());

  const notesBlock = buildPdfAdminMirrorNotesBlock(p.notes, ICO.clip);
  if (notesBlock) {
    lines.push(notesBlock);
    lines.push(exportRowHtml());
  }

  const lvBlockHtml = buildLvStructuredSourcesHtml(p, taValidUntil, insRows, makeModel, {
    mainHeading: "CSDD",
    omitIntroLead: true,
  });
  if (lvBlockHtml) {
    lines.push(lvBlockHtml);
    lines.push(exportRowHtml());
  }

  const tirgusBlockHtml = buildTirgusListingSectionHtml(p, pdfInsights, {
    priceAd,
    minListingKm,
    listDelta,
    listWarnLong,
    scrapeBlock,
  });
  if (tirgusBlockHtml) {
    lines.push(tirgusBlockHtml);
    lines.push(exportRowHtml());
  }

  const vendorManualHtml = buildInternationalManualSourcePanelsHtml(p.manualVendorBlocks, p.manualLtabBlock);
  if (vendorManualHtml) {
    lines.push(vendorManualHtml);
    lines.push(exportRowHtml());
  }

  const historyCompareHtml = buildHistoryCompareSectionHtml(pdfInsights);
  const showSummaryLead =
    Boolean(historyCompareHtml) || odoPts.length > 0 || insRows.length > 0;

  lines.push(`<div class="summary-panel" role="region">`);
  lines.push(sectionHead(ICO.chart, CLIENT_REPORT_PDF_SECTIONS.summary));
  if (showSummaryLead) {
    lines.push(
      `<p class="summary-lead">Salīdzina <strong>LV</strong> un <strong>importētos</strong> avotus. Laika līnijā — tikai krāsu punkti; 🚩 pie sludinājuma, ja nobraukums zemāks par iepriekš fiksēto.</p>`,
    );
  }
  if (historyCompareHtml) lines.push(historyCompareHtml);

  if (odoPts.length > 0) {
    lines.push(`<h3 class="pdf-sub">${escapeHtml(CLIENT_REPORT_PDF_SECTIONS.odometer)}</h3>`);
    lines.push(buildOdometerSvg(odoPts));
    if (odoPts.length >= 2) {
      lines.push(buildMileageForecastBlock(odoPts, p.csdd, p.tirgus, p.citi, pdfInsights));
    }
    if (citiOdoCallout) {
      lines.push(`<div class="odo-citi-callout"><strong>Citi avoti — odometrs:</strong> ${escapeHtml(citiOdoCallout)}</div>`);
    }
    const chronoHtml = buildOdometerChronoTimelineHtml(
      odoPts,
      listingKmStrictlyBelowHistory(p.csdd, p.tirgus, p.citi, pdfInsights),
    );
    if (chronoHtml) {
      lines.push(`<h4 class="pdf-sub2">vertikālā laika līnija (hronoloģiski)</h4>`);
      lines.push(
        `<p class="hint hint-tight">Tikai emoji punkti — nozīme kā leģendā. 🚩 = iespējama neatbilstība (sludinājums zem iepriekšējā maksimuma).</p>`,
      );
      lines.push(chronoHtml);
    }
    lines.push(`<h4 class="pdf-sub2">apvienotā tabula (pēc nobraukuma)</h4>`);
    lines.push(
      `<p class="hint hint-tight">Kolonna „Avots”: krāsaini punkti; # = grafika numurs.</p>`,
    );
    lines.push(
      `<table class="fmt odo odo-compact bordered report-export" data-export="odo"><thead><tr><th>#</th><th class="odo-dots-th">punkti</th><th class="tabular">nobraukums</th><th class="tabular">datums</th></tr></thead><tbody>`,
    );
    lines.push(
      buildOdometerMergedTableRows(
        odoMerged,
        listingKmStrictlyBelowHistory(p.csdd, p.tirgus, p.citi, pdfInsights),
      ),
    );
    lines.push(`</tbody></table>`);
  }
  lines.push(exportRowHtml());

  if (insRows.length > 0) {
    const insTitle = `${CLIENT_REPORT_PDF_SECTIONS.insurance} (${insRows.length})`;
    lines.push(`<h3 class="pdf-sub">${escapeHtml(insTitle)}</h3>`);
    lines.push(
      `<p class="claims-intro claims-intro-tight">Visi avoti; LV izraksts — <strong>2.3</strong>, pilnais apkopojums — šī tabula.</p>`,
    );
    lines.push(
      `<table class="fmt ins ins-compact bordered report-export" data-export="claims"><thead><tr><th>datums</th><th>bojājums</th><th class="tabular">Zaudējumu summa</th><th class="flag-cell">valsts</th></tr></thead><tbody>`,
    );
    for (const r of insRows) {
      const rowClass = r.emphasize ? ' class="em"' : "";
      const kind = damageSymbolKindForReport(r);
      lines.push(
        `<tr${rowClass}><td>${escapeHtml(r.date)}</td><td>${escapeHtml(kind)}</td><td class="tabular">${formatLossAmountEurCell(r.amount)}</td><td class="flag-cell">${flagEmoji(r.iso)}</td></tr>`,
      );
    }
    lines.push(`</tbody></table>`);
  }

  const taSev = collectTaSeverityWarnings(p.csdd, p.citi);
  lines.push(`<h3 class="pdf-sub">${escapeHtml(CLIENT_REPORT_PDF_SECTIONS.discrepancies)}</h3>`);
  lines.push(
    `<table class="fmt risk report-export" data-export="risk"><thead><tr><th>joma</th><th>statuss</th><th>piezīme</th></tr></thead><tbody>`,
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
  lines.push(`</div>`);
  lines.push(exportRowHtml());

  lines.push(sectionHead(ICO.spark, CLIENT_REPORT_PDF_SECTIONS.expertBlock));
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
  if (p.apskatesPlāns.trim()) {
    lines.push(`<h3 class="pdf-sub">${escapeHtml(CLIENT_REPORT_PDF_SECTIONS.inspectionPlan)}</h3>`);
    lines.push(`<p class="hint hint-tight" style="margin-bottom:8px">klātienes checklist.</p>`);
    lines.push(`<pre class="block inspection-plan-block">${escapeHtml(p.apskatesPlāns.trim())}</pre>`);
  }
  lines.push(
    `<p class="hint hint-tight" style="margin-top:10px">pasūtījums: <code>${escapeHtml(p.sessionId)}</code> · ${escapeHtml(p.paymentStatus)} · ${escapeHtml(money)}</p>`,
  );
  lines.push(exportRowHtml());

  lines.push(`<div class="legend-box">`);
  lines.push(`<h3>${escapeHtml(CLIENT_REPORT_PDF_SECTIONS.sourcesLegend)}</h3>`);
  lines.push(`<div class="legend-inline">`);
  for (const L of REPORT_ODOMETER_SOURCE_LEGEND) {
    const c = TIER_COLOR[L.key];
    lines.push(
      `<span class="legend-item"><span class="legend-emoji" aria-hidden="true">${L.emoji}</span><span class="legend-dot" style="background:${c}"></span><strong>${escapeHtml(L.label)}</strong></span>`,
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
<title>${escapeHtml(title)}</title><style>${clientReportPrintCss()}</style></head><body class="provin-report-doc">${lines.join("\n")}${reportFooterScript()}</body></html>`;
  return html;
}
