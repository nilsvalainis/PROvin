/**
 * Ikdienas VIN SCAN uzraudzība (Nila lēmums 23.11): katram servera pusē palaižamam avotam
 * viens «zelta» VIN, kuram avotā agrāk bija dati (no 23.11 skeniem).
 *
 * `found` = šim VIN avotā jābūt ierakstam (ja pēkšņi nav - aizdomīgi).
 * `any` = pietiek, ka avots atbild (found vai none); zelta VIN ar datiem šim avotam nav zināms.
 *
 * Pārlūka (Tampermonkey) avotus cron nevar pārbaudīt - tos uzrauga pēc faktiskās lietošanas
 * (`browser-usage.ts`). JoJ, CarVertical, AutoDNA u.c. maksas avoti netiek saukti.
 * TheCarApi (abonements, 100 000 pieprasījumu/mēn.) - viens VIN 1×/dienā.
 * mnt.ee, lkf.ee, nummerplade, car.info un epolicija.lt var risināt captcha caur CapSolver (~0,001 $ par reizi).
 */

import type { VinScanSourceId } from "@/lib/vin-scan/catalog";

export type VinScanCanaryExpect = "found" | "any";

export type VinScanCanaryCheck = { id: VinScanSourceId; expect: VinScanCanaryExpect };

export type VinScanCanaryBatch = {
  vin: string;
  note: string;
  checks: readonly VinScanCanaryCheck[];
};

export const VIN_SCAN_CANARY_BATCHES: readonly VinScanCanaryBatch[] = [
  {
    vin: "U5YH6G17GNL050102",
    note: "Kia ProCeed, Igaunija (mnt.ee 2 nobraukumi, lkf.ee 1 atlīdzība)",
    checks: [
      { id: "vin_decode", expect: "found" },
      { id: "mnt_ee", expect: "found" },
      { id: "lkf_ee", expect: "found" },
      { id: "auchistory", expect: "any" },
    ],
  },
  {
    vin: "WDD2120251A120979",
    note: "Mercedes E350, Dānija + LV (tjekbil, esyn 9 apskates, DSB 9 servisi, CSDD AP4989)",
    checks: [
      { id: "tjekbil", expect: "found" },
      { id: "esyn", expect: "found" },
      { id: "dsb", expect: "found" },
      { id: "nummerplade", expect: "found" },
      { id: "carinfo", expect: "found" },
      { id: "csdd", expect: "found" },
      { id: "eu_safety_gate", expect: "found" },
      { id: "lt_itpr", expect: "any" },
    ],
  },
  {
    vin: "WBA7J21040G829261",
    note: "BMW 740Le (Car-Pass un CZ RSV: pietiek ar atbildi)",
    checks: [
      { id: "carpass", expect: "any" },
      { id: "cz_rsv", expect: "any" },
    ],
  },
  {
    vin: "WAUZZZF43PA018831",
    note: "Audi A4, BCA/Openlane 2026-10 (TheCarApi 2 ieraksti)",
    checks: [{ id: "thecarapi_eu", expect: "found" }],
  },
];

/** TheCarApi kanārijputns ne biežāk kā reizi ~dienā (arī ja cron palaists ar roku). */
export const VIN_SCAN_CANARY_THECARAPI_MIN_GAP_MS = 20 * 60 * 60 * 1000;

/** Vienlaikus partijas (VIN). Ne vairāk par 2, lai relejs un CapSolver netiek noslogoti. */
export const VIN_SCAN_CANARY_CONCURRENCY = 2;

/** Laika budžets visam cron (maxDuration 300 s): jaunu partiju nesāk, ja tā var nepaspēt. */
export const VIN_SCAN_CANARY_BUDGET_MS = 270_000;

export function vinScanCanarySourceIds(): VinScanSourceId[] {
  return VIN_SCAN_CANARY_BATCHES.flatMap((b) => b.checks.map((c) => c.id));
}
