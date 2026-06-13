/**
 * CarVertical odometra žurnāls — iekopēts teksts → servisa vēstures rindas.
 * Atbalsta MM.YYYY., DD.MM.YYYY. un fragmentētu PDF izkārtojumu.
 */

import type { AutoRecordsServiceRow } from "@/lib/auto-records-paste-parse";
import {
  formatAutoRecordsDateForOutput,
  normalizeAutoRecordsOdometer,
  sanitizeMileageCountryField,
} from "@/lib/auto-records-paste-parse";
import { parseCarverticalOdometerFromText } from "@/lib/carvertical-pdf-parse";

/** Parsē visu žurnālu; dublikātus (datums+km) izlaiž; kārto kā AUTO RECORDS (jaunākais augšā). */
export function parseCarverticalOdometerPaste(raw: string): AutoRecordsServiceRow[] {
  return parseCarverticalOdometerFromText(raw).map((r) => ({
    date: formatAutoRecordsDateForOutput(r.date),
    odometer: normalizeAutoRecordsOdometer(r.odometer) || r.odometer.replace(/\D/g, ""),
    country: sanitizeMileageCountryField(r.country),
  }));
}
