/**
 * CARFAX.eu bezmaksas pieejamības pārbaude (`web-backend.carfax.eu/api/v1/record-check/{VIN}`),
 * ko relejs nolasa ar Chrome sākumlapas formu. Nekas netiek pirkts: tikai ierakstu skaits un pamatdati.
 */
import type { VinScanParse } from "@/lib/vin-scan/types";

export type CarfaxRecordCheck = {
  displayRecords: number;
  recordsPerCountry: Record<string, number>;
  odometerReadingsCount: number;
  inspectionRecordsCount: number;
  serviceAndRepairRecordsCount: number;
  usRecords: number;
  make: string;
  model: string;
  makeAndModel: string;
  fuelType: string;
  powerKw: number;
  euEmissionStandard: string;
  presentCountry: string;
  euHistory: boolean;
  usHistory: boolean;
  localHistory: boolean;
};

function num(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function rec(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

export function parseCarfaxRecordCheck(json: unknown): CarfaxRecordCheck | null {
  const root = rec(json);
  const rc = rec(root.recordCheck);
  if (!Object.keys(rc).length) return null;
  const perCountry: Record<string, number> = {};
  for (const [k, v] of Object.entries(rec(rc.recordsPerCountry))) {
    const n = num(v);
    if (n > 0) perCountry[k.toLowerCase()] = n;
  }
  const pricing = rec(root.reportPricing);
  return {
    displayRecords: num(rc.displayRecords),
    recordsPerCountry: perCountry,
    odometerReadingsCount: num(rc.odometerReadingsCount),
    inspectionRecordsCount: num(rc.inspectionRecordsCount),
    serviceAndRepairRecordsCount: num(rc.serviceAndRepairRecordsCount),
    usRecords: num(rec(rec(rc.externalReports).us).displayRecords),
    make: str(rc.make),
    model: str(rc.model),
    makeAndModel: str(rc.makeAndModel),
    fuelType: str(rc.fuelType),
    powerKw: num(rc.enginePowerKW),
    euEmissionStandard: str(rc.euEmissionStandard),
    presentCountry: str(rc.presentCountry).toUpperCase(),
    euHistory: rec(pricing.euHistory).hasHistory === true,
    usHistory: rec(pricing.usHistory).hasHistory === true,
    localHistory: rec(pricing.localHistory).hasHistory === true,
  };
}

function ierakstiWord(n: number): string {
  return n % 10 === 1 && n % 100 !== 11 ? "ieraksts" : "ieraksti";
}

/** Valstu sadalījums: „SE 10”, „EU 1, US 7”. */
export function carfaxCountriesLine(perCountry: Record<string, number>): string {
  return Object.entries(perCountry)
    .sort((a, b) => b[1] - a[1])
    .map(([k, n]) => `${k.toUpperCase()} ${n}`)
    .join(", ");
}

/** `kind` no releja: found (200 ar recordCheck) vai none (422/404 - šim VIN ierakstu nav). */
export function vinScanParseFromCarfax(kind: "found" | "none", json: unknown, openUrl: string): VinScanParse {
  const data = kind === "found" ? parseCarfaxRecordCheck(json) : null;
  if (!data || data.displayRecords <= 0) {
    const make = str(rec(json).make);
    return {
      status: "none",
      summary: "CARFAX priekšskatījumā ierakstu nav",
      detail: make ? `Marka: ${make}` : "",
      openUrl,
    };
  }
  const n = data.displayRecords;
  const countries = carfaxCountriesLine(data.recordsPerCountry);
  const detail = [
    `Ieraksti: ${n}`,
    countries && `Valstis: ${countries}`,
    data.odometerReadingsCount > 0 && `Nobraukuma rādījumi: ${data.odometerReadingsCount}`,
    data.inspectionRecordsCount > 0 && `Tehniskās apskates: ${data.inspectionRecordsCount}`,
    data.serviceAndRepairRecordsCount > 0 && `Serviss un remonti: ${data.serviceAndRepairRecordsCount}`,
    data.usRecords > 0 && `ASV vēsture: ${data.usRecords}`,
    data.presentCountry && `Pašreizējā valsts: ${data.presentCountry}`,
    data.makeAndModel && `Auto: ${data.makeAndModel}`,
    data.fuelType && `Degviela: ${data.fuelType}`,
    data.powerKw > 0 && `Jauda: ${data.powerKw} kW`,
    data.euEmissionStandard && `Emisiju klase: ${data.euEmissionStandard.replace(/_/g, " ")}`,
  ]
    .filter(Boolean)
    .join("\n");
  return {
    status: "found",
    summary: `${n} ${ierakstiWord(n)} CARFAX priekšskatījumā${countries ? ` (${countries})` : ""}`,
    detail,
    openUrl,
  };
}
