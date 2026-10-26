/**
 * VIN SCAN avotu veselība: found → ok, none → empty, kļūda/timeout → error.
 */

import type { VinScanStatus } from "@/lib/vin-scan/types";

export type VinScanHealthCell = "ok" | "empty" | "error";

export type VinScanHealthVin = {
  vin: string;
  make: string;
  note: string;
};

/** Reāli VIN no repo testiem / pasūtījumu fixture + ziņotais tukšais Volvo. */
export const VIN_SCAN_HEALTH_VINS: readonly VinScanHealthVin[] = [
  { vin: "YV1DZ5251B2146640", make: "Volvo", note: "XC60 SE, tukšais skenējums" },
  { vin: "YV1PZ68TCL1106362", make: "Volvo", note: "dīlera PDF" },
  { vin: "WBA5R1C0XLFH42873", make: "BMW", note: "Izsoļu portālu arhīvs" },
  { vin: "WBA5K71050G295219", make: "BMW", note: "535" },
  { vin: "TMBLD9NS7J8038392", make: "Škoda", note: "Kodiaq carVertical" },
  { vin: "WBAVT11010KW00321", make: "BMW", note: "e91" },
  { vin: "WAUZZZF44LA062962", make: "Audi", note: "pasūtījums" },
  { vin: "WVWZZZ7NZEV015204", make: "Volkswagen", note: "DK nummerplade" },
  { vin: "VF12RFL1H49621453", make: "Renault", note: "DK tjekbil" },
  { vin: "TMBJH9NP9N7043581", make: "Škoda", note: "CSDD" },
  { vin: "WBAHT710105G31814", make: "BMW", note: "X3" },
  { vin: "U5YH6G17GNL050102", make: "Kia", note: "EE mnt" },
  { vin: "1HGCM82633A004352", make: "Honda", note: "ASV" },
];

export type VinScanHealthHit = {
  vin: string;
  sourceId: string;
  status: string;
  summary: string;
};

export type VinScanHealthMatrixCell = {
  cell: VinScanHealthCell;
  reason: string;
};

export function classifyVinScanHealth(status: string, summary = ""): VinScanHealthMatrixCell {
  const msg = summary.trim();
  if (status === "found") return { cell: "ok", reason: msg };
  if (status === "none" || status === "needs_input") return { cell: "empty", reason: msg || status };
  if (status === "manual") return { cell: "empty", reason: msg || "manual" };
  return { cell: "error", reason: msg || status };
}

export function buildVinScanHealthMatrix(
  hits: readonly VinScanHealthHit[],
): Record<string, Record<string, VinScanHealthMatrixCell>> {
  const matrix: Record<string, Record<string, VinScanHealthMatrixCell>> = {};
  for (const hit of hits) {
    const row = matrix[hit.sourceId] ?? (matrix[hit.sourceId] = {});
    row[hit.vin] = classifyVinScanHealth(hit.status, hit.summary);
  }
  return matrix;
}

const SCAN_ERR = new Set(["Avots neatbildēja laikā", "Avotu neizdevās nolasīt"]);

/** Kešā paliek tikai found/none. unknown, timeout un blocked jāskenē vēlreiz. */
export function vinScanStatusIsCacheable(status: string): boolean {
  return status === "found" || status === "none";
}

export function vinScanSourceNeedsRescan(status: string, summary = ""): boolean {
  if (vinScanStatusIsCacheable(status)) return false;
  if (status === "unknown" || status === "timeout" || status === "blocked" || status === "error") return true;
  return SCAN_ERR.has(summary);
}

/** Kešs nav svaigs, ja nav WMI dekodējuma vai kāds avots ir unknown/timeout/blocked. */
export function vinScanIndicatorsAreCacheable(
  indicators: readonly { id: string; status: VinScanStatus | string; summary?: string }[],
): boolean {
  if (!indicators.length) return false;
  const decode = indicators.find((row) => row.id === "vin_decode");
  if (!decode || decode.status !== "found") return false;
  const others = indicators.filter((row) => row.id !== "vin_decode");
  if (!others.length) return true;
  return others.every((row) => !vinScanSourceNeedsRescan(row.status, row.summary ?? ""));
}
