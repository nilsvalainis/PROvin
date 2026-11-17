/**
 * VIN SCAN rezultāti pa daļām: vispirms ātrie avoti (atbild dažās sekundēs), tad lēnie
 * (relejs, CAPTCHA, Igaunija). Operators redz lielāko daļu datu, negaidot lēnāko avotu.
 * Abi pieprasījumi iet viens pēc otra, lai snapshot netiek rakstīts vienlaikus.
 */
import { defaultVinScanSourceIds, type VinScanSourceId } from "@/lib/vin-scan/catalog";
import { vinScanSourceTimeoutMs } from "@/lib/vin-scan/source-timeouts";

/** Avots ar tādu vai mazāku ārējo taimautu skaitās ātrs. */
export const VIN_SCAN_FAST_SOURCE_MAX_MS = 25_000;

export type VinScanScanPhases = { fast: VinScanSourceId[]; slow: VinScanSourceId[] };

export function vinScanScanPhases(ids: readonly VinScanSourceId[] = defaultVinScanSourceIds()): VinScanScanPhases {
  const fast: VinScanSourceId[] = [];
  const slow: VinScanSourceId[] = [];
  for (const id of ids) {
    if (vinScanSourceTimeoutMs(id) <= VIN_SCAN_FAST_SOURCE_MAX_MS) fast.push(id);
    else slow.push(id);
  }
  return { fast, slow };
}
