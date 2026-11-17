/**
 * Auto1 vērtības klienta skatā: avots dod angliski un ASV formātā ("Available", "12/21/2020", "130,129 km").
 * Klientam rāda latviski: vārdi pārtulkoti, datums DD.MM.GGGG, tūkstoši ar atstarpi.
 */

const WORDS_LV: Record<string, string> = {
  available: "Ir",
  "not available": "Nav",
  unavailable: "Nav",
  yes: "Jā",
  no: "Nē",
  none: "Nav",
  some: "Daļēji",
  partial: "Daļēji",
  partially: "Daļēji",
  complete: "Pilna",
  full: "Pilna",
  unknown: "Nav zināms",
  "not specified": "Nav norādīts",
  "n/a": "-",
};

/** ASV datums M/D/GGGG -> DD.MM.GGGG. Citus formātus neaiztiek. */
function usDateToLv(value: string): string | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value);
  if (!m) return null;
  const month = Number(m[1]);
  const day = Number(m[2]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${String(day).padStart(2, "0")}.${String(month).padStart(2, "0")}.${m[3]}`;
}

/** "130,129 km" / "130.129 km" -> "130 129 km" (tikai veseli skaitļi ar tūkstošu atdalītāju). */
function groupedNumberToLv(value: string): string | null {
  const m = /^(\d{1,3}(?:[,.]\d{3})+)(\s*km)?$/i.exec(value);
  if (!m) return null;
  const digits = m[1]!.replace(/[,.]/g, "");
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${grouped}${m[2] ? " km" : ""}`;
}

export function irissPdDisplayValue(raw: string): string {
  const value = raw.trim();
  if (!value) return value;
  const word = WORDS_LV[value.toLowerCase()];
  if (word) return word;
  return usDateToLv(value) ?? groupedNumberToLv(value) ?? value;
}
