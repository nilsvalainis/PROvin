/**
 * Ikdienas VIN SCAN kanārijputns: 2-3 zināmi VIN, tikai bezmaksas avoti.
 * Viens no tiem ir stat.vin ieraksta VIN no repo testiem.
 */

import { isPaidVinScanSourceId } from "@/lib/vin-scan/free-sources";

export type VinScanCanaryVin = {
  vin: string;
  note: string;
  /** Šim VIN repo testos ir stat.vin izsoles lapa. */
  statVinRecord: boolean;
};

export const VIN_SCAN_CANARY_VINS: readonly VinScanCanaryVin[] = [
  { vin: "WBA5R1C0XLFH42873", note: "BMW, stat.vin ieraksts testos", statVinRecord: true },
  { vin: "YV1DZ5251B2146640", note: "Volvo XC60, tukšais skenējums", statVinRecord: false },
  { vin: "TMBJH9NP9N7043581", note: "Škoda, CSDD", statVinRecord: false },
];

/** Šaurs kanārijputns: WMI + stat.vin. Bez JoJ un citiem maksas API. */
export const VIN_SCAN_CANARY_SOURCE_IDS = ["vin_decode", "stat_vin"] as const;

export function vinScanCanarySourceIds(): string[] {
  return VIN_SCAN_CANARY_SOURCE_IDS.filter((id) => !isPaidVinScanSourceId(id));
}
