/**
 * AutoDNA / CarVertical PDF aģenta AI kontrakts: sistēmas instrukcija, JSON shēma
 * un atbildes normalizācija uz `VendorReportExtract`.
 *
 * Summas AI atgriež TĀ, KĀ TĀS IR ATSKAITĒ (ar valūtu) — pārrēķinu uz EUR veic kods
 * (`convertAmountTextToEur`), lai modelis nerēķina un nesajauc vērtību ar zaudējumiem.
 */

import { JsonType, type AiJsonSchema } from "@/lib/ai-json-schema";

import type { LtabIncidentRow } from "@/lib/admin-source-blocks";
import {
  formatAutoRecordsDateForOutput,
  normalizeAutoRecordsOdometer,
  type AutoRecordsServiceRow,
} from "@/lib/auto-records-paste-parse";
import { normalizeCountryNameLv } from "@/lib/country-names-lv";
import { convertAmountTextToEur, describeEurConversion } from "@/lib/currency-eur-convert";
import { OUTVIN_VEHICLE_INFO_ROWS, type OutvinVehicleInfo } from "@/lib/outvin-dealer-types";
import { serviceWorkTermsLv } from "@/lib/service-work-term-lv";
import type { CountryTimelineEntry } from "@/lib/vehicle-country-timeline";
import {
  emptyVendorReportExtract,
  type VendorReportExtract,
  type VendorReportVendor,
} from "@/lib/vendor-report-extract";
import {
  isVendorServiceCategoryLine,
  isVendorServiceEventTitle,
  looksLikeCbsKeyReadServiceEntry,
  mergeVendorServiceEntries,
  type VendorServiceEntry,
} from "@/lib/vendor-service-history";

export const VENDOR_PDF_AGENT_SYSTEM = `You are the PROVIN.LV vehicle-history PDF extraction agent for ONE report (AutoDNA, CarVertical or an official dealer / factory printout such as a BMW dealer portal export or auto-records.com vehicle information).
Every vendor PDF follows a similar but slightly different layout — read the attached PDF like a human expert, section by section, and return ONLY the JSON described by the schema.

ABSOLUTE RULES
- Never invent data. Every date, odometer value, amount and country must be visible in this PDF.
- Never skip rows: extract EVERY odometer record and EVERY damage/claim record, including duplicates across sections.
- Output language for countries: Latvian names (Latvija, Vācija, Čehija, Polija, Lietuva …). "Čehijas Republika" → "Čehija".

1) DATES
- Always DD.MM.YYYY. If the report shows only MM.YYYY (e.g. 06.2023), use day 01 → 01.06.2023.
- Never output a year-only date. Never guess a day that is not printed — use 01.

2) ODOMETER (mileage)
- Sources: AutoDNA „TRANSPORTLĪDZEKĻA VĒSTURE” events with „Odometra rādījums … km”; CarVertical „Odometra rādījumu ieraksti” (both columns) and mileage chart table.
- odometer = digits only, no "km", no spaces.
- One row per record; keep even suspicious/rollback readings (e.g. mileage-fraud flagged row).

3) COUNTRY (per record)
- Use the country printed on the record: AutoDNA „Valsts …”; CarVertical damage header „MM.YYYY.<Valsts>”.
- CarVertical odometer rows have NO country column. Derive it from the report's own country timeline: „Laikposms” („Transportlīdzekļa ierakstu laikposms”), „Juridiskā statusa pārbaude” (Apdrošināts / Ievests / TA), registration events.
- Fill the country only when the timeline makes it certain (~99%): the same month is covered by that country, or the periods before AND after the record are the same country.
- If the timeline is ambiguous (e.g. the month of an import/export/re-registration) or the country is „Nezināma valsts” → leave country empty "". Never guess.

4) COUNTRY TIMELINE (countryTimeline)
- Return EVERY dated country record you can see (Laikposms entries, insurance, inspections, registration, damage headers) as {date, country}. This is the shared evidence pool used to fill missing countries — it is as important as the tables.

5) INCIDENTS (damage / claims)
- AutoDNA: „Transportlīdzekļa zaudējumu apjoms” → „Summa 510 000 - 520 000 CZK”.
- CarVertical: „Bojājumu ieraksti” → „Aptuvenā iepriekš gūto bojājumu vērtība” → „8501 € – 9000 €”.
- amountRaw: copy the amount EXACTLY as printed, including range and currency ("510 000 - 520 000 CZK", "8501 € – 9000 €"). currency: ISO code you see (CZK, EUR, PLN, SEK …). Do NOT convert — PROVIN converts to EUR in code.
- NOT incidents (never output them): „Cena”, „Pēdējā zināmā pārdošanas cena”, „Tirgus vērtība”, „Vērtība”, dealer listing prices, market value tables, „Remonta izmaksu reitings” percentages, service cost estimates.

6) SERVICE / REPAIR HISTORY (serviceHistory) — maintenance and repairs WITH the work items
- AutoDNA: „Transportlīdzekļu apkalpošana vai apskate” events → the work list printed inside the event („Regulārā apkope” + „Eļļas maiņa”, „Salona gaisa filtra maiņa”, „Bremžu šķidruma maiņa”, „Degvielas filtra maiņa”, „Pirms piegādes sagatavošana”, repairs). Also „Veikta apkope” / service or repair events in other reports.
- One object per event: {date, odometer, category ("Regulārā apkope" / "Remonts" / ""), location, works: ["Eļļas maiņa", …], country}. Never summarise, merge or drop a work item, and never invent one.
- location = the workshop / dealer / place where the work was done, exactly as printed („Niederlassung Bonn BMW AG, Bonn”, „B&K Deutschland GmbH, Osnabrück”, AutoDNA „Atrašanās vieta Rīga” → „Rīga”). It is a SEPARATE field — the place must NEVER appear inside works or category. Leave "" when the report does not name a place.
- works language: Latvian. If the report prints work items in Latvian, copy them exactly. If they are in English or German (BMW / dealer printouts), translate EVERY item to polished Latvian by MEANING — never leave mixed EN/DE/LV in one list. Examples: „Set oil-filter element” → „Eļļas filtra komplekts”; „Set, microfilter/carbon canister” → „Salona filtrs (ar aktivēto ogli)”; „BMW cleaning fluid with antifreeze” → „BMW stiklu mazgāšanas šķidrums ar pretfrostu”; „Repair kit, brake pads front” → „Bremžu kluču komplekts (priekšā)”; „Vehicle check” → „Tehniskā pārbaude servisā”; „Bremsflüssigkeit” → „Bremžu šķidrums”; „Ölzuschlag für Service Inclusive” → „Eļļas piemaksa (Service Inclusive)”; „Nachrüstung Service-Inclusive” → „Service Inclusive pievienošana”; „Kundenloyalisierung siehe Mail” → „Klienta lojalitātes akcija (sk. e-pastu)”. Drop leaked table words „Order” / „Set” when they are not a part name. Keep brand names, oil specifications and part designations as printed („Castrol Magnatec Prof. MP 5W-30 LL04”); never guess a work item that is not printed; never keep part numbers.
- A work list can continue on the NEXT PAGE (after the page header/footer) — keep reading and include those items in the same event.
- NEVER include here: „Veikta tehniskā apskate” / „Veikta periodiska tehniskā apskate” / „Veikta papildus tehniskā apskate” / emission checks (those are inspections, not work), „Ziņots par odometra rādījumu”, registration/export/insurance events, damage records, and CarVertical „Ieteicamais apkopes plāns” / „Nākamā ieteicamā apkope” (that is a RECOMMENDATION, not performed work).
- If an event has no printed work items and no category, skip it.

7) VEHICLE SPECIFICATION → dealer fields (vehicleInfo)
- Read AutoDNA „Transportlīdzekļa tehniskie dati”, CarVertical „Transportlīdzekļa specifikācija” + the PR/equipment code list, or the dealer printout field list.
- Fields (leave "" when the PDF does not show it): model, modelSeries, vinCode, vehicleType, transmission, steeringSide, engineCode (ENGINE), engineNumber, body, drive, power, integrationLevel, currentILevel, developmentCode, modelCode, productionDate, firstRegistration, warrantyStartDate, countryRegion, color (COLOUR), colorCode, interior (UPHOLSTERY), interiorCode.
- vinCode: the 17-character VIN. Dates in these fields: DD.MM.YYYY.
- transmission: the most complete designation available, with code — e.g. „8-speed automatic transmission for four-wheel drive (G1G)”, „Automātiskā ātrumkārba (PPE)”, „AUT”.
- color: prefer the FULL factory name with the paint code from the equipment list (e.g. „LY8X/Havana Black Metallic” → „Havana Black Metallic (LY8X)”) over a plain word like „Melns”; put a separate factory code into colorCode.
- interior: same rule — prefer the upholstery designation with code (e.g. „N5D Valcona leather” → „Valcona leather (N5D)”) over generic „Leather package”; separate code → interiorCode.

8) OFFICIAL DEALER / FACTORY PRINTOUTS (vendor "dealer")
- Field list layout (BMW portal: MODEL SERIES, VIN, VEHICLE TYPE, TRANSMISSION, STEERING, ENGINE, ENGINE NUMBER, BODY, DRIVE, POWER, INTEGRATION LEVEL, CURRENT I LEVEL, DEVELOPMENT CODE, MODEL CODE, PRODUCTION DATE, FIRST REGISTRATION, WARRANTY START DATE, COUNTRY/REGION, COLOUR, COLOUR CODE, UPHOLSTERY, UPHOLSTERY CODE) → vehicleInfo, one value per label, copied exactly.
- „Key Read History” and auto-records.com „ODOMETER CHECK” rows → mileage ONLY (date + km). Do NOT put Key Read / CBS snapshots into serviceHistory. Do NOT copy one due-date list onto every odometer row. Do NOT treat due dates („01/06/2024-”) as workshop visits.
- „Repair History” / „Service History” visits (date + odometer + dealer + serviced parts / checkmarks) → serviceHistory: location = the dealer/workshop name as printed, works = the part / work names in Latvian without part numbers and quantities, category = "".
- Odometer values are often „188,858 mi / 303,938 km” — ALWAYS return kilometres (convert miles × 1.609344 and round when only miles are printed).
- A dealer/workshop name that names its country („B&K Deutschland GmbH, Osnabrück”) is a countryTimeline entry for that visit date.

Return JSON only — no markdown, no commentary.`;

const VEHICLE_INFO_SCHEMA_PROPERTIES: Record<string, AiJsonSchema> = Object.fromEntries(
  OUTVIN_VEHICLE_INFO_ROWS.map(({ key }) => [key, { type: JsonType.STRING } as AiJsonSchema]),
);

export const VENDOR_PDF_AGENT_SCHEMA: AiJsonSchema = {
  type: JsonType.OBJECT,
  properties: {
    vendor: { type: JsonType.STRING, enum: ["autodna", "carvertical", "dealer"] },
    mileage: {
      type: JsonType.ARRAY,
      items: {
        type: JsonType.OBJECT,
        properties: {
          date: { type: JsonType.STRING },
          odometer: { type: JsonType.STRING },
          country: { type: JsonType.STRING },
        },
        required: ["date", "odometer"],
      },
    },
    incidents: {
      type: JsonType.ARRAY,
      items: {
        type: JsonType.OBJECT,
        properties: {
          date: { type: JsonType.STRING },
          amountRaw: { type: JsonType.STRING },
          currency: { type: JsonType.STRING },
          country: { type: JsonType.STRING },
        },
        required: ["date", "amountRaw"],
      },
    },
    countryTimeline: {
      type: JsonType.ARRAY,
      items: {
        type: JsonType.OBJECT,
        properties: {
          date: { type: JsonType.STRING },
          country: { type: JsonType.STRING },
        },
        required: ["date", "country"],
      },
    },
    serviceHistory: {
      type: JsonType.ARRAY,
      items: {
        type: JsonType.OBJECT,
        properties: {
          date: { type: JsonType.STRING },
          odometer: { type: JsonType.STRING },
          category: { type: JsonType.STRING },
          location: { type: JsonType.STRING },
          works: { type: JsonType.ARRAY, items: { type: JsonType.STRING } },
          country: { type: JsonType.STRING },
        },
        required: ["date", "works"],
      },
    },
    vehicleInfo: {
      type: JsonType.OBJECT,
      properties: VEHICLE_INFO_SCHEMA_PROPERTIES,
    },
    warnings: { type: JsonType.ARRAY, items: { type: JsonType.STRING } },
  },
  required: ["vendor", "mileage", "incidents", "countryTimeline", "serviceHistory"],
};

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function asString(v: unknown, max = 200): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

function normalizeCountry(raw: string): string {
  const t = raw.trim();
  if (!t || /nezināma/i.test(t)) return "";
  return normalizeCountryNameLv(t) || t;
}

/** Summas teksts + (ja AI norādījis) valūta → viens teksts konversijai. */
function amountWithCurrency(amountRaw: string, currency: string): string {
  const amount = amountRaw.trim();
  const code = currency.trim().toUpperCase();
  if (!amount) return "";
  if (!code || /[€$£]|[A-Z]{3}/.test(amount.toUpperCase())) return amount;
  return `${amount} ${code}`;
}

/** AI JSON → `VendorReportExtract` (ar EUR pārrēķinu koda pusē). */
export function parseVendorPdfAgentPayload(
  rawJson: string,
  fallbackVendor: VendorReportVendor,
): VendorReportExtract {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    throw new Error("ai_invalid_json");
  }
  const payload = asRecord(parsed);
  if (!payload) throw new Error("ai_invalid_json");

  const vendorRaw = asString(payload.vendor, 20);
  const vendor: VendorReportVendor =
    vendorRaw === "autodna" || vendorRaw === "carvertical" || vendorRaw === "dealer"
      ? vendorRaw
      : fallbackVendor;
  const out = emptyVendorReportExtract(vendor);

  const mileage: AutoRecordsServiceRow[] = [];
  for (const item of Array.isArray(payload.mileage) ? payload.mileage : []) {
    const o = asRecord(item);
    if (!o) continue;
    const date = formatAutoRecordsDateForOutput(asString(o.date, 32));
    const odometer = normalizeAutoRecordsOdometer(asString(o.odometer, 32));
    if (!date || !odometer) continue;
    mileage.push({ date, odometer, country: normalizeCountry(asString(o.country, 80)) });
  }

  const incidents: LtabIncidentRow[] = [];
  for (const item of Array.isArray(payload.incidents) ? payload.incidents : []) {
    const o = asRecord(item);
    if (!o) continue;
    const date = formatAutoRecordsDateForOutput(asString(o.date, 32));
    const amount = amountWithCurrency(asString(o.amountRaw ?? o.amount, 80), asString(o.currency, 10));
    if (!date || !amount) continue;
    const conversion = convertAmountTextToEur(amount);
    if (!conversion) continue;
    incidents.push({
      csngDate: date,
      lossAmount: conversion.display,
      incidentNo: normalizeCountry(asString(o.country, 80)),
    });
    const note = describeEurConversion(amount, conversion);
    if (note) out.notes.push(`${date}: ${note}`);
  }

  const countryTimeline: CountryTimelineEntry[] = [];
  for (const item of Array.isArray(payload.countryTimeline) ? payload.countryTimeline : []) {
    const o = asRecord(item);
    if (!o) continue;
    const date = formatAutoRecordsDateForOutput(asString(o.date, 32));
    const country = normalizeCountry(asString(o.country, 80));
    if (!date || !country) continue;
    countryTimeline.push({ date, country });
  }

  const serviceHistory: VendorServiceEntry[] = [];
  for (const item of Array.isArray(payload.serviceHistory) ? payload.serviceHistory : []) {
    const o = asRecord(item);
    if (!o) continue;
    const date = formatAutoRecordsDateForOutput(asString(o.date, 32));
    if (!date) continue;
    const rawCategory = asString(o.category, 120).replace(/[:.]$/, "").trim();
    // Tehniskā apskate nav veikts darbs — modeļa kļūdas šeit nogriežam.
    // Dīlera izdrukā kategorija ir servisa punkta nosaukums, tāpēc tur šis filtrs neattiecas.
    const dealerReport = vendor === "dealer";
    if (
      !dealerReport &&
      rawCategory &&
      !isVendorServiceCategoryLine(rawCategory) &&
      !isVendorServiceEventTitle(rawCategory)
    ) {
      continue;
    }
    const works = serviceWorkTermsLv(
      (Array.isArray(o.works) ? o.works : [])
        .map((w) => asString(w, 160))
        .filter((w) => w && !/^[-—–]$/.test(w)),
    );
    // Vecākas atbildes dīlera punktu lika `category` laukā — vieta ir atsevišķa kolonna.
    const rawLocation = asString(o.location, 200);
    const location = rawLocation || (dealerReport ? rawCategory : "");
    const category = !dealerReport && isVendorServiceCategoryLine(rawCategory) ? rawCategory : "";
    if (works.length === 0 && !category) continue;
    const entry: VendorServiceEntry = {
      date,
      odometer: normalizeAutoRecordsOdometer(asString(o.odometer, 32)),
      country: normalizeCountry(asString(o.country, 80)),
      category,
      location,
      works,
    };
    // CBS / Key Read termiņi nav veikti darbi — nobraukumā tie paliek no mileage.
    if (dealerReport && looksLikeCbsKeyReadServiceEntry(entry)) continue;
    serviceHistory.push(entry);
  }

  const vehicleInfoRaw = asRecord(payload.vehicleInfo);
  const vehicleInfo: Partial<OutvinVehicleInfo> = {};
  if (vehicleInfoRaw) {
    for (const { key } of OUTVIN_VEHICLE_INFO_ROWS) {
      const value = asString(vehicleInfoRaw[key], 160);
      if (value && !/^[-—–]$/.test(value)) vehicleInfo[key] = value;
    }
  }

  out.mileage = mileage;
  out.incidents = incidents;
  out.serviceHistory = mergeVendorServiceEntries(serviceHistory, []);
  out.countryTimeline = countryTimeline;
  out.vehicleInfo = vehicleInfo;
  return out;
}
