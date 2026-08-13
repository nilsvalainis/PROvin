/**
 * CarVertical atskaites (PDF teksta slānis) deterministiskā ekstrakcija:
 * „Odometra rādījumu ieraksti” → nobraukums, „Bojājumu ieraksti” → negadījumi,
 * „Laikposms” → valstu dzīves cikls, „Transportlīdzekļa specifikācija” + PR kodi →
 * OFICIĀLĀ DĪLERA DATI lauki.
 */

import type { LtabIncidentRow } from "@/lib/admin-source-blocks";
import {
  formatAutoRecordsDateForOutput,
  normalizeAutoRecordsOdometer,
  sortAutoRecordsDescending,
  type AutoRecordsServiceRow,
} from "@/lib/auto-records-paste-parse";
import { matchLeadingCountryNameLv, normalizeCountryNameLv } from "@/lib/country-names-lv";
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
import { mergeVendorServiceEntries, type VendorServiceEntry } from "@/lib/vendor-service-history";

const DAMAGE_VALUE_LABEL_RE = /^Aptuven[āa]\s+iepriek[šs]\s+g[ūu]to\s+boj[āa]jumu\s+v[ēe]rt[īi]ba/i;
const DAMAGE_HEADER_LOOKBACK = 40;

type DatedCountryLine = { index: number; date: string; country: string };

function normalizeMonthDate(raw: string): string {
  const t = raw.trim().replace(/\.$/, "");
  const ddmm = t.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (ddmm) return formatAutoRecordsDateForOutput(t);
  const mmYyyy = t.match(/^(\d{1,2})\.(\d{4})$/);
  if (mmYyyy) {
    const mo = Number.parseInt(mmYyyy[1]!, 10);
    if (mo < 1 || mo > 12) return "";
    return formatAutoRecordsDateForOutput(`${mmYyyy[1]}.${mmYyyy[2]}`);
  }
  return "";
}

/** „02.2019.Vācija” / „10.2025.Latvija” un datums atsevišķā rindā + valsts nākamajā. */
function collectDatedCountryLines(lines: string[]): DatedCountryLine[] {
  const out: DatedCountryLine[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.trim();
    const inline = line.match(/^(\d{1,2}(?:\.\d{1,2})?\.\d{4})\.\s*(.+)$/);
    if (inline) {
      const date = normalizeMonthDate(inline[1]!);
      const match = matchLeadingCountryNameLv(inline[2]!);
      if (date && match) {
        out.push({ index: i, date, country: match.country });
        continue;
      }
    }
    const bare = line.match(/^(\d{1,2}(?:\.\d{1,2})?\.\d{4})\.?$/);
    if (bare) {
      const date = normalizeMonthDate(bare[1]!);
      const next = (lines[i + 1] ?? "").trim();
      const match = next ? matchLeadingCountryNameLv(next) : null;
      if (date && match && match.rest === "") {
        out.push({ index: i, date, country: match.country });
      }
    }
  }
  return out;
}

/**
 * „Laikposms” fiksētie apkopes ieraksti („02.2024.Čehija” → „Veikta apkope”).
 * CarVertical PDF nesatur darbu sarakstu, tāpēc ieraksts ir tikai fakts par apkopi;
 * „Ieteicamais apkopes plāns” (plānotie darbi) šeit netiek ņemts — tas nav veikts darbs.
 */
function parseServiceTimelineEntries(
  lines: string[],
  datedCountries: DatedCountryLine[],
): VendorServiceEntry[] {
  const out: VendorServiceEntry[] = [];
  for (const header of datedCountries) {
    const title = (lines[header.index + 1] ?? "").trim() || (lines[header.index + 2] ?? "").trim();
    if (!/^Veikta\s+apkope$/i.test(title)) continue;
    out.push({
      date: header.date,
      odometer: "",
      country: header.country,
      category: "Apkope",
      works: [],
    });
  }
  return out;
}

function parseOdometerRows(lines: string[]): AutoRecordsServiceRow[] {
  const rows: AutoRecordsServiceRow[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    const m = line.match(/^(\d{1,2}(?:\.\d{1,2})?\.\d{4})\.\s*([\d][\d\s]*)\s*km(?![a-zāčēģīķļņšūž])/i);
    if (!m) continue;
    const date = normalizeMonthDate(m[1]!);
    const odometer = normalizeAutoRecordsOdometer(m[2]!);
    if (!date || !odometer) continue;
    rows.push({ date, odometer, country: "" });
  }
  return rows;
}

function parseDamageRows(
  lines: string[],
  datedCountries: DatedCountryLine[],
): { incidents: LtabIncidentRow[]; notes: string[] } {
  const incidents: LtabIncidentRow[] = [];
  const notes: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    if (!DAMAGE_VALUE_LABEL_RE.test(lines[i]!.trim())) continue;
    const amountRaw = [lines[i + 1] ?? "", lines[i + 2] ?? ""]
      .map((l) => l.trim())
      .find((l) => /\d/.test(l) && /[€$£]|EUR|CZK|PLN|SEK|NOK|DKK|CHF|GBP|USD|HUF|RON/i.test(l));
    if (!amountRaw) continue;

    const header = [...datedCountries]
      .filter((d) => d.index < i && i - d.index <= DAMAGE_HEADER_LOOKBACK)
      .pop();
    if (!header) continue;

    const conversion = convertAmountTextToEur(amountRaw);
    if (!conversion) continue;
    incidents.push({
      csngDate: header.date,
      lossAmount: conversion.display,
      incidentNo: header.country,
    });
    const note = describeEurConversion(amountRaw, conversion);
    if (note) notes.push(`${header.date}: ${note}`);
  }

  return { incidents, notes };
}

const SPEC_LABELS: { key: keyof OutvinVehicleInfo; re: RegExp }[] = [
  { key: "engineCode", re: /^Dzin[ēe]ja\s+kods$/i },
  { key: "model", re: /^Modelis$/i },
  { key: "generation", re: /^Mode[ļl]a\s+paaudze$/i },
  { key: "steeringSide", re: /^St[ūu]res\s+rata\s+novietojums$/i },
];

/** Specifikācijas vērtība var turpināties nākamajā rindā („LHD (automašīna ar stūri kreisajā” + „pusē)”). */
function specValueAt(lines: string[], labelIndex: number): string {
  const first = (lines[labelIndex + 1] ?? "").trim();
  if (!first) return "";
  const opens = (first.match(/\(/g) ?? []).length;
  const closes = (first.match(/\)/g) ?? []).length;
  if (opens <= closes) return first;
  const second = (lines[labelIndex + 2] ?? "").trim();
  if (!second || !second.includes(")")) return first;
  return `${first} ${second}`.replace(/\s+/g, " ");
}

function parseSpecSection(lines: string[]): {
  vehicleInfo: Partial<OutvinVehicleInfo>;
  colorCandidates: SpecCandidate[];
  transmissionCandidates: SpecCandidate[];
  transmissionName: string;
} {
  const vehicleInfo: Partial<OutvinVehicleInfo> = {};
  const colorCandidates: SpecCandidate[] = [];
  const transmissionCandidates: SpecCandidate[] = [];
  let transmissionType = "";
  let transmissionName = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.trim();
    const value = specValueAt(lines, i);
    if (!value || /^[-—–]$/.test(value)) continue;

    for (const { key, re } of SPEC_LABELS) {
      if (re.test(line) && !vehicleInfo[key]) vehicleInfo[key] = value;
    }
    if (/^Kr[āa]sa$/i.test(line)) colorCandidates.push({ value });
    if (/^Transmisijas\s+tips$/i.test(line) && !transmissionType) transmissionType = value;
    if (/^(Transmisijas\s+nosaukums|P[āa]rnesumk[āa]rbas\s+kods)$/i.test(line) && !transmissionName) {
      transmissionName = value;
    }
  }

  if (transmissionType || transmissionName) {
    transmissionCandidates.push({
      value: transmissionType || transmissionName,
      ...(transmissionType && transmissionName ? { code: transmissionName } : {}),
    });
  }

  return { vehicleInfo, colorCandidates, transmissionCandidates, transmissionName };
}

/** PR / aprīkojuma kodi: krāsa `LY8X/Havana Black Metallic/...`, salons `N5DValcona leather`. */
function parseEquipmentCodes(text: string): {
  colorCandidates: SpecCandidate[];
  interiorCandidates: SpecCandidate[];
  transmissionCandidates: SpecCandidate[];
} {
  const colorCandidates: SpecCandidate[] = [];
  const interiorCandidates: SpecCandidate[] = [];
  const transmissionCandidates: SpecCandidate[] = [];

  for (const m of text.matchAll(/\b([0-9A-Z]{3,4})\/([A-Za-z][A-Za-z' -]{2,40}?)\/\2/g)) {
    colorCandidates.push({ value: m[2]!.trim(), code: m[1]! });
  }
  for (const m of text.matchAll(/Kr[āa]sa:\s*([A-Za-z][A-Za-z' -]{2,40}?)(?=[A-ZĀČĒĢĪĶĻŅŠŪŽ][a-zāčēģīķļņšūž]|$|\n)/g)) {
    colorCandidates.push({ value: m[1]!.trim() });
  }
  // Polsterējuma nosaukums (Valcona/Milano/Nappa/Alcantara) ir precīzāks par vispārīgu „Leather package”.
  const NAMED_UPHOLSTERY_RE = /^(Valcona|Milano|Nappa|Feinnappa|Alcantara|Twin)/i;
  for (const m of text.matchAll(
    /(?<![A-Z0-9])([0-9A-Z]{3})((?:Valcona|Milano|Nappa|Alcantara|Feinnappa|Twin|Leather|leather|Fabric|fabric|Cloth|cloth)[A-Za-z ,/-]{0,40}?)(?=[0-9A-Z]{3}[A-Za-z]|$|\n)/g,
  )) {
    const value = m[2]!.trim();
    interiorCandidates.push({
      value,
      code: m[1]!,
      priority: NAMED_UPHOLSTERY_RE.test(value) ? 2 : 1,
    });
  }
  for (const m of text.matchAll(
    /(?<![A-Z0-9])([0-9A-Z]{3})(\d-speed\s+[a-z][A-Za-z -]{0,60}?)(?=[0-9A-Z]{3}[A-Za-z]|$|\n)/g,
  )) {
    transmissionCandidates.push({ value: m[2]!.trim(), code: m[1]! });
  }

  return { colorCandidates, interiorCandidates, transmissionCandidates };
}

/** CarVertical PDF teksts → strukturēti dati. */
export function extractCarverticalReport(rawText: string): VendorReportExtract {
  const out = emptyVendorReportExtract("carvertical");
  const text = sanitizePdfTextForParsing(rawText);
  if (!text.trim()) return out;

  const lines = text.split(/\r?\n/).map((l) => l.replace(/\u00a0/g, " ").trimEnd());
  const datedCountries = collectDatedCountryLines(lines);

  const timeline: CountryTimelineEntry[] = datedCountries
    .filter((d) => d.country)
    .map((d) => ({ date: d.date, country: normalizeCountryNameLv(d.country) || d.country }));

  const mileage = dedupeMileage(parseOdometerRows(lines));
  const { incidents, notes } = parseDamageRows(lines, datedCountries);

  const spec = parseSpecSection(lines);
  const equipment = parseEquipmentCodes(text);
  const vin = findVinInText(text);

  const color = pickMostSpecificSpec([...equipment.colorCandidates, ...spec.colorCandidates]);
  const interior = pickMostSpecificSpec(equipment.interiorCandidates);
  const transmissionPicked = pickMostSpecificSpec([
    ...spec.transmissionCandidates,
    ...equipment.transmissionCandidates,
  ]);
  // Saglabā abus kodus, ja izvēlētajā apzīmējumā nav pārnesumkārbas nosaukuma (piem. „PPE”).
  const transmission =
    transmissionPicked && spec.transmissionName && !transmissionPicked.includes(spec.transmissionName)
      ? `${transmissionPicked} · ${spec.transmissionName}`
      : transmissionPicked;

  out.mileage = sortAutoRecordsDescending(mileage);
  out.incidents = dedupeIncidents(incidents);
  out.serviceHistory = mergeVendorServiceEntries(
    parseServiceTimelineEntries(lines, datedCountries),
    [],
  );
  out.countryTimeline = timeline;
  out.notes = notes;
  out.vehicleInfo = {
    ...spec.vehicleInfo,
    ...(vin ? { vinCode: vin } : {}),
    ...(color ? { color } : {}),
    ...(interior ? { interior } : {}),
    ...(transmission ? { transmission } : {}),
  };
  return out;
}

function dedupeMileage(rows: AutoRecordsServiceRow[]): AutoRecordsServiceRow[] {
  const seen = new Set<string>();
  const out: AutoRecordsServiceRow[] = [];
  for (const r of rows) {
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
