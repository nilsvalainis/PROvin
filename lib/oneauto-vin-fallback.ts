import { decodeVinLocal, mergeVinDecodeWithVpic, vinDecodeParseFromLocal } from "@/lib/vin-scan/vin-decode";
import type { VinScanParse } from "@/lib/vin-scan/types";
import type { OneautoKvRow } from "@/lib/oneauto-catalog";

export const ONEAUTO_VIN_FALLBACK_SOURCE = "VIN SCAN fallback (lokālais + NHTSA)";

export function oneautoPowertrainFromVinScanParse(parsed: VinScanParse): OneautoKvRow[] {
  if (parsed.status !== "found") return [];
  const rows: OneautoKvRow[] = [{ label: "Avots", value: ONEAUTO_VIN_FALLBACK_SOURCE }];
  const make = parsed.vehicle?.make?.trim() ?? "";
  const model = parsed.vehicle?.model?.trim() ?? "";
  const year = parsed.vehicle?.year?.trim() ?? "";
  const country = parsed.flags?.registrationCountry?.trim() ?? "";
  if (year) rows.push({ label: "Gads (fallback)", value: year });
  if (make) rows.push({ label: "Marka (fallback)", value: make });
  if (model) rows.push({ label: "Modelis (fallback)", value: model });
  if (country) rows.push({ label: "Valsts (fallback)", value: country });
  if (parsed.summary.trim() && !rows.some((r) => r.value === parsed.summary.trim())) {
    rows.push({ label: "Dekodējums (fallback)", value: parsed.summary.trim() });
  }
  return rows;
}

export function oneautoPowertrainFromLocalVin(vin: string): OneautoKvRow[] {
  return oneautoPowertrainFromVinScanParse(vinDecodeParseFromLocal(decodeVinLocal(vin)));
}

export function mergeVinDecodeFallbackPowertrain(
  existing: readonly OneautoKvRow[],
  fallback: readonly OneautoKvRow[],
): OneautoKvRow[] {
  if (fallback.length === 0) return [...existing];
  const seen = new Set(existing.map((r) => `${r.label.toLowerCase()}|${r.value.toLowerCase()}`));
  const extra = fallback.filter((r) => {
    const key = `${r.label.toLowerCase()}|${r.value.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return [...extra, ...existing];
}
