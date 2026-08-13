/**
 * Avota PDF aģenta rezultātu apvienošana un pārvēršana Copilot darbībās.
 *
 * Deterministiskais parseris (PDF teksta slānis) ir pamats — Gemini rezultāts pievieno rindas,
 * ko teksta slānis nedeva (skenēti / netipiski PDF), un precizē tehniskos laukus.
 */

import { ltabRowHasData, type LtabIncidentRow } from "@/lib/admin-source-blocks";
import type { CopilotAction, CopilotSourceKey } from "@/lib/admin-copilot-types";
import {
  sortAutoRecordsDescending,
  type AutoRecordsServiceRow,
} from "@/lib/auto-records-paste-parse";
import type { OutvinVehicleInfo } from "@/lib/outvin-dealer-types";
import {
  buildCountryTimeline,
  fillCountriesFromTimeline,
  type CountryTimelineEntry,
} from "@/lib/vehicle-country-timeline";
import {
  mergeVehicleInfoPreferSpecific,
  type VendorReportExtract,
  type VendorReportVendor,
} from "@/lib/vendor-report-extract";
import {
  formatVendorServiceHistoryText,
  mergeVendorServiceEntries,
} from "@/lib/vendor-service-history";

function vendorLabel(vendor: VendorReportVendor): string {
  return vendor === "autodna" ? "AutoDNA" : "CarVertical";
}

function mileageKey(r: AutoRecordsServiceRow): string {
  return `${r.date}|${r.odometer}`;
}

function incidentKey(r: LtabIncidentRow): string {
  return `${r.csngDate}|${r.lossAmount.replace(/\s+/g, "")}`;
}

/** Apvieno deterministisko un Gemini rezultātu; primārais nosaka vērtības konfliktos. */
export function mergeVendorReportExtracts(
  primary: VendorReportExtract,
  secondary: VendorReportExtract,
): VendorReportExtract {
  const mileage = [...primary.mileage];
  const mileageSeen = new Set(primary.mileage.map(mileageKey));
  for (const row of secondary.mileage) {
    const key = mileageKey(row);
    if (mileageSeen.has(key)) continue;
    mileageSeen.add(key);
    mileage.push(row);
  }

  const incidents = [...primary.incidents];
  const incidentSeen = new Set(primary.incidents.map(incidentKey));
  const incidentDates = new Set(primary.incidents.map((r) => r.csngDate));
  for (const row of secondary.incidents) {
    // Vienam datumam uzticamies deterministiskajai summai (novērš dubultus ar citu noapaļojumu).
    if (incidentSeen.has(incidentKey(row)) || incidentDates.has(row.csngDate)) continue;
    incidentSeen.add(incidentKey(row));
    incidentDates.add(row.csngDate);
    incidents.push(row);
  }

  return {
    vendor: primary.vendor,
    mileage,
    incidents,
    serviceHistory: mergeVendorServiceEntries(primary.serviceHistory, secondary.serviceHistory),
    countryTimeline: [...primary.countryTimeline, ...secondary.countryTimeline],
    vehicleInfo: mergeVehicleInfoPreferSpecific(primary.vehicleInfo, secondary.vehicleInfo),
    notes: [...primary.notes, ...secondary.notes],
  };
}

/**
 * Aizpilda tukšās valstis no atskaites laikposma + jau aizpildītajiem avotiem
 * (papildu ieraksti nāk no darbvirsmas tabulām).
 */
export function resolveExtractCountries(
  extract: VendorReportExtract,
  extraTimeline: CountryTimelineEntry[] = [],
): VendorReportExtract {
  const timeline = buildCountryTimeline([...extract.countryTimeline, ...extraTimeline]);
  const mileage = fillCountriesFromTimeline(extract.mileage, timeline);
  const incidents = fillCountriesFromTimeline(
    extract.incidents.map((r) => ({ date: r.csngDate, country: r.incidentNo, row: r })),
    timeline,
  ).map(({ row, country }) => ({ ...row, incidentNo: country }));

  return { ...extract, mileage, incidents };
}

const DEALER_VEHICLE_INFO_KEYS: (keyof OutvinVehicleInfo)[] = [
  "vinCode",
  "engineCode",
  "transmission",
  "color",
  "interior",
  "model",
  "generation",
  "series",
  "typeCode",
  "steeringSide",
];

/** `VendorReportExtract` → Copilot darbības (nobraukums, negadījumi, dīlera tehniskie lauki). */
export function buildVendorCopilotActions(
  extract: VendorReportExtract,
  source: CopilotSourceKey,
  opts?: { includeDealerFields?: boolean },
): CopilotAction[] {
  const actions: CopilotAction[] = [];

  for (const row of sortAutoRecordsDescending(extract.mileage)) {
    if (!row.date || !row.odometer) continue;
    actions.push({
      type: "upsert_mileage",
      source,
      date: row.date,
      odometer: row.odometer,
      country: row.country,
      confidence: "high",
    });
  }

  for (const row of extract.incidents) {
    if (!ltabRowHasData(row)) continue;
    actions.push({
      type: "upsert_incident",
      source,
      date: row.csngDate,
      lossAmount: row.lossAmount,
      country: row.incidentNo,
      confidence: "high",
    });
  }

  const serviceText = formatVendorServiceHistoryText(extract.serviceHistory);
  if (serviceText) {
    actions.push({
      type: "set_service_history",
      source: "auto_records",
      text: serviceText,
      confidence: "high",
      note: `Apkopes no ${vendorLabel(extract.vendor)} atskaites`,
    });
  }

  if (opts?.includeDealerFields !== false) {
    const vehicleInfo: Partial<OutvinVehicleInfo> = {};
    for (const key of DEALER_VEHICLE_INFO_KEYS) {
      const value = (extract.vehicleInfo[key] ?? "").trim();
      if (value) vehicleInfo[key] = value;
    }
    if (Object.keys(vehicleInfo).length > 0) {
      actions.push({
        type: "set_dealer_vehicle_info",
        source: "auto_records",
        vehicleInfo,
        confidence: "high",
        note: `Specifikācija no ${vendorLabel(extract.vendor)} atskaites`,
      });
    }
  }

  return actions;
}
