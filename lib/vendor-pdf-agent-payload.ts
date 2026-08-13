/**
 * AutoDNA / CarVertical PDF aģenta Gemini kontrakts: sistēmas instrukcija, JSON shēma
 * un atbildes normalizācija uz `VendorReportExtract`.
 *
 * Summas Gemini atgriež TĀ, KĀ TĀS IR ATSKAITĒ (ar valūtu) — pārrēķinu uz EUR veic kods
 * (`convertAmountTextToEur`), lai modelis nerēķina un nesajauc vērtību ar zaudējumiem.
 */

import { SchemaType, type Schema } from "@google/generative-ai";

import type { LtabIncidentRow } from "@/lib/admin-source-blocks";
import {
  formatAutoRecordsDateForOutput,
  normalizeAutoRecordsOdometer,
  type AutoRecordsServiceRow,
} from "@/lib/auto-records-paste-parse";
import { normalizeCountryNameLv } from "@/lib/country-names-lv";
import { convertAmountTextToEur, describeEurConversion } from "@/lib/currency-eur-convert";
import { OUTVIN_VEHICLE_INFO_ROWS, type OutvinVehicleInfo } from "@/lib/outvin-dealer-types";
import type { CountryTimelineEntry } from "@/lib/vehicle-country-timeline";
import {
  emptyVendorReportExtract,
  type VendorReportExtract,
  type VendorReportVendor,
} from "@/lib/vendor-report-extract";

export const VENDOR_PDF_AGENT_SYSTEM = `You are the PROVIN.LV vehicle-history PDF extraction agent for ONE report (AutoDNA or CarVertical).
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

6) VEHICLE SPECIFICATION → dealer fields (vehicleInfo)
- Read AutoDNA „Transportlīdzekļa tehniskie dati” and CarVertical „Transportlīdzekļa specifikācija” + the PR/equipment code list.
- vinCode: the 17-character VIN.
- engineCode: e.g. „Dzinēja kods: CVUA”.
- transmission: the most complete designation available, with code — e.g. „8-speed automatic transmission for four-wheel drive (G1G)”, „Automātiskā ātrumkārba (PPE)”.
- color: prefer the FULL factory name with the paint code from the equipment list (e.g. „LY8X/Havana Black Metallic” → „Havana Black Metallic (LY8X)”) over a plain word like „Melns”.
- interior: same rule — prefer the upholstery designation with code (e.g. „N5D Valcona leather” → „Valcona leather (N5D)”) over generic „Leather package”.
- Leave a field as "" when the PDF does not show it.

Return JSON only — no markdown, no commentary.`;

export const VENDOR_PDF_AGENT_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    vendor: { type: SchemaType.STRING, format: "enum", enum: ["autodna", "carvertical"] },
    mileage: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          date: { type: SchemaType.STRING },
          odometer: { type: SchemaType.STRING },
          country: { type: SchemaType.STRING },
        },
        required: ["date", "odometer"],
      },
    },
    incidents: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          date: { type: SchemaType.STRING },
          amountRaw: { type: SchemaType.STRING },
          currency: { type: SchemaType.STRING },
          country: { type: SchemaType.STRING },
        },
        required: ["date", "amountRaw"],
      },
    },
    countryTimeline: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          date: { type: SchemaType.STRING },
          country: { type: SchemaType.STRING },
        },
        required: ["date", "country"],
      },
    },
    vehicleInfo: {
      type: SchemaType.OBJECT,
      properties: {
        vinCode: { type: SchemaType.STRING },
        engineCode: { type: SchemaType.STRING },
        transmission: { type: SchemaType.STRING },
        color: { type: SchemaType.STRING },
        interior: { type: SchemaType.STRING },
        model: { type: SchemaType.STRING },
        series: { type: SchemaType.STRING },
        generation: { type: SchemaType.STRING },
        typeCode: { type: SchemaType.STRING },
        steeringSide: { type: SchemaType.STRING },
      },
    },
    warnings: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
  },
  required: ["vendor", "mileage", "incidents", "countryTimeline"],
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

/** Summas teksts + (ja Gemini norādījis) valūta → viens teksts konversijai. */
function amountWithCurrency(amountRaw: string, currency: string): string {
  const amount = amountRaw.trim();
  const code = currency.trim().toUpperCase();
  if (!amount) return "";
  if (!code || /[€$£]|[A-Z]{3}/.test(amount.toUpperCase())) return amount;
  return `${amount} ${code}`;
}

/** Gemini JSON → `VendorReportExtract` (ar EUR pārrēķinu koda pusē). */
export function parseVendorPdfAgentPayload(
  rawJson: string,
  fallbackVendor: VendorReportVendor,
): VendorReportExtract {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    throw new Error("gemini_invalid_json");
  }
  const payload = asRecord(parsed);
  if (!payload) throw new Error("gemini_invalid_json");

  const vendorRaw = asString(payload.vendor, 20);
  const vendor: VendorReportVendor =
    vendorRaw === "autodna" || vendorRaw === "carvertical" ? vendorRaw : fallbackVendor;
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
  out.countryTimeline = countryTimeline;
  out.vehicleInfo = vehicleInfo;
  return out;
}
