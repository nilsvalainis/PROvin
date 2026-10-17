/**
 * OFICIĀLĀ DĪLERA DATI PDF: kopsavilkuma josla, vizīšu birkas, robu marķieri
 * un lielo darbu karte. Tikai fakti, bez verdikta un bez EUR.
 */
import {
  dealerComponentLv,
  detectDealerComponents,
  extractDealerFactsFromServiceWorks,
  isDealerCampaignText,
  type DealerComponentId,
  type DealerFact,
  type DealerFacts,
} from "@/lib/admin-ai-dealer-facts";
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
const GEARBOX_RE =
  /kārba|ātrumkār|gearbox|transmission|getriebe|versnellingsbak|växellåd|dsg\b|dct\b|cvt\b/i;
const BODY_GLASS_RE =
  /vējstikl|stikla\s+maiņ|bamper|spārn|durvju|panel|krāso|pārkrās|body\s+repair|windscreen|windshield|bumper|fender|lackier|karosser|scheibe/i;

const MAJOR_COMPONENT_ORDER: { id: DealerComponentId | "gearbox" | "body_glass"; label: string }[] = [
  { id: "timing_chain", label: "Sadales ķēde" },
  { id: "gearbox", label: "Ātrumkārba" },
  { id: "dual_mass_flywheel", label: "Divmasu spararats" },
  { id: "turbo", label: "Turbokompresors" },
  { id: "body_glass", label: "Virsbūve / stikls" },
];

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
  if (isDealerCampaignText(text)) return "campaign";
  if (WARRANTY_RE.test(text)) return "warranty";
  if (looksLikeIntervalMaintenanceWorks(text)) return "maintenance";
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

function majorWorkHits(facts: DealerFacts): DealerMajorWorkHit[] {
  const out: DealerMajorWorkHit[] = [];
  const seen = new Set<string>();
  for (const spec of MAJOR_COMPONENT_ORDER) {
    for (const fact of facts.rows) {
      const text = `${fact.works} ${fact.components.map(dealerComponentLv).join(" ")}`;
      let hit = false;
      if (spec.id === "gearbox") {
        hit = fact.components.includes("gearbox_oil") || GEARBOX_RE.test(text);
      } else if (spec.id === "body_glass") {
        hit = BODY_GLASS_RE.test(text);
      } else {
        hit = fact.components.includes(spec.id) || detectDealerComponents(text).includes(spec.id);
      }
      if (!hit) continue;
      const key = spec.id;
      if (seen.has(key)) continue;
      seen.add(key);
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

function gapLabel(gap: DealerVisitGap): string {
  const parts: string[] = [];
  if (gap.months != null) parts.push(`${gap.months} mēn.`);
  if (gap.km != null) parts.push(`${groupDigits(gap.km)} km`);
  return parts.join(" / ");
}

export function buildDealerVisitSummaryHtml(
  rows: readonly AutoRecordsServiceWorkRow[],
  facts?: DealerFacts | null,
): string {
  const summary = buildDealerVisitSummary(rows, facts);
  if (!summary) return "";
  const gap = summary.longestGap;
  const gapText = gap ? gapLabel(gap) : "Nav";
  const campaigns = summary.campaignsDone ? "Jā" : "Nē";
  const major =
    summary.majorWorks.length > 0
      ? summary.majorWorks.map((w) => `${w.label} (${w.factId})`).join(", ")
      : "Nav fiksēts";
  const cells: { k: string; v: string }[] = [
    { k: "Vizītes", v: String(summary.visitCount) },
    { k: "Pirmā vizīte", v: summary.firstDate || "Nav" },
    { k: "Pēdējā vizīte", v: summary.lastDate || "Nav" },
    { k: "Pēdējais dīlera km", v: summary.lastKm || "Nav" },
    { k: "Garākais robs", v: gapText },
    { k: "Kampaņas veiktas", v: campaigns },
    { k: "Lielie mezgli", v: major },
  ];
  return `<div class="pdf-svc-summary" role="region" aria-label="Dīlera kopsavilkums">
    ${cells
      .map(
        (c) =>
          `<div class="pdf-svc-summary__cell"><span>${escapeHtml(c.k)}</span><b>${escapeHtml(c.v)}</b></div>`,
      )
      .join("")}
  </div>`;
}

export function buildDealerMajorWorksHtml(facts: DealerFacts): string {
  const hits = majorWorkHits(facts);
  if (hits.length === 0) return "";
  const items = hits
    .map((w) => {
      const meta = [w.factId, w.date, w.km].filter(Boolean).join(" · ");
      return `<li class="pdf-svc-major__item"><b>${escapeHtml(w.label)}</b><span>${escapeHtml(meta)}</span></li>`;
    })
    .join("");
  return `<aside class="pdf-svc-major">
    <p class="pdf-subhead">Lielie darbi</p>
    <ul class="pdf-svc-major__list">${items}</ul>
  </aside>`;
}

export function buildDealerGapMarkerHtml(gap: DealerVisitGap): string {
  return `<div class="pdf-svc-gap" role="note">
    <span class="pdf-svc-gap__tag">Robs datos</span>
    <span class="pdf-svc-gap__val">${escapeHtml(gapLabel(gap))}</span>
    <span class="pdf-svc-gap__note">Fakts no dīlera žurnāla, ne verdikts par izlaistu apkopi.</span>
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
