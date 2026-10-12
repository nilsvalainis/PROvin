/**
 * VIN SCAN numurzīmes: LV, NL, LT, FI, UK. Īsa ASCII defise formātā.
 */

export type VinScanPlateKind = "lv" | "nl" | "lt" | "fi" | "uk";

export type VinScanPlates = {
  lv: string;
  nl: string;
  lt: string;
  fi: string;
  uk: string;
};

export const EMPTY_VIN_SCAN_PLATES: VinScanPlates = { lv: "", nl: "", lt: "", fi: "", uk: "" };

export function normalizeScanPlate(raw: string): string {
  return raw.trim().toUpperCase().replace(/[\s.-]/g, "");
}

export function emptyVinScanPlates(): VinScanPlates {
  return { ...EMPTY_VIN_SCAN_PLATES };
}

export function parseVinScanPlates(raw: unknown): VinScanPlates {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    lv: normalizeScanPlate(typeof o.lv === "string" ? o.lv : ""),
    nl: normalizeScanPlate(typeof o.nl === "string" ? o.nl : ""),
    lt: normalizeScanPlate(typeof o.lt === "string" ? o.lt : ""),
    fi: normalizeScanPlate(typeof o.fi === "string" ? o.fi : ""),
    uk: normalizeScanPlate(typeof o.uk === "string" ? o.uk : ""),
  };
}

export function isValidScanPlate(kind: VinScanPlateKind, raw: string): boolean {
  const n = normalizeScanPlate(raw);
  if (!n || !/^[A-Z0-9]+$/.test(n)) return false;
  switch (kind) {
    case "lv":
      return n.length >= 2 && n.length <= 6;
    case "nl":
      return n.length >= 5 && n.length <= 8;
    case "lt":
      return n.length >= 3 && n.length <= 6;
    case "fi":
      return n.length >= 3 && n.length <= 7;
    case "uk":
      return n.length >= 2 && n.length <= 8;
  }
}

export function hasAnyVinScanPlate(plates: VinScanPlates): boolean {
  return (["lv", "nl", "lt", "fi", "uk"] as const).some((kind) => isValidScanPlate(kind, plates[kind]));
}

export function vinScanPlateLabel(kind: VinScanPlateKind): string {
  switch (kind) {
    case "lv":
      return "LV reģ. nr.";
    case "nl":
      return "NL reģ. nr.";
    case "lt":
      return "LT reģ. nr.";
    case "fi":
      return "FI reģ. nr.";
    case "uk":
      return "UK reģ. nr.";
  }
}
