/**
 * OFICIĀLĀ DĪLERA DATI PDF: kopsavilkuma josla, vizīšu birkas, robu marķieri
 * un lielo darbu karte. Tikai fakti, bez verdikta un bez EUR.
 */
import {
  extractDealerFactsFromServiceWorks,
  isDealerCampaignText,
  type DealerFact,
  type DealerFacts,
} from "@/lib/admin-ai-dealer-facts";
import {
  hasAnyMajorAssemblyRepair,
  hasNonCampaignRepairAction,
  isCheckNoFaultWork,
  isCourtesyCarWork,
  isDealerSoftwareWork,
  isMajorAssemblyRepairWork,
  isRoutineMaintenanceWork,
  MAJOR_ASSEMBLY_SPECS,
} from "@/lib/dealer-major-works";
import {
  translateClientReportNone,
  translateClientReportStatic,
  translateClientReportYesNo,
  type ClientReportLang,
} from "@/lib/client-report-i18n";
import {
  formatServiceWorkOdometer,
  type AutoRecordsServiceWorkRow,
} from "@/lib/auto-records-service-works";
import { parseDotOrIsoDateToMs } from "@/lib/clean-date-str";
import { OIL_DEALER_GAP_KM, OIL_DEALER_GAP_MONTHS } from "@/lib/oil-change-intervals";
import { stripPartNumbersFromWorkLine } from "@/lib/service-works-lines";
import {
  KEY_READ_HISTORY_LABEL,
  looksLikeCbsKeyReadWorks,
  looksLikeIntervalMaintenanceWorks,
} from "@/lib/vendor-service-history";

export const DEALER_PDF_GAP_KM = OIL_DEALER_GAP_KM;
export const DEALER_PDF_GAP_MONTHS = OIL_DEALER_GAP_MONTHS;

export type DealerVisitKind = "maintenance" | "repair" | "campaign" | "warranty" | "key_read";

export type DealerVisitGap = {
  months: number | null;
  km: number | null;
};

export type DealerMajorWorkHit = {
  id: string;
  label: string;
  factId: string;
  date: string;
  km: string;
};

export type DealerVisitSummary = {
  visitCount: number;
  firstDate: string;
  lastDate: string;
  lastKm: string;
  longestGap: DealerVisitGap | null;
  campaignsDone: boolean;
  majorWorks: DealerMajorWorkHit[];
};

const WARRANTY_RE = /garantij|warranty|garantie|warrenty|kulanc/i;

/** Tukša rinda vai tikai vispārīgs servisa nosaukums, ne remonts. */
const GENERIC_SERVICE_VISIT_RE =
  /^(serviss|service|wartung|apkope|servisa(\s+apmekl[ēe]jums)?|service\s+visit|inspektion|сервис|обслуживание)$/iu;

export function isGenericDealerServiceVisit(works: string): boolean {
  const folded = (works ?? "")
    .split(/\n+/)
    .map((line) => line.replace(/[:.]+$/g, "").trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  if (!folded) return false;
  return GENERIC_SERVICE_VISIT_RE.test(folded);
}

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
  return Number.isFinite(n) && n > 0 ? n : null;
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

function chronoRows(rows: readonly AutoRecordsServiceWorkRow[]): AutoRecordsServiceWorkRow[] {
  return [...rows].sort((a, b) => {
    const ta = parseDotOrIsoDateToMs(a.date);
    const tb = parseDotOrIsoDateToMs(b.date);
    if (ta !== tb) return ta - tb;
    return (parseKm(a.odometer) ?? 0) - (parseKm(b.odometer) ?? 0);
  });
}

export function classifyDealerVisitKind(works: string): DealerVisitKind {
  const text = works ?? "";
  if (looksLikeCbsKeyReadWorks(text)) return "key_read";
  if (WARRANTY_RE.test(text)) return "warranty";
  if (hasAnyMajorAssemblyRepair(text)) return "repair";
  const independentRepair = hasNonCampaignRepairAction(text);
  if (isDealerCampaignText(text) && !independentRepair) return "campaign";
  if (isDealerSoftwareWork(text) && !independentRepair) return "campaign";
  if (looksLikeIntervalMaintenanceWorks(text) || isRoutineMaintenanceWork(text)) return "maintenance";
  if (isGenericDealerServiceVisit(text) && !independentRepair) return "maintenance";
  if (isCheckNoFaultWork(text) && !independentRepair) return "maintenance";
  if (isCourtesyCarWork(text) && !independentRepair) return "warranty";
  if (independentRepair) return "repair";
  if (isDealerCampaignText(text)) return "campaign";
  return "repair";
}

export function dealerVisitKindLabel(kind: DealerVisitKind): string {
  switch (kind) {
    case "maintenance":
      return "Apkope";
    case "repair":
      return "Remonts";
    case "campaign":
      return "Kampaņa";
    case "warranty":
      return "Garantija";
    case "key_read":
      return "Nolasījums";
  }
}

export function isDealerPdfKeyReadRow(row: AutoRecordsServiceWorkRow): boolean {
  return looksLikeCbsKeyReadWorks(row.works ?? "") || /^key\s*read(\s*history)?$/i.test(row.works.trim());
}

export function isDealerPdfEmptyMileageRow(row: AutoRecordsServiceWorkRow): boolean {
  const works = (row.works ?? "").replace(/\s+/g, " ").trim();
  const location = (row.location ?? "").trim();
  return !works && !location && Boolean(row.date.trim() || row.odometer.trim());
}

/** Dīlera-only: rāda arī Key Read un km-tikai punktus. Kombinētā produktā slēpj. */
export function filterDealerPdfVisitRows(
  rows: readonly AutoRecordsServiceWorkRow[],
  condenseRecords: boolean,
): AutoRecordsServiceWorkRow[] {
  if (!condenseRecords) return [...rows];
  return rows.filter((row) => !isDealerPdfKeyReadRow(row) && !isDealerPdfEmptyMileageRow(row));
}

export function dealerPdfWorkLines(raw: string, opts?: { hideKeyReadLines?: boolean }): string[] {
  return raw
    .split(/\n+/)
    .map((line) => stripPartNumbersFromWorkLine(line))
    .map((line) => line.trim())
    .filter((line) => {
      if (!line) return false;
      if (opts?.hideKeyReadLines) {
        if (/^key\s*read(\s*history)?$/i.test(line)) return false;
        if (line.toLowerCase() === KEY_READ_HISTORY_LABEL.toLowerCase()) return false;
      }
      return true;
    });
}

export function isDealerServiceGap(gap: DealerVisitGap | null | undefined): boolean {
  if (!gap) return false;
  if (gap.km != null && gap.km > DEALER_PDF_GAP_KM) return true;
  if (gap.months != null && gap.months > DEALER_PDF_GAP_MONTHS) return true;
  return false;
}

export function visitGapBetween(
  older: AutoRecordsServiceWorkRow,
  newer: AutoRecordsServiceWorkRow,
): DealerVisitGap | null {
  const fromMs = parseDotOrIsoDateToMs(older.date);
  const toMs = parseDotOrIsoDateToMs(newer.date);
  const fromKm = parseKm(older.odometer);
  const toKm = parseKm(newer.odometer);
  const months = fromMs && toMs ? monthsBetween(fromMs, toMs) : null;
  const km = fromKm != null && toKm != null && toKm > fromKm ? toKm - fromKm : null;
  if (months == null && km == null) return null;
  return { months, km };
}

function longestGap(rows: readonly AutoRecordsServiceWorkRow[]): DealerVisitGap | null {
  const chrono = chronoRows(rows);
  let best: DealerVisitGap | null = null;
  let bestScore = 0;
  for (let i = 1; i < chrono.length; i++) {
    const gap = visitGapBetween(chrono[i - 1]!, chrono[i]!);
    if (!gap) continue;
    const score = (gap.months ?? 0) * 1000 + (gap.km ?? 0);
    if (score > bestScore) {
      best = gap;
      bestScore = score;
    }
  }
  return best;
}

function factKmLabel(fact: DealerFact): string {
  if (fact.odometerKm == null) return "";
  return `${groupDigits(fact.odometerKm)} km`;
}

function factSearchText(fact: DealerFact): string {
  return [fact.works, fact.worksOriginal, fact.worksLv].filter(Boolean).join("\n");
}

function majorWorkHits(facts: DealerFacts): DealerMajorWorkHit[] {
  const out: DealerMajorWorkHit[] = [];
  const seen = new Set<string>();
  for (const spec of MAJOR_ASSEMBLY_SPECS) {
    for (const fact of facts.rows) {
      if (!isMajorAssemblyRepairWork(factSearchText(fact), spec.id)) continue;
      if (seen.has(spec.id)) continue;
      seen.add(spec.id);
      out.push({
        id: spec.id,
        label: spec.label,
        factId: fact.id,
        date: fact.date,
        km: factKmLabel(fact),
      });
      break;
    }
  }
  return out;
}

export function buildDealerVisitSummary(
  rows: readonly AutoRecordsServiceWorkRow[],
  facts?: DealerFacts | null,
): DealerVisitSummary | null {
  if (rows.length === 0) return null;
  const chrono = chronoRows(rows);
  const first = chrono[0]!;
  const last = chrono[chrono.length - 1]!;
  const resolvedFacts = facts ?? extractDealerFactsFromServiceWorks(rows);
  return {
    visitCount: rows.length,
    firstDate: first.date.trim(),
    lastDate: last.date.trim(),
    lastKm: formatServiceWorkOdometer(last.odometer),
    longestGap: longestGap(chrono),
    campaignsDone: resolvedFacts.rows.some((r) => r.kind === "campaign"),
    majorWorks: majorWorkHits(resolvedFacts),
  };
}

function gapLabel(gap: DealerVisitGap, lang: ClientReportLang = "lv"): string {
  const parts: string[] = [];
  if (gap.months != null) parts.push(`${gap.months} ${translateClientReportStatic("mēn.", lang)}`);
  if (gap.km != null) parts.push(`${groupDigits(gap.km)} km`);
  return parts.join(" / ");
}

export function buildDealerVisitSummaryHtml(
  rows: readonly AutoRecordsServiceWorkRow[],
  facts?: DealerFacts | null,
  lang: ClientReportLang = "lv",
): string {
  const summary = buildDealerVisitSummary(rows, facts);
  if (!summary) return "";
  const t = (lv: string) => translateClientReportStatic(lv, lang);
  const none = translateClientReportNone(lang);
  const gap = summary.longestGap;
  const gapText = gap ? gapLabel(gap, lang) : none;
  const campaigns = translateClientReportYesNo(summary.campaignsDone, lang);
  const major =
    summary.majorWorks.length > 0
      ? summary.majorWorks.map((w) => t(w.label)).join(", ")
      : t("Nav fiksēts");
  const cells: { k: string; v: string }[] = [
    { k: t("Vizītes"), v: String(summary.visitCount) },
    { k: t("Pirmā vizīte"), v: summary.firstDate || none },
    { k: t("Pēdējā vizīte"), v: summary.lastDate || none },
    { k: t("Pēdējais dīlera km"), v: summary.lastKm || none },
    { k: t("Garākais robs"), v: gapText },
    { k: t("Kampaņas veiktas"), v: campaigns },
    { k: t("Lielie mezgli"), v: major },
  ];
  return `<div class="pdf-svc-summary" role="region" aria-label="${escapeHtml(t("Dīlera kopsavilkums"))}">
    ${cells
      .map(
        (c) =>
          `<div class="pdf-svc-summary__cell"><span>${escapeHtml(c.k)}</span><b>${escapeHtml(c.v)}</b></div>`,
      )
      .join("")}
  </div>`;
}

export function buildDealerMajorWorksHtml(facts: DealerFacts, lang: ClientReportLang = "lv"): string {
  const hits = majorWorkHits(facts);
  if (hits.length === 0) return "";
  const t = (lv: string) => translateClientReportStatic(lv, lang);
  const items = hits
    .map((w) => {
      const meta = [w.date, w.km].filter(Boolean).join(" · ");
      return `<li class="pdf-svc-major__item"><b>${escapeHtml(t(w.label))}</b><span class="pdf-svc-major__meta">${escapeHtml(meta)}</span></li>`;
    })
    .join("");
  return `<aside class="pdf-svc-major">
    <p class="pdf-subhead">${escapeHtml(t("Lielie darbi"))}</p>
    <ul class="pdf-svc-major__list">${items}</ul>
  </aside>`;
}

export function buildDealerGapMarkerHtml(gap: DealerVisitGap, lang: ClientReportLang = "lv"): string {
  const t = (lv: string) => translateClientReportStatic(lv, lang);
  return `<div class="pdf-svc-gap" role="note">
    <span class="pdf-svc-gap__tag">${escapeHtml(t("Robs datos"))}</span>
    <span class="pdf-svc-gap__val">${escapeHtml(gapLabel(gap, lang))}</span>
    <span class="pdf-svc-gap__note">${escapeHtml(t("Fakts no dīlera žurnāla, ne verdikts par izlaistu apkopi."))}</span>
  </div>`;
}

export function dealerFactIdForRow(
  row: AutoRecordsServiceWorkRow,
  facts: DealerFacts,
): string {
  const date = row.date.trim();
  const km = parseKm(row.odometer);
  const hit = facts.rows.find((f) => f.date === date && (km == null || f.odometerKm === km));
  return hit?.id ?? "";
}
