/**
 * OFICIĀLĀ DĪLERA DATI PDF: servisa vizītes (koncepts A), ne četru kolonnu tabula.
 */
import { sanitizeMileageCountryField } from "@/lib/auto-records-paste-parse";
import { countryLabelToIso2, normalizeCountryNameLv } from "@/lib/country-names-lv";
import {
  autoRecordsServiceWorkRowIsPrintable,
  formatServiceWorkOdometer,
  normalizeAutoRecordsServiceWorkRow,
  sortAutoRecordsServiceWorkRows,
  type AutoRecordsServiceWorkRow,
} from "@/lib/auto-records-service-works";
import { countryFromDealerName } from "@/lib/dealer-report-extract";
import { formatServiceWorksLines } from "@/lib/service-works-lines";

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

function workLines(raw: string): string[] {
  return formatServiceWorksLines(raw)
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !PLACEHOLDER_WORKS_RE.test(line));
}

function visitWorksHtml(raw: string): string {
  const lines = workLines(raw);
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

function visitHtml(row: AutoRecordsServiceWorkRow): string {
  const date = row.date.trim();
  const odo = formatServiceWorkOdometer(row.odometer);
  const dateHtml = date
    ? `<time class="pdf-svc-date">${escapeHtml(date)}</time>`
    : `<span class="pdf-svc-date pdf-svc-date--empty"></span>`;
  const km = odo ? `<span class="pdf-svc-km">${escapeHtml(odo)}</span>` : "";
  const place = visitPlaceHtml(row.location);
  const head = place || km ? `<div class="pdf-svc-box-top">${place}${km}</div>` : "";
  return `<div class="pdf-svc-visit">
    ${dateHtml}
    <span class="pdf-svc-rail" aria-hidden="true"><span class="pdf-svc-dot"></span></span>
    <article class="pdf-svc-box">${head}${visitWorksHtml(row.works)}</article>
  </div>`;
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
  return `<div class="pdf-svc-span">
    <div class="pdf-svc-span__pt"><b>${escapeHtml(firstKm || "km nav")}</b><i>${escapeHtml(firstMeta)}</i></div>
    <div class="pdf-svc-span__pt pdf-svc-span__pt--end"><b>${escapeHtml(lastKm || "km nav")}</b><i>${escapeHtml(lastMeta)}</i></div>
  </div>`;
}

export function buildDealerServiceSpanHtml(
  rows: AutoRecordsServiceWorkRow[],
  opts?: { cover?: boolean },
): string {
  return spanHtml(printableDealerServiceWorks(rows), opts);
}

export function printableDealerServiceWorks(rows: AutoRecordsServiceWorkRow[]): AutoRecordsServiceWorkRow[] {
  return sortAutoRecordsServiceWorkRows(
    (rows ?? []).map(normalizeAutoRecordsServiceWorkRow).filter(autoRecordsServiceWorkRowIsPrintable),
  );
}

export function buildDealerServiceVisitsHtml(
  rows: AutoRecordsServiceWorkRow[],
  opts?: { omitSpan?: boolean },
): string {
  const printable = printableDealerServiceWorks(rows);
  if (printable.length === 0) return "";

  const parts: string[] = opts?.omitSpan ? [] : [spanHtml(printable)];
  let lastYear = "";
  for (const row of printable) {
    const year = serviceWorkYear(row.date);
    if (year && year !== lastYear) {
      parts.push(`<p class="pdf-svc-year">${escapeHtml(year)}</p>`);
      lastYear = year;
    }
    parts.push(visitHtml(row));
  }
  return parts.join("\n");
}
