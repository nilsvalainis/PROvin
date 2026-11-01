/**
 * Dīlera datu pārbaudes CSDD priekšskatījums: plate→VIN un visi reģistra lauki
 * pirms OneAuto ielādes. Tas pats CSDD klients, ko admin CSDD / VIN SCAN.
 */
import { CSDD_FORM_STRUCTURED_FIELDS } from "@/lib/admin-source-blocks";
import {
  CSDD_API_LOCKED_KEYS,
  csddRegistryFieldValues,
  isCsddApiLockedKey,
} from "@/lib/csdd-field-lock";
import { isCsddTechDataResult, type CsddTechData, type CsddTechDataResult } from "@/lib/csdd-tech-data";
import {
  formatDealerCheckDateLv,
  normalizeDealerCheckPlate,
} from "@/lib/dealer-check";
import { isValidPlateNumber, isValidVin, normalizePlateNumber, normalizeVin } from "@/lib/order-field-validation";

/** Esošais admin CSDD ceļš (VIN SCAN, pasūtījuma CSDD poga). Jauns provider nav. */
export const DEALER_CHECK_CSDD_LOOKUP_PATH = "/api/admin/csdd-tech-data" as const;

export const DEALER_CHECK_CSDD_TITLE = "CSDD reģistra dati";

export type DealerCheckCsddPreviewRow = {
  key: string;
  label: string;
  value: string;
};

export type DealerCheckCsddApplied = {
  vin: string;
  plate: string;
  csdd: CsddTechData | null;
  found: boolean;
  message: string;
};

const DATE_KEYS = new Set(["firstRegistration", "nextInspectionDate", "insuranceValidUntil"]);

export function dealerCheckCsddLookupQuery(plate: string, vin: string): string {
  const rawPlate = plate.trim();
  if (rawPlate) {
    return isValidPlateNumber(rawPlate) ? normalizePlateNumber(rawPlate) : "";
  }
  const n = normalizeVin(vin);
  return isValidVin(n) ? n : "";
}

export function dealerCheckVinFromCsdd(result: CsddTechDataResult): string {
  if (!result.found) return "";
  const vin = normalizeVin(result.data.vin);
  return isValidVin(vin) ? vin : "";
}

export function dealerCheckPlateFromCsdd(result: CsddTechDataResult): string {
  if (!result.found) return "";
  return normalizeDealerCheckPlate(result.data.registrationNumber);
}

export function applyDealerCheckCsddResult(
  current: { vin: string; plate: string },
  result: CsddTechDataResult,
): DealerCheckCsddApplied {
  if (!result.found) {
    return {
      vin: normalizeVin(current.vin),
      plate: current.plate.trim(),
      csdd: null,
      found: false,
      message: result.message,
    };
  }
  return {
    vin: dealerCheckVinFromCsdd(result) || normalizeVin(current.vin),
    plate: dealerCheckPlateFromCsdd(result) || current.plate.trim(),
    csdd: result.data,
    found: true,
    message: result.message,
  };
}

export function dealerCheckCsddPreviewMatchesQuery(data: CsddTechData | null | undefined, query: string): boolean {
  if (!data || !query) return false;
  if (isValidPlateNumber(query)) {
    return normalizePlateNumber(data.registrationNumber) === normalizePlateNumber(query);
  }
  if (isValidVin(query)) {
    return normalizeVin(data.vin) === normalizeVin(query);
  }
  return false;
}

function formatDealerCheckCsddPreviewValue(key: string, value: string): string {
  if (DATE_KEYS.has(key)) return formatDealerCheckDateLv(value);
  return value;
}

/** Visi CSDD API lauki, ko admin forma jau rāda (tukšos izlaiž). */
export function dealerCheckCsddPreviewRows(data: CsddTechData | null | undefined): DealerCheckCsddPreviewRow[] {
  if (!data) return [];
  const values = csddRegistryFieldValues(data);
  const rows: DealerCheckCsddPreviewRow[] = [];
  for (const { key, label } of CSDD_FORM_STRUCTURED_FIELDS) {
    if (!isCsddApiLockedKey(key)) continue;
    const raw = values[key];
    if (!raw) continue;
    rows.push({
      key,
      label: label.replace(/:$/, ""),
      value: formatDealerCheckCsddPreviewValue(key, raw),
    });
  }
  return rows;
}

export function dealerCheckHasCsddPreview(data: CsddTechData | null | undefined): boolean {
  return dealerCheckCsddPreviewRows(data).length > 0;
}

export function dealerCheckCsddPreviewKeys(data: CsddTechData | null | undefined): string[] {
  return dealerCheckCsddPreviewRows(data).map((row) => row.key);
}

/** Vai priekšskatījumā ir visi aizpildītie reģistra API lauki (ne stub). */
export function dealerCheckCsddPreviewIsComplete(data: CsddTechData | null | undefined): boolean {
  if (!data) return false;
  const values = csddRegistryFieldValues(data);
  const expected = CSDD_API_LOCKED_KEYS.filter((key) => Boolean(values[key]));
  const shown = new Set(dealerCheckCsddPreviewKeys(data));
  return expected.length > 0 && expected.every((key) => shown.has(key));
}

export function parseDealerCheckCsddResponse(raw: unknown): CsddTechDataResult | null {
  return isCsddTechDataResult(raw) ? raw : null;
}
