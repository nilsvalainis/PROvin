/**
 * Oficiālā dīlera / rūpnīcas PDF (BMW dīlera portāls, auto-records.com) → `VendorReportExtract`.
 *
 * Deterministiski: transporta informācijas lauki, rūpnīcas komplektācija, odometra rādījumi
 * (vienmēr kilometros), servisa apmeklējumi ar veiktajiem darbiem un faktu kopsavilkums
 * laukam „Servisa vēsture”. Nekas netiek izdomāts — viss nāk no izdrukas.
 */

import {
  formatAutoRecordsDateForOutput,
  sortAutoRecordsDescending,
  type AutoRecordsServiceRow,
} from "@/lib/auto-records-paste-parse";
import { parseAutoRecordsOdometerTable } from "@/lib/auto-records-odometer-table-parse";
import { parseOutvinVehicleInfoFromAutoRecordsText } from "@/lib/auto-records-vehicle-info-parse";
import {
  looksLikeBmwDealerReport,
  parseBmwDealerReport,
  type BmwDealerKeyRead,
  type BmwDealerReportParse,
  type BmwDealerVisit,
} from "@/lib/bmw-dealer-report-parse";
import { normalizeCountryNameLv } from "@/lib/country-names-lv";
import { OUTVIN_NO_RECORDS_LV, type OutvinEquipmentLine } from "@/lib/outvin-dealer-types";
import { sanitizePdfTextForParsing } from "@/lib/pdf-text-sanitize-for-parse";
import { serviceWorkTermLv, serviceWorkTermsLv } from "@/lib/service-work-term-lv";
import type { CountryTimelineEntry } from "@/lib/vehicle-country-timeline";
import { emptyVendorReportExtract, type VendorReportExtract } from "@/lib/vendor-report-extract";
import type { VendorServiceEntry } from "@/lib/vendor-service-history";

/** Vai teksts ir oficiālā dīlera / rūpnīcas izdruka (nevis vēstures portāla atskaite). */
export function looksLikeDealerReport(text: string): boolean {
  if (looksLikeBmwDealerReport(text)) return true;
  return /VEHICLE\s+INFORMATION/i.test(text) && /ODOMETER\s+CHECK/i.test(text);
}

/** Detaļu / darbu nosaukumi izdrukā → latviski pēc nozīmes (`lib/service-work-term-lv.ts`). */
export function dealerPartNameLv(raw: string): string {
  return serviceWorkTermLv(raw);
}

const COUNTRY_IN_DEALER_NAME: { re: RegExp; country: string }[] = [
  { re: /\bDeutschland\b|\bGermany\b/i, country: "Vācija" },
  { re: /\bFrance\b|\bFrankreich\b/i, country: "Francija" },
  { re: /\bNederland\b|\bNetherlands\b/i, country: "Nīderlande" },
  { re: /\b[ÖO]sterreich\b|\bAustria\b/i, country: "Austrija" },
  { re: /\bSchweiz\b|\bSwitzerland\b/i, country: "Šveice" },
  { re: /\bPolska\b|\bPoland\b/i, country: "Polija" },
  { re: /\bLatvija\b|\bLatvia\b/i, country: "Latvija" },
  { re: /\bLietuva\b|\bLithuania\b/i, country: "Lietuva" },
  { re: /\bEesti\b|\bEstonia\b/i, country: "Igaunija" },
  { re: /\bSverige\b|\bSweden\b/i, country: "Zviedrija" },
  { re: /\bDanmark\b|\bDenmark\b/i, country: "Dānija" },
  { re: /\bItalia\b|\bItaly\b/i, country: "Itālija" },
  { re: /\bEspa[ñn]a\b|\bSpain\b/i, country: "Spānija" },
];

/** Valsts tikai tad, ja tā ir tieši nosaukta servisa punkta nosaukumā. */
export function countryFromDealerName(dealer: string): string {
  const hit = COUNTRY_IN_DEALER_NAME.find(({ re }) => re.test(dealer));
  return hit ? hit.country : "";
}

function groupDigits(value: string): string {
  return value.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function kmLabel(odometer: string): string {
  const digits = odometer.replace(/\D/g, "");
  return digits ? `${groupDigits(digits)} km` : "";
}

function visitToServiceEntry(visit: BmwDealerVisit): VendorServiceEntry {
  const works = serviceWorkTermsLv(visit.parts);
  return {
    date: visit.date,
    odometer: visit.odometer,
    country: countryFromDealerName(visit.dealer),
    category: "",
    // Servisa punkts ir atsevišķa kolonna — tas nedrīkst salipt ar veiktajiem darbiem.
    location: visit.dealer,
    works: works.length > 0 ? works : ["detalizēts darbu saraksts atskaitē nav pieejams"],
  };
}

/**
 * Key Read History nav remonts — tas ir CBS nolasījums (datums, km, termiņi).
 * Tabulā paliek nolasījumi, kas nav tas pats datums+km kā servisa apmeklējums
 * (apmeklējuma rinda jau rāda veiktos darbus). Identiski termiņi starp nolasījumiem
 * ir īsti CBS dati — tos neizmetam, citādi pēdējais plato nolasījums pazūd, kad
 * tas sakrīt ar apkopes vizīti.
 */
function keyReadToServiceEntry(read: BmwDealerKeyRead): VendorServiceEntry {
  const works = read.dueDates
    .map(({ component, dueDate }) => {
      const name = dealerPartNameLv(component);
      if (!name) return "";
      return dueDate ? `${name} (līdz ${dueDate})` : name;
    })
    .filter(Boolean);
  return {
    date: read.date,
    odometer: read.odometer,
    country: countryFromDealerName(read.dealer),
    category: "CBS nolasījums",
    location: read.dealer.trim(),
    works,
  };
}

function visitIdentityKey(date: string, odometer: string): string {
  return `${date.trim()}|${odometer.replace(/\D/g, "")}`;
}

function dateSortKey(date: string): number {
  const m = date.trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  return m ? Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1])) : 0;
}

/** Faktu kopsavilkums laukam „Servisa vēsture” (bez vērtējumiem un secinājumiem). */
export function buildBmwDealerServiceFacts(parse: BmwDealerReportParse): string {
  const lines: string[] = [];
  const vi = parse.vehicleInfo;
  const title = [vi.model, vi.vinCode ? `VIN ${vi.vinCode}` : ""].filter(Boolean).join(" · ");
  if (title) lines.push(`Oficiālā dīlera dati: ${title}.`);

  const build = [
    vi.productionDate ? `ražots ${vi.productionDate}` : "",
    vi.firstRegistration ? `pirmā reģistrācija ${vi.firstRegistration}` : "",
    vi.warrantyStartDate ? `garantija no ${vi.warrantyStartDate}` : "",
    vi.countryRegion ? `piegādes reģions ${vi.countryRegion}` : "",
  ].filter(Boolean);
  if (build.length > 0) lines.push(`${capitalize(build.join(" · "))}.`);

  const visits = [...parse.visits].sort((a, b) => dateSortKey(a.date) - dateSortKey(b.date));
  if (visits.length > 0) {
    const first = visits[0]!;
    const last = visits[visits.length - 1]!;
    const span = [
      `${first.date}${first.odometer ? ` (${kmLabel(first.odometer)})` : ""}`,
      `${last.date}${last.odometer ? ` (${kmLabel(last.odometer)})` : ""}`,
    ];
    lines.push(`Servisa un remontu ieraksti: ${visits.length} - no ${span[0]} līdz ${span[1]}.`);

    const byDealer = new Map<string, number>();
    for (const visit of visits) {
      const dealer = visit.dealer.trim();
      if (!dealer) continue;
      byDealer.set(dealer, (byDealer.get(dealer) ?? 0) + 1);
    }
    const dealerParts = [...byDealer.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([dealer, count]) => `${dealer} - ${count}`);
    if (dealerParts.length > 0) lines.push(`Servisa punkti: ${dealerParts.join("; ")}.`);
  } else if (parse.serviceHistoryEmpty) {
    lines.push("Servisa vēstures sadaļa atskaitē: ierakstu nav.");
  }

  const keyReads = [...parse.keyReads].sort((a, b) => dateSortKey(b.date) - dateSortKey(a.date));
  const latest = keyReads[0];
  if (latest) {
    lines.push(
      `Atslēgas nolasījumi (Key Read History): ${keyReads.length} - pēdējais ${latest.date} · ${kmLabel(latest.odometer)}.`,
    );
    // Tendence, ne tikai pēdējais nolasījums: pilna Key Read vēsture var sniegt līdz pat
    // vairākiem desmitiem nolasījumu — atlikušie 3 jaunākie parāda, kā termiņi mainījušies,
    // nevis atmet vēsturi uz vienu momentuzņēmumu.
    for (const read of keyReads.slice(0, 3)) {
      if (read.dueDates.length === 0) continue;
      const due = read.dueDates
        .slice(0, 4)
        .map(({ component, dueDate }) => `${component} - ${dueDate}`)
        .join("; ");
      lines.push(`Termiņi (${read.date} · ${kmLabel(read.odometer)}): ${due}.`);
    }
  }

  if (parse.equipment.length > 0) {
    lines.push(`Rūpnīcas komplektācija: ${parse.equipment.length} pozīcijas (sadaļā „Komplektācija”).`);
  }

  return lines.join("\n");
}

function capitalize(value: string): string {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

function mileageFromBmw(parse: BmwDealerReportParse): AutoRecordsServiceRow[] {
  const rows: AutoRecordsServiceRow[] = [];
  const seenDates = new Set<string>();

  for (const read of parse.keyReads) {
    if (!read.date || !read.odometer) continue;
    rows.push({ date: read.date, odometer: read.odometer, country: "" });
    seenDates.add(read.date);
  }
  // Servisa apmeklējums bez atslēgas nolasījuma tajā datumā arī ir odometra ieraksts.
  for (const visit of parse.visits) {
    if (!visit.date || !visit.odometer || seenDates.has(visit.date)) continue;
    seenDates.add(visit.date);
    rows.push({ date: visit.date, odometer: visit.odometer, country: countryFromDealerName(visit.dealer) });
  }
  return sortAutoRecordsDescending(rows);
}

function timelineFromBmw(parse: BmwDealerReportParse): CountryTimelineEntry[] {
  const out: CountryTimelineEntry[] = [];
  for (const visit of parse.visits) {
    const country = countryFromDealerName(visit.dealer);
    if (!visit.date || !country) continue;
    out.push({ date: visit.date, country });
  }
  return out;
}

function extractBmw(text: string): VendorReportExtract {
  const out = emptyVendorReportExtract("dealer");
  const parse = parseBmwDealerReport(text);

  out.vehicleInfo = parse.vehicleInfo;
  out.equipment = parse.equipment;
  out.mileage = mileageFromBmw(parse);
  out.countryTimeline = timelineFromBmw(parse);
  const visitEntries = parse.visits.filter((v) => v.date).map(visitToServiceEntry);
  const visitKeys = new Set(visitEntries.map((e) => visitIdentityKey(e.date, e.odometer)));
  const keyReadEntries = parse.keyReads
    .filter((r) => r.date && r.dueDates.length > 0 && !visitKeys.has(visitIdentityKey(r.date, r.odometer)))
    .map(keyReadToServiceEntry)
    .filter((e) => e.works.length > 0);
  out.serviceHistory = [...visitEntries, ...keyReadEntries].sort(
    (a, b) => dateSortKey(b.date) - dateSortKey(a.date),
  );
  out.serviceHistoryNotes = buildBmwDealerServiceFacts(parse);
  return out;
}

function equipmentFromAutoRecords(text: string): OutvinEquipmentLine[] {
  const start = text.search(/EQUIPMENT\s+LIST/i);
  if (start < 0) return [];
  const section = text.slice(start).split(/\n\s*\n/)[0] ?? "";
  const out: OutvinEquipmentLine[] = [];
  const seen = new Set<string>();
  // Izdrukā divas kolonnas mēdz salipt vienā rindā („… WHEELS0785 - …”), tāpēc nākamais
  // kods tiek meklēts bez vārda robežas prasības.
  for (const m of section.matchAll(/(S[0-9A-Z]{4})\s*-\s*([^\n]*?)(?=S[0-9A-Z]{4}\s*-|\n|$)/g)) {
    const code = m[1] ?? "";
    const description = (m[2] ?? "").replace(/\s+/g, " ").trim();
    if (!code || !description || seen.has(code)) continue;
    seen.add(code);
    out.push({ code, description: description.slice(0, 400) });
  }
  return out;
}

function checkText(text: string, heading: RegExp): string {
  const lines = text.split(/\r?\n/).map((l) => l.trim());
  const index = lines.findIndex((l) => heading.test(l));
  if (index < 0) return "";
  const value = lines.slice(index + 1).find((l) => l.length > 0) ?? "";
  if (!value || /^(equipment\s+list|odometer\s+check|stolen)/i.test(value)) return "";
  return /^no\s+records\s+found/i.test(value) ? OUTVIN_NO_RECORDS_LV : value.slice(0, 2000);
}

function extractAutoRecordsDealer(text: string): VendorReportExtract {
  const out = emptyVendorReportExtract("dealer");
  out.vehicleInfo = parseOutvinVehicleInfoFromAutoRecordsText(text);
  out.equipment = equipmentFromAutoRecords(text);
  out.accidentCheck = checkText(text, /^ACCIDENT\s+CHECK$/i);
  out.stolenCheck = checkText(text, /^STOLEN\s+VEHICLE\s+DATABASE$/i);

  const rows = parseAutoRecordsOdometerTable(text).map((r) => ({
    date: formatAutoRecordsDateForOutput(r.date) || r.date,
    odometer: r.odometer.replace(/\D/g, ""),
    country: normalizeCountryNameLv(r.country) || r.country,
  }));
  out.mileage = sortAutoRecordsDescending(rows.filter((r) => r.date && r.odometer));
  out.countryTimeline = out.mileage
    .filter((r) => r.country)
    .map((r) => ({ date: r.date, country: r.country }));

  const facts: string[] = [];
  const vi = out.vehicleInfo;
  const title = [vi.model, vi.vinCode ? `VIN ${vi.vinCode}` : ""].filter(Boolean).join(" · ");
  if (title) facts.push(`Oficiālā dīlera dati: ${title}.`);
  if (out.mileage.length > 0) {
    const chrono = [...out.mileage].sort((a, b) => dateSortKey(a.date) - dateSortKey(b.date));
    const first = chrono[0]!;
    const last = chrono[chrono.length - 1]!;
    facts.push(
      `Servisa apmeklējumu odometra ieraksti: ${chrono.length} - no ${first.date} (${kmLabel(first.odometer)}) līdz ${last.date} (${kmLabel(last.odometer)}).`,
    );
    const countries = [...new Set(chrono.map((r) => r.country).filter(Boolean))];
    if (countries.length > 0) facts.push(`Ierakstos norādītās valstis: ${countries.join(", ")}.`);
  }
  if (out.accidentCheck) facts.push(`Negadījumu pārbaude: ${out.accidentCheck}`);
  if (out.stolenCheck) facts.push(`Nozagto transportlīdzekļu reģistrs: ${out.stolenCheck}`);
  if (out.equipment.length > 0) {
    facts.push(`Rūpnīcas komplektācija: ${out.equipment.length} pozīcijas (sadaļā „Komplektācija”).`);
  }
  out.serviceHistoryNotes = facts.join("\n");
  return out;
}

/** Dīlera PDF teksts → strukturēti dati (BMW portāls vai auto-records.com). */
export function extractDealerReport(rawText: string): VendorReportExtract {
  const text = sanitizePdfTextForParsing(rawText);
  if (!text.trim()) return emptyVendorReportExtract("dealer");
  if (looksLikeBmwDealerReport(text)) return extractBmw(text);
  return extractAutoRecordsDealer(text);
}
