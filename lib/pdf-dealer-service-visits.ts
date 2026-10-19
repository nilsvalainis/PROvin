/**
 * OFICIĀLĀ DĪLERA DATI PDF: servisa vizītes (koncepts A), ne četru kolonnu tabula.
 */
import { sanitizeMileageCountryField } from "@/lib/auto-records-paste-parse";
import { translateClientReportStatic, type ClientReportLang } from "@/lib/client-report-i18n";
import { countryLabelToIso2, normalizeCountryName } from "@/lib/country-names-lv";
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

function knownCountry(raw: string, lang: ClientReportLang): string {
  const t = raw.trim();
  if (!t || !countryLabelToIso2(t)) return "";
  return normalizeCountryName(t, lang);
}

export function formatDealerServicePlace(
  location: string,
  lang: ClientReportLang = "lv",
): { place: string; country: string } {
  const raw = location.replace(/\s+/g, " ").trim();
  if (!raw) return { place: "", country: "" };
  const lastComma = raw.lastIndexOf(",");
  const lastSeg = lastComma >= 0 ? raw.slice(lastComma + 1).trim() : "";
  const fromName = countryFromDealerName(raw);
  const country = fromName ? normalizeCountryName(fromName, lang) : knownCountry(lastSeg, lang);
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

function visitWorksHtml(raw: string, hideKeyReadLines: boolean, lang: ClientReportLang): string {
  const lines = workLines(raw, hideKeyReadLines);
  if (lines.length === 0) {
    return `<p class="pdf-svc-empty">${escapeHtml(translateClientReportStatic(EMPTY_WORKS_NOTE, lang))}</p>`;
  }
  return `<ul class="pdf-svc-works">${lines
    .map((line) => `<li class="pdf-svc-work">${escapeHtml(line)}</li>`)
    .join("")}</ul>`;
}

function visitPlaceHtml(location: string, lang: ClientReportLang): string {
  const { place, country } = formatDealerServicePlace(location, lang);
  if (!place && !country) return "";
  if (place && country && !place.toLowerCase().includes(country.toLowerCase())) {
    return `<p class="pdf-svc-place">${escapeHtml(place)} <span>· ${escapeHtml(country)}</span></p>`;
  }
  return `<p class="pdf-svc-place">${escapeHtml(place || country)}</p>`;
}

function visitKindTagHtml(works: string, lang: ClientReportLang): string {
  const kind = classifyDealerVisitKind(works);
  return `<span class="pdf-svc-tag pdf-svc-tag--${kind}">${escapeHtml(translateClientReportStatic(dealerVisitKindLabel(kind), lang))}</span>`;
}

function visitHtml(row: AutoRecordsServiceWorkRow, hideKeyReadLines: boolean, lang: ClientReportLang): string {
  const date = row.date.trim();
  const odo = formatServiceWorkOdometer(row.odometer);
  const dateHtml = date
    ? `<time class="pdf-svc-date">${escapeHtml(date)}</time>`
    : `<span class="pdf-svc-date pdf-svc-date--empty"></span>`;
  const km = odo ? `<span class="pdf-svc-km">${escapeHtml(odo)}</span>` : "";
  const place = visitPlaceHtml(row.location, lang);
  const tag = visitKindTagHtml(row.works, lang);
  const chips = `<div class="pdf-svc-chips">${tag}${km}</div>`;
  const head = `<div class="pdf-svc-box-top">${place}${chips}</div>`;
  return `<div class="pdf-svc-visit pdf-svc-kind--${classifyDealerVisitKind(row.works)}">
    ${dateHtml}
    <span class="pdf-svc-rail" aria-hidden="true"><span class="pdf-svc-dot"></span></span>
    <article class="pdf-svc-box">${head}${visitWorksHtml(row.works, hideKeyReadLines, lang)}</article>
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

function spanHtml(
  rows: AutoRecordsServiceWorkRow[],
  opts?: { cover?: boolean; lang?: ClientReportLang },
): string {
  if (rows.length < 2) return "";
  const newest = rows[0]!;
  const oldest = rows[rows.length - 1]!;
  const firstKm = formatServiceWorkOdometer(oldest.odometer);
  const lastKm = formatServiceWorkOdometer(newest.odometer);
  if (!firstKm && !lastKm) return "";
  const firstDate = oldest.date.trim();
  const lastDate = newest.date.trim();
  const lang = opts?.lang ?? "lv";
  const visitCount = `${rows.length} ${translateClientReportStatic("vizītes", lang)}`;
  const firstMeta = opts?.cover
    ? firstDate
    : [translateClientReportStatic("Pirmais ieraksts", lang), firstDate].filter(Boolean).join(" · ");
  const lastMeta = opts?.cover
    ? [lastDate, visitCount].filter(Boolean).join(" · ")
    : [translateClientReportStatic("Pēdējais ieraksts", lang), lastDate].filter(Boolean).join(" · ");
  return buildPdfFirstLastReadingSpanHtml({
    firstKm,
    lastKm,
    firstMeta,
    lastMeta,
  });
}

export function buildDealerServiceSpanHtml(
  rows: AutoRecordsServiceWorkRow[],
  opts?: { cover?: boolean; lang?: ClientReportLang },
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
  lang?: ClientReportLang;
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
  const lang = opts?.lang ?? "lv";
  const parts: string[] = opts?.omitSpan ? [] : [spanHtml(printable, { lang })];
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
    const visit = visitHtml(row, hideKeyReadLines, lang);
    const older = printable[i + 1];
    const gap =
      older != null
        ? visitGapBetween(
            { ...older },
            { ...row },
          )
        : null;
    const gapHtml = isDealerServiceGap(gap) && gap ? buildDealerGapMarkerHtml(gap, lang) : "";

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
