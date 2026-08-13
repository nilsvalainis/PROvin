/**
 * AutoDNA atskaites (PDF teksta slānis) deterministiskā ekstrakcija:
 * „Transportlīdzekļa vēsture” notikumi → nobraukums + negadījumi + valstu laikposms,
 * „Transportlīdzekļa tehniskie dati” → OFICIĀLĀ DĪLERA DATI lauki.
 */

import type { LtabIncidentRow } from "@/lib/admin-source-blocks";
import {
  formatAutoRecordsDateForOutput,
  normalizeAutoRecordsOdometer,
  sortAutoRecordsDescending,
  type AutoRecordsServiceRow,
} from "@/lib/auto-records-paste-parse";
import { normalizeCountryNameLv } from "@/lib/country-names-lv";
import { convertAmountTextToEur, describeEurConversion } from "@/lib/currency-eur-convert";
import type { OutvinVehicleInfo } from "@/lib/outvin-dealer-types";
import { sanitizePdfTextForParsing } from "@/lib/pdf-text-sanitize-for-parse";
import type { CountryTimelineEntry } from "@/lib/vehicle-country-timeline";
import {
  emptyVendorReportExtract,
  findVinInText,
  pickMostSpecificSpec,
  type SpecCandidate,
  type VendorReportExtract,
} from "@/lib/vendor-report-extract";
import {
  isVendorServiceCategoryLine,
  isVendorServiceEventTitle,
  mergeVendorServiceEntries,
  type VendorServiceEntry,
} from "@/lib/vendor-service-history";

const HISTORY_END_RE =
  /^(Datu\s+interpret[āa]cijas|Iepriek[šs][ēe]jie\s+mekl[ēe]jumi|Apr[īi]kojums|Transportl[īi]dzek[ļl]a\s+arh[īi]va)/i;

/** Atskaites galvenes / kājenes rindas, kas mētājas notikumu blokos. */
function isNoiseLine(line: string): boolean {
  if (!line) return true;
  if (/^Auto\s+V[ēe]stures\s+Atskaite/i.test(line)) return true;
  if (/^P[āa]rbaudiet\s+zi[ņn]ojuma/i.test(line)) return true;
  if (/^[A-HJ-NPR-Z0-9]{17}$/.test(line)) return true;
  if (/Lapa\s*\d+\s*$/i.test(line) && /\d{4}-\d{2}-\d{2}/.test(line)) return true;
  if (/^(19|20)\d{2}$/.test(line)) return true;
  return false;
}

function isBareDateLine(line: string): string {
  const m = line.match(/^(\d{1,2}\.\d{1,2}\.\d{4}|\d{1,2}\.\d{4})\.?$/);
  if (!m) return "";
  return formatAutoRecordsDateForOutput(m[1]!);
}

type HistoryEvent = {
  date: string;
  lines: string[];
};

function extractHistorySection(lines: string[]): string[] {
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (!/^Transportl[īi]dzek[ļl]a\s+v[ēe]sture$/i.test(lines[i]!)) continue;
    const next = lines.slice(i + 1, i + 3).find((l) => l.trim().length > 0) ?? "";
    if (/^Ierakstu\s+skaits/i.test(next)) continue;
    start = i + 1;
    break;
  }
  if (start < 0) return [];
  const out: string[] = [];
  for (let i = start; i < lines.length; i++) {
    if (HISTORY_END_RE.test(lines[i]!)) break;
    out.push(lines[i]!);
  }
  return out;
}

function splitHistoryEvents(sectionLines: string[]): HistoryEvent[] {
  const events: HistoryEvent[] = [];
  let current: HistoryEvent | null = null;
  for (const raw of sectionLines) {
    const line = raw.replace(/\u00a0/g, " ").trim();
    if (isNoiseLine(line)) continue;
    const date = isBareDateLine(line);
    if (date) {
      current = { date, lines: [] };
      events.push(current);
      continue;
    }
    if (current) current.lines.push(line);
  }
  return events;
}

function eventOdometer(lines: string[]): string {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const inline = line.match(/Odometra\s+r[āa]d[īi]jums\s*([\d\s\u00a0]+)\s*km/i);
    if (inline) return normalizeAutoRecordsOdometer(inline[1]!);
    if (/^Odometra\s+r[āa]d[īi]jums$/i.test(line)) {
      const next = lines[i + 1] ?? "";
      const km = next.match(/^([\d\s\u00a0]+)\s*km$/i);
      if (km) return normalizeAutoRecordsOdometer(km[1]!);
    }
  }
  return "";
}

function eventCountry(lines: string[]): string {
  for (const line of lines) {
    const m = line.match(/^Valsts\s+(.+)$/i);
    if (m) return normalizeCountryNameLv(m[1]!.trim());
  }
  return "";
}

function eventLossAmountRaw(lines: string[]): string {
  const hasDamageHeading = lines.some((l) =>
    /zaud[ēe]jumu\s+apjoms|boj[āa]jumu\s+v[ēe]rt[īi]ba|apdro[šs]in[āa][šs]anas\s+atl[īi]dz/i.test(l),
  );
  if (!hasDamageHeading) return "";
  for (const line of lines) {
    const m = line.match(/^Summa\s+(.+)$/i);
    if (m && /\d/.test(m[1]!)) return m[1]!.trim();
  }
  return "";
}

/** Notikuma virsraksts = pirmā rinda, kas nav metadatu lauks („Odometra rādījums”, „Valsts …”). */
function eventTitle(lines: string[]): string {
  for (const line of lines) {
    if (!line.trim()) continue;
    if (EVENT_META_RE.test(line)) continue;
    return line.trim();
  }
  return "";
}

const EVENT_META_RE =
  /^(Odometra\s+r[āa]d[īi]jums|[\d\s]+km$|Valsts\b|Rezult[āa]ts\b|Atra[šs]an[āa]s\s+vieta\b|Summa\b|Cena\b|Deta[ļl]u\s+grupa|Boj[āa]jumu\s+zona|Tehnisk[āa]\s+apskate\s+der[īi]ga|Iepriek[šs][ēe]j[āa]s\s+re[ģg]istr[āa]cijas\s+valsts|Autost[āa]vvieta|Virsb[ūu]ves\s+kr[āa]sa|D[īi]lera\s+piesl[ēe]gums|D[īi]lera\s+pied[āa]v[āa]jums|-\s)/i;

/** Servisa punkts / pilsēta notikumā („Atrašanās vieta Rīga”) — atsevišķa kolonna tabulā. */
function eventLocation(lines: string[]): string {
  for (const line of lines) {
    const m = line.match(/^Atra[šs]an[āa]s\s+vieta\s+(.+)$/i);
    if (m) return m[1]!.replace(/\s+/g, " ").trim();
  }
  return "";
}

/** Veiktie darbi servisa notikumā (bez metadatiem un virsraksta). */
function eventServiceWorks(lines: string[], title: string): { category: string; works: string[] } {
  let category = "";
  const works: string[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line === title) continue;
    if (EVENT_META_RE.test(line)) continue;
    if (!category && isVendorServiceCategoryLine(line)) {
      category = line.replace(/[:.]$/, "").trim();
      continue;
    }
    works.push(line);
  }
  return { category, works };
}

function eventPriceRaw(lines: string[]): string {
  for (const line of lines) {
    const m = line.match(/^Cena\s+(.+)$/i);
    if (m && /\d/.test(m[1]!)) return m[1]!.trim();
  }
  return "";
}

const TECH_LABELS: { key: keyof OutvinVehicleInfo | "colorCandidate"; re: RegExp }[] = [
  { key: "transmission", re: /^[ĀA]trumk[āa]rbas\s+veids$/i },
  { key: "colorCandidate", re: /^([ŠS]asijas|Virsb[ūu]ves)\s+kr[āa]sa$/i },
];

function extractTechnicalData(lines: string[]): {
  vehicleInfo: Partial<OutvinVehicleInfo>;
  colorCandidates: SpecCandidate[];
} {
  const vehicleInfo: Partial<OutvinVehicleInfo> = {};
  const colorCandidates: SpecCandidate[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.trim();
    for (const { key, re } of TECH_LABELS) {
      if (!re.test(line)) continue;
      const value = (lines[i + 1] ?? "").trim();
      if (!value || /^[-—–]$/.test(value)) continue;
      if (key === "colorCandidate") colorCandidates.push({ value });
      else vehicleInfo[key] = value;
    }
    // Inline varianti: „Virsbūves krāsa Melns” (dīlera piedāvājuma notikums)
    const inlineColor = line.match(/^(?:Virsb[ūu]ves|[ŠS]asijas)\s+kr[āa]sa\s+(.+)$/i);
    if (inlineColor) colorCandidates.push({ value: inlineColor[1]!.trim() });
    const inlineGearbox = line.match(/^[ĀA]trumk[āa]rbas\s+veids\s+(.+)$/i);
    if (inlineGearbox) vehicleInfo.transmission = inlineGearbox[1]!.trim();
  }

  return { vehicleInfo, colorCandidates };
}

/** AutoDNA PDF teksts → strukturēti dati. */
export function extractAutodnaReport(rawText: string): VendorReportExtract {
  const out = emptyVendorReportExtract("autodna");
  const text = sanitizePdfTextForParsing(rawText);
  if (!text.trim()) return out;

  const lines = text.split(/\r?\n/).map((l) => l.replace(/\u00a0/g, " ").trimEnd());
  const events = splitHistoryEvents(extractHistorySection(lines));

  const mileage: AutoRecordsServiceRow[] = [];
  const incidents: LtabIncidentRow[] = [];
  const timeline: CountryTimelineEntry[] = [];
  const serviceHistory: VendorServiceEntry[] = [];

  for (const event of events) {
    const country = eventCountry(event.lines);
    if (country) timeline.push({ date: event.date, country });

    const odometer = eventOdometer(event.lines);
    if (odometer) mileage.push({ date: event.date, odometer, country });

    const title = eventTitle(event.lines);
    if (isVendorServiceEventTitle(title)) {
      const { category, works } = eventServiceWorks(event.lines, title);
      if (category || works.length > 0) {
        serviceHistory.push({
          date: event.date,
          odometer,
          country,
          category,
          location: eventLocation(event.lines),
          works,
        });
      }
    }

    const lossRaw = eventLossAmountRaw(event.lines);
    if (lossRaw) {
      const conversion = convertAmountTextToEur(lossRaw);
      if (conversion) {
        incidents.push({
          csngDate: event.date,
          lossAmount: conversion.display,
          incidentNo: country,
        });
        const note = describeEurConversion(lossRaw, conversion);
        if (note) out.notes.push(`${event.date}: ${note}`);
      }
    }

    const priceRaw = eventPriceRaw(event.lines);
    if (priceRaw && !lossRaw) {
      out.notes.push(`${event.date}: cenas/vērtības ieraksts „${priceRaw}” — nav negadījums.`);
    }
  }

  const { vehicleInfo, colorCandidates } = extractTechnicalData(lines);
  const vin = findVinInText(text);
  const color = pickMostSpecificSpec(colorCandidates);

  out.mileage = sortAutoRecordsDescending(dedupeMileage(mileage));
  out.incidents = dedupeIncidents(incidents);
  out.serviceHistory = mergeVendorServiceEntries(serviceHistory, []);
  out.countryTimeline = timeline;
  out.vehicleInfo = {
    ...vehicleInfo,
    ...(vin ? { vinCode: vin } : {}),
    ...(color ? { color } : {}),
  };
  return out;
}

function dedupeMileage(rows: AutoRecordsServiceRow[]): AutoRecordsServiceRow[] {
  const seen = new Set<string>();
  const out: AutoRecordsServiceRow[] = [];
  for (const r of rows) {
    if (!r.date || !r.odometer) continue;
    const key = `${r.date}|${r.odometer}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}

function dedupeIncidents(rows: LtabIncidentRow[]): LtabIncidentRow[] {
  const seen = new Set<string>();
  const out: LtabIncidentRow[] = [];
  for (const r of rows) {
    const key = `${r.csngDate}|${r.lossAmount}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}
