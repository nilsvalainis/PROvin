/**
 * OFICIĀLĀ DĪLERA DATI PDF: servisa vizītes (koncepts A), ne četru kolonnu tabula.
 */
import { sanitizeMileageCountryField } from "@/lib/auto-records-paste-parse";
import { countryLabelToIso2, normalizeCountryNameLv } from "@/lib/country-names-lv";
import {
  autoRecordsServiceWorkRowIsPrintable,
  formatServiceWorkOdometer,
  mergeAutoRecordsServiceWorksByOdometer,
  normalizeAutoRecordsServiceWorkRow,
  type AutoRecordsServiceWorkRow,
} from "@/lib/auto-records-service-works";
import { countryFromDealerName } from "@/lib/dealer-report-extract";
import {
  buildDealerGapMarkerHtml,
  classifyDealerVisitKind,
  dealerPdfWorkLines,
  dealerVisitKindLabel,
  filterDealerPdfVisitRows,
  isDealerServiceGap,
  visitGapBetween,
} from "@/lib/pdf-dealer-timeline";
import { formatServiceWorksLines } from "@/lib/service-works-lines";
import { isVendorServiceCategoryLine } from "@/lib/vendor-service-history";

const EMPTY_WORKS_NOTE = "Detalizēts darbu saraksts atskaitē nav pieejams.";
const PLACEHOLDER_WORKS_RE = /detaliz[ēe]ts\s+darbu\s+saraksts/i;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function serviceWorkYear(date: string): string {
  const m = date.trim().match(/(\d{4})\s*$/);
  return m?.[1] ?? "";
}

function knownCountryLv(raw: string): string {
  const t = raw.trim();
  if (!t || !countryLabelToIso2(t)) return "";
  return normalizeCountryNameLv(t);
}

export function formatDealerServicePlace(location: string): { place: string; country: string } {
  const raw = location.replace(/\s+/g, " ").trim();
  if (!raw) return { place: "", country: "" };
  const lastComma = raw.lastIndexOf(",");
  const lastSeg = lastComma >= 0 ? raw.slice(lastComma + 1).trim() : "";
  const country = countryFromDealerName(raw) || knownCountryLv(lastSeg);
  let place = raw;
  if (country && lastComma >= 0) {
    const lastNorm = sanitizeMileageCountryField(lastSeg);
    if (lastNorm && lastNorm.toLowerCase() === country.toLowerCase()) {
      place = raw.slice(0, lastComma).replace(/[,\s]+$/g, "").trim();
    }
  }
  return { place, country };
}

function workLines(raw: string, hideKeyReadLines: boolean): string[] {
  return dealerPdfWorkLines(formatServiceWorksLines(raw), { hideKeyReadLines })
    .map((line) => line.trim())
    .filter((line) => line && !PLACEHOLDER_WORKS_RE.test(line) && !isVendorServiceCategoryLine(line));
}

function visitWorksHtml(raw: string, hideKeyReadLines: boolean): string {
  const lines = workLines(raw, hideKeyReadLines);
  if (lines.length === 0) {
    return `<p class="pdf-svc-empty">${escapeHtml(EMPTY_WORKS_NOTE)}</p>`;
  }
  return `<ul class="pdf-svc-works">${lines
    .map((line) => `<li class="pdf-svc-work">${escapeHtml(line)}</li>`)
    .join("")}</ul>`;
}

function visitPlaceHtml(location: string): string {
  const { place, country } = formatDealerServicePlace(location);
  if (!place && !country) return "";
  if (place && country && !place.toLowerCase().includes(country.toLowerCase())) {
    return `<p class="pdf-svc-place">${escapeHtml(place)} <span>· ${escapeHtml(country)}</span></p>`;
  }
  return `<p class="pdf-svc-place">${escapeHtml(place || country)}</p>`;
}

function visitKindTagHtml(works: string): string {
  const kind = classifyDealerVisitKind(works);
  return `<span class="pdf-svc-tag pdf-svc-tag--${kind}">${escapeHtml(dealerVisitKindLabel(kind))}</span>`;
}

function visitHtml(row: AutoRecordsServiceWorkRow, hideKeyReadLines: boolean): string {
  const date = row.date.trim();
  const odo = formatServiceWorkOdometer(row.odometer);
  const dateHtml = date
    ? `<time class="pdf-svc-date">${escapeHtml(date)}</time>`
    : `<span class="pdf-svc-date pdf-svc-date--empty"></span>`;
  const km = odo ? `<span class="pdf-svc-km">${escapeHtml(odo)}</span>` : "";
  const place = visitPlaceHtml(row.location);
  const tag = visitKindTagHtml(row.works);
  const head = `<div class="pdf-svc-box-top">${place}${tag}</div>`;
  return `<div class="pdf-svc-visit pdf-svc-kind--${classifyDealerVisitKind(row.works)}">
    <div class="pdf-svc-when">${dateHtml}${km}</div>
    <span class="pdf-svc-rail" aria-hidden="true"><span class="pdf-svc-dot"></span></span>
    <article class="pdf-svc-box">${head}${visitWorksHtml(row.works, hideKeyReadLines)}</article>
  </div>`;
}

/** Pirmais / pēdējais rādījums zem nobraukuma līknes (dīlera vāka logs). */
export function buildPdfFirstLastReadingSpanHtml(opts: {
  firstKm: string;
  lastKm: string;
  firstMeta: string;
  lastMeta: string;
}): string {
  const firstKm = opts.firstKm.trim();
  const lastKm = opts.lastKm.trim();
  if (!firstKm && !lastKm) return "";
  const first = firstKm
    ? `<div class="pdf-svc-span__pt"><b>${escapeHtml(firstKm)}</b><i>${escapeHtml(opts.firstMeta)}</i></div>`
    : `<div class="pdf-svc-span__pt"></div>`;
  const last = lastKm
    ? `<div class="pdf-svc-span__pt pdf-svc-span__pt--end"><b>${escapeHtml(lastKm)}</b><i>${escapeHtml(opts.lastMeta)}</i></div>`
    : `<div class="pdf-svc-span__pt pdf-svc-span__pt--end"></div>`;
  return `<div class="pdf-svc-span">${first}${last}</div>`;
}

function spanHtml(rows: AutoRecordsServiceWorkRow[], opts?: { cover?: boolean }): string {
  if (rows.length < 2) return "";
  const newest = rows[0]!;
  const oldest = rows[rows.length - 1]!;
  const firstKm = formatServiceWorkOdometer(oldest.odometer);
  const lastKm = formatServiceWorkOdometer(newest.odometer);
  if (!firstKm && !lastKm) return "";
  const firstDate = oldest.date.trim();
  const lastDate = newest.date.trim();
  const visitCount = `${rows.length} vizītes`;
  const firstMeta = opts?.cover
    ? firstDate
    : ["Pirmais ieraksts", firstDate].filter(Boolean).join(" · ");
  const lastMeta = opts?.cover
    ? [lastDate, visitCount].filter(Boolean).join(" · ")
    : ["Pēdējais ieraksts", lastDate].filter(Boolean).join(" · ");
  return buildPdfFirstLastReadingSpanHtml({
    firstKm,
    lastKm,
    firstMeta,
    lastMeta,
  });
}

export function buildDealerServiceSpanHtml(
  rows: AutoRecordsServiceWorkRow[],
  opts?: { cover?: boolean },
): string {
  return spanHtml(printableDealerServiceWorks(rows), opts);
}

function dealerRowHasDateOrKm(row: AutoRecordsServiceWorkRow): boolean {
  return Boolean(row.date.trim() || row.odometer.trim());
}

export type DealerServiceVisitsPdfOpts = {
  omitSpan?: boolean;
  /** true = slēpt Key Read un tukšos km punktus (tikai kombinētam produktam). */
  condenseRecords?: boolean;
  extraMileageRows?: AutoRecordsServiceWorkRow[];
};

export function printableDealerServiceWorks(
  rows: AutoRecordsServiceWorkRow[],
  opts?: { includeKmOnly?: boolean },
): AutoRecordsServiceWorkRow[] {
  const includeKmOnly = opts?.includeKmOnly === true;
  const normalized = (rows ?? []).map(normalizeAutoRecordsServiceWorkRow);
  const filtered = includeKmOnly
    ? normalized.filter(dealerRowHasDateOrKm)
    : normalized.filter(autoRecordsServiceWorkRowIsPrintable);
  return mergeAutoRecordsServiceWorksByOdometer(filtered);
}

export function buildDealerServiceVisitsHtml(
  rows: AutoRecordsServiceWorkRow[],
  opts?: DealerServiceVisitsPdfOpts,
): string {
  const condense = opts?.condenseRecords === true;
  const extra = opts?.extraMileageRows ?? [];
  const printable = filterDealerPdfVisitRows(
    printableDealerServiceWorks([...rows, ...extra], { includeKmOnly: !condense }),
    condense,
  );
  if (printable.length === 0) return "";

  const hideKeyReadLines = condense;
  const parts: string[] = opts?.omitSpan ? [] : [spanHtml(printable)];
  let lastYear = "";
  let yearOpen = false;

  const closeYear = () => {
    if (yearOpen) {
      parts.push("</div>");
      yearOpen = false;
    }
  };

  for (let i = 0; i < printable.length; i++) {
    const row = printable[i]!;
    const year = serviceWorkYear(row.date);
    const visit = visitHtml(row, hideKeyReadLines);
    const older = printable[i + 1];
    const gap =
      older != null
        ? visitGapBetween(
            { ...older },
            { ...row },
          )
        : null;
    const gapHtml = isDealerServiceGap(gap) && gap ? buildDealerGapMarkerHtml(gap) : "";

    if (year && year !== lastYear) {
      closeYear();
      parts.push(
        `<div class="pdf-svc-year-block"><div class="pdf-keep-head"><p class="pdf-svc-year">${escapeHtml(year)}</p>${visit}</div>${gapHtml}`,
      );
      lastYear = year;
      yearOpen = true;
      continue;
    }
    parts.push(`${visit}${gapHtml}`);
  }
  closeYear();
  return parts.join("\n");
}
