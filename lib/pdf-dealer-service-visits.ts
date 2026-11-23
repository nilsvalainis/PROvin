/**
 * OFICIĀLĀ DĪLERA DATI PDF: servisa vizītes (koncepts A), ne četru kolonnu tabula.
 */
import { sanitizeMileageCountryField } from "@/lib/auto-records-paste-parse";
import {
  translateClientReportStatic,
  translateDealerHighlightDetail,
  type ClientReportLang,
} from "@/lib/client-report-i18n";
import { countryLabelToIso2, normalizeCountryName } from "@/lib/country-names-lv";
import {
  autoRecordsServiceWorkRowIsPrintable,
  formatServiceWorkOdometer,
  mergeAutoRecordsServiceWorksByOdometer,
  normalizeAutoRecordsServiceWorkRow,
  type AutoRecordsServiceWorkRow,
} from "@/lib/auto-records-service-works";
import { findDealerOdometerDrops, type DealerOdometerDrop } from "@/lib/dealer-odometer-checks";
import { countryFromDealerName } from "@/lib/dealer-report-extract";
import {
  buildDealerGapMarkerHtml,
  classifyDealerVisitKind,
  classifyDealerVisitKinds,
  dealerPdfWorkLines,
  dealerVisitGapResolver,
  dealerVisitKindLabel,
  filterDealerPdfVisitRows,
  isDealerServiceGap,
  type DealerVisitKind,
  type DealerVisitMajorMark,
} from "@/lib/pdf-dealer-timeline";
import { polishDealerWorkLinesLv } from "@/lib/dealer-work-lv-polish";
import { inferServiceWorkCountries } from "@/lib/service-works-country";
import { formatServiceWorksLines } from "@/lib/service-works-lines";
import type { CountryTimelineEntry } from "@/lib/vehicle-country-timeline";
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

/** „Nezināmā” / „Nezināma valsts” nav vieta - tukšu vietu nerāda vispār. */
const UNKNOWN_PLACE_RE = /^nezin[āa]m/i;

function knownCountry(raw: string, lang: ClientReportLang): string {
  const t = raw.trim();
  if (!t || UNKNOWN_PLACE_RE.test(t) || !countryLabelToIso2(t)) return "";
  return normalizeCountryName(t, lang);
}

export function formatDealerServicePlace(
  location: string,
  lang: ClientReportLang = "lv",
): { place: string; country: string } {
  const raw = location.replace(/\s+/g, " ").trim();
  if (!raw || UNKNOWN_PLACE_RE.test(raw)) return { place: "", country: "" };
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
  // Vieta ir tikai valsts nosaukums citā valodā („Germany” + „Vācija”) - dublēšana, rāda tikai valsti.
  if (country && place && placeIsSameCountry(place, country, lang)) place = "";
  return { place, country };
}

/** Vai vietas teksts ir tikai tās pašas valsts nosaukums (jebkurā valodā), ne pilsēta / reģions / dīleris. */
function placeIsSameCountry(place: string, country: string, lang: ClientReportLang): boolean {
  const iso = countryLabelToIso2(place);
  if (!iso || iso !== countryLabelToIso2(country)) return false;
  // ASV štats / Kanādas province ir precīzāka vieta par valsti - to nenoņem.
  if ((iso === "US" || iso === "CA") && !US_CA_COUNTRY_NAME_RE.test(place.trim())) return false;
  return normalizeCountryName(place, lang).toLowerCase() === country.toLowerCase();
}

const US_CA_COUNTRY_NAME_RE =
  /^(?:usa|us|u\.s\.a?\.?|united\s+states(?:\s+of\s+america)?|amerika|asv|canada|kan[āa]da)$/i;

function workLines(raw: string, hideKeyReadLines: boolean): string[] {
  return dealerPdfWorkLines(formatServiceWorksLines(raw), { hideKeyReadLines })
    .map((line) => line.trim())
    .filter((line) => line && !PLACEHOLDER_WORKS_RE.test(line) && !isVendorServiceCategoryLine(line));
}

function visitWorksHtml(raw: string, hideKeyReadLines: boolean, lang: ClientReportLang): string {
  const lines = polishDealerWorkLinesLv(workLines(raw, hideKeyReadLines), {
    maintenanceVisit: classifyDealerVisitKind(raw) === "maintenance",
  });
  if (lines.length === 0) {
    return `<p class="pdf-svc-empty">${escapeHtml(translateClientReportStatic(EMPTY_WORKS_NOTE, lang))}</p>`;
  }
  return `<ul class="pdf-svc-works">${lines
    .map((line) => `<li class="pdf-svc-work">${escapeHtml(line)}</li>`)
    .join("")}</ul>`;
}

function visitPlaceHtml(location: string, lang: ClientReportLang, inferredCountry = ""): string {
  const own = formatDealerServicePlace(location, lang);
  const place = own.place;
  const inferredRaw = UNKNOWN_PLACE_RE.test(inferredCountry.trim()) ? "" : inferredCountry.trim();
  const inferred = !own.country && inferredRaw ? normalizeCountryName(inferredRaw, lang) : "";
  const country = own.country || inferred;
  if (!place && !country) return "";
  const mark = inferred ? ` data-country-inferred="1"` : "";
  if (place && country && !place.toLowerCase().includes(country.toLowerCase())) {
    return `<p class="pdf-svc-place">${escapeHtml(place)} <span${mark}>· ${escapeHtml(country)}</span></p>`;
  }
  return `<p class="pdf-svc-place"${place ? "" : mark}>${escapeHtml(place || country)}</p>`;
}

function visitKindTagHtml(works: string, lang: ClientReportLang): string {
  const { primary, secondary } = classifyDealerVisitKinds(works);
  const tag = (kind: DealerVisitKind) =>
    `<span class="pdf-svc-tag pdf-svc-tag--${kind}">${escapeHtml(translateClientReportStatic(dealerVisitKindLabel(kind), lang))}</span>`;
  return secondary ? `${tag(primary)}<span class="pdf-svc-tag-plus">+</span>${tag(secondary)}` : tag(primary);
}

/** Lucide „triangle-alert” - bojājuma remonts. Inline SVG, lai PDF drukā vienādi (arī melnbaltā). */
const HL_ICON_ACCIDENT = `<svg class="pdf-svc-hl__ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>`;

/** Lucide „settings” (zobrats) - liels mehāniskais mezgls. */
const HL_ICON_MECHANICAL = `<svg class="pdf-svc-hl__ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>`;

/** Galvenes josla: ikona + kategorija + īsa precizācija (piem. „Bojājuma remonts - priekšā labajā pusē”). */
function highlightHeadHtml(marks: readonly DealerVisitMajorMark[], lang: ClientReportLang): string {
  const items = marks
    .map((m) => {
      const icon = m.category === "accident" ? HL_ICON_ACCIDENT : HL_ICON_MECHANICAL;
      const detail = m.detail
        ? `<span class="pdf-svc-hl__detail">- ${escapeHtml(translateDealerHighlightDetail(m.detail, lang))}</span>`
        : "";
      return `<span class="pdf-svc-hl__item pdf-svc-hl__item--${m.category}">${icon}<b>${escapeHtml(translateClientReportStatic(m.label, lang))}</b>${detail}</span>`;
    })
    .join("");
  return `<div class="pdf-svc-hl">${items}</div>`;
}

/**
 * Odometra nesakritība pret iepriekšējo ierakstu. Vairumā gadījumu tā ir ievades kļūda - neitrāla piezīme;
 * sarkanā (datu problēma) tikai būtisks kritums, kas secībā neatgūstas.
 */
function odometerDropNoteHtml(drop: DealerOdometerDrop, lang: ClientReportLang): string {
  const prev = [formatServiceWorkOdometer(drop.previous.odometer), drop.previous.date.trim()]
    .filter(Boolean)
    .join(", ");
  const significant = drop.severity === "significant";
  const label = translateClientReportStatic(
    significant
      ? "Nobraukums mazāks nekā iepriekšējā ierakstā"
      : "Iespējama nobraukuma ievades kļūda: iepriekšējā ierakstā",
    lang,
  );
  const text = significant ? `${label} (${prev})` : `${label} ${prev}`;
  return `<p class="pdf-svc-empty${significant ? " pdf-svc-empty--nodata" : ""}">${escapeHtml(text)}</p>`;
}

function visitHtml(
  row: AutoRecordsServiceWorkRow,
  hideKeyReadLines: boolean,
  lang: ClientReportLang,
  inferredCountry = "",
  marks: readonly DealerVisitMajorMark[] = [],
  odometerDrop: DealerOdometerDrop | null = null,
): string {
  const date = row.date.trim();
  const odo = formatServiceWorkOdometer(row.odometer);
  const dateHtml = date
    ? `<time class="pdf-svc-date">${escapeHtml(date)}</time>`
    : `<span class="pdf-svc-date pdf-svc-date--empty"></span>`;
  const km = odo
    ? `<span class="pdf-svc-km${odometerDrop?.severity === "significant" ? " pdf-svc-km--nodata" : ""}">${escapeHtml(odo)}</span>`
    : "";
  const place = visitPlaceHtml(row.location, lang, inferredCountry);
  const tag = visitKindTagHtml(row.works, lang);
  const chips = `<div class="pdf-svc-chips">${tag}${km}</div>`;
  const head = `<div class="pdf-svc-box-top">${place}${chips}</div>`;
  const dropNote = odometerDrop ? odometerDropNoteHtml(odometerDrop, lang) : "";
  const content = `${head}${visitWorksHtml(row.works, hideKeyReadLines, lang)}${dropNote}`;
  const box =
    marks.length === 0
      ? `<article class="pdf-svc-box">${content}</article>`
      : `<article class="pdf-svc-box pdf-svc-box--hl pdf-svc-box--${
          marks.some((m) => m.category === "accident") ? "accident" : "mechanical"
        }">${highlightHeadHtml(marks, lang)}<div class="pdf-svc-box-in">${content}</div></article>`;
  return `<div class="pdf-svc-visit pdf-svc-kind--${classifyDealerVisitKind(row.works)}">
    ${dateHtml}
    <span class="pdf-svc-rail" aria-hidden="true"><span class="pdf-svc-dot"></span></span>
    ${box}
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
  /**
   * Citu avotu valstu laika josla (bez sludinājumiem): vizītei bez valsts to secina tikai droši
   * (tas pats mēnesis vai abi kaimiņi vienā valstī). Saglabātos datus nemaina.
   */
  countryEvidence?: CountryTimelineEntry[];
  /** Lielo darbu atzīmes vizītei (tie paši ieraksti kā kopsavilkumā, ar operatora labojumiem). */
  majorMarksForRow?: (row: AutoRecordsServiceWorkRow) => DealerVisitMajorMark[];
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
  const evidence = opts?.countryEvidence ?? [];
  const countries = evidence.length > 0 ? inferServiceWorkCountries(printable, evidence) : [];
  const parts: string[] = opts?.omitSpan ? [] : [spanHtml(printable, { lang })];
  const gapBetween = dealerVisitGapResolver(printable);
  const drops = new Map(findDealerOdometerDrops(printable).map((d) => [d.row, d]));
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
    const info = countries[i];
    const marks = opts?.majorMarksForRow ? opts.majorMarksForRow(row) : [];
    const visit = visitHtml(
      row,
      hideKeyReadLines,
      lang,
      info?.countryInferred ? info.country : "",
      marks,
      drops.get(row) ?? null,
    );
    const older = printable[i + 1];
    const gap = older != null ? gapBetween(older, row) : null;
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
