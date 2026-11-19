/**
 * 19.11 (Nila plāns): valsts dīlera servisa darbiem (`serviceWorks`) un OneAuto ierakstiem, ja ieraksts to
 * nenorāda. Secina tikai no citu avotu laika joslas (CSDD, CarVertical, AutoDNA, dīlera rādījumi u.c.):
 * tajā pašā datumā (mēnesī) viena valsts vai abi tuvākie kaimiņi vienā valstī. Pāri valsts maiņai, pirms pirmā
 * un pēc pēdējā zināmā ieraksta neaizpilda. Sludinājumi un jau secinātas valstis nav pierādījums.
 * Tikai nolasot / attēlojot - saglabātie dati netiek mainīti.
 *
 * Nobraukuma rindu loģika (`inferMissingMileageCountries`) paliek `lib/unified-mileage.ts`.
 */

import { formatAutoRecordsDateForOutput } from "@/lib/auto-records-paste-parse";
import type { AutoRecordsServiceWorkRow } from "@/lib/auto-records-service-works";
import { countryLabelToIso2, normalizeCountryNameLv } from "@/lib/country-names-lv";
import { countryFromDealerName } from "@/lib/dealer-report-extract";
import {
  buildCountryTimeline,
  resolveCountryForDate,
  type CountryTimelineEntry,
} from "@/lib/vehicle-country-timeline";

export type ServiceWorkCountryInfo = {
  /** Latviskais valsts nosaukums vai tukšs. */
  country: string;
  /** true = ieraksts valsti nedeva, tā secināta no citiem avotiem. */
  countryInferred: boolean;
};

/** Pierādījuma rinda (piem. `UnifiedMileageRow`): sludinājumi un secinātās valstis neder. */
export type CountryEvidenceRow = {
  date: string;
  country: string;
  countryUnverified?: boolean;
  countryInferred?: boolean;
};

/** Valsts, ko norāda pats ieraksts (vietas teksts, piem. „BMW AG, Bonn, Vācija” vai dīlera nosaukums). */
export function serviceWorkOwnCountry(location: string): string {
  const raw = location.replace(/\s+/g, " ").trim();
  if (!raw) return "";
  const fromName = countryFromDealerName(raw);
  if (fromName) return normalizeCountryNameLv(fromName) || fromName;
  const segs = raw.split(",").map((s) => s.trim()).filter(Boolean);
  const last = segs[segs.length - 1] ?? "";
  if (last && countryLabelToIso2(last)) return normalizeCountryNameLv(last) || last;
  return "";
}

/** Pierādījumi no nobraukuma rindām - bez sludinājumiem un bez jau secinātām valstīm. */
export function countryEvidenceFromRows(rows: readonly CountryEvidenceRow[]): CountryTimelineEntry[] {
  const out: CountryTimelineEntry[] = [];
  for (const r of rows) {
    if (r.countryUnverified || r.countryInferred) continue;
    const country = r.country.trim();
    if (!country || /nezināma/i.test(country)) continue;
    const date = formatAutoRecordsDateForOutput(r.date) || r.date.trim();
    if (!date) continue;
    out.push({ date, country });
  }
  return out;
}

/**
 * Katram ierakstam: sava valsts (ja ir) vai secinātā (`countryInferred: true`). Rindu secība nemainās.
 */
export function inferServiceWorkCountries(
  rows: readonly Pick<AutoRecordsServiceWorkRow, "date" | "location">[],
  evidence: readonly CountryTimelineEntry[],
): ServiceWorkCountryInfo[] {
  const timeline = buildCountryTimeline([...evidence]);
  return rows.map((r) => {
    const own = serviceWorkOwnCountry(r.location);
    if (own) return { country: own, countryInferred: false };
    if (!timeline.hasData) return { country: "", countryInferred: false };
    const date = formatAutoRecordsDateForOutput(r.date) || r.date.trim();
    if (!date) return { country: "", countryInferred: false };
    const country = resolveCountryForDate(timeline, date, { extrapolateAfterLast: false });
    return country ? { country, countryInferred: true } : { country: "", countryInferred: false };
  });
}

/** Tikai secinātā valsts (tukšs, ja ieraksts valsti norāda pats vai nevar droši secināt). */
export function inferredServiceWorkCountry(
  row: Pick<AutoRecordsServiceWorkRow, "date" | "location">,
  evidence: readonly CountryTimelineEntry[],
): string {
  const info = inferServiceWorkCountries([row], evidence)[0];
  return info?.countryInferred ? info.country : "";
}
