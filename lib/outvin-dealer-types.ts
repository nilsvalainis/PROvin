/**
 * Outvin dīlera atskaite — struktūra admin + PDF (bez nobraukuma tabulas dublēšanas PDF).
 */

export type OutvinVehicleInfo = {
  vinCode: string;
  series: string;
  typeCode: string;
  steeringSide: string;
  interior: string;
  model: string;
  generation: string;
  engineCode: string;
  color: string;
  transmission: string;
};

export type OutvinEquipmentLine = {
  code: string;
  description: string;
};

export type OutvinDealerReport = {
  vehicleInfo: OutvinVehicleInfo;
  /** Negadījumu pārbaude — brīvs teksts vai „Nav ierakstu.” */
  accidentCheck: string;
  /** Nozagts transportlīdzeklis — brīvs teksts vai „Nav ierakstu.” */
  stolenCheck: string;
  equipment: OutvinEquipmentLine[];
};

export const OUTVIN_NO_RECORDS_LV = "Nav ierakstu.";

export const OUTVIN_VEHICLE_INFO_ROWS: {
  key: keyof OutvinVehicleInfo;
  labelEn: string;
  labelLv: string;
}[] = [
  { key: "vinCode", labelEn: "VIN Code", labelLv: "VIN kods" },
  { key: "series", labelEn: "Series", labelLv: "Sērija" },
  { key: "typeCode", labelEn: "Type code", labelLv: "Tips" },
  { key: "steeringSide", labelEn: "Steering side", labelLv: "Stūre" },
  { key: "interior", labelEn: "Interior", labelLv: "Interjers" },
  { key: "model", labelEn: "Model", labelLv: "Modelis" },
  { key: "generation", labelEn: "Generation", labelLv: "Paaudze" },
  { key: "engineCode", labelEn: "Engine code", labelLv: "Dzinēja kods" },
  { key: "color", labelEn: "Color", labelLv: "Krāsa" },
  { key: "transmission", labelEn: "Transmission", labelLv: "Ātrumkārba" },
];

/** PDF: divas kolonnas (kā Outvin atskaitē). */
export const OUTVIN_VEHICLE_INFO_PDF_PAIRS: [keyof OutvinVehicleInfo, keyof OutvinVehicleInfo][] = [
  ["vinCode", "model"],
  ["series", "generation"],
  ["typeCode", "engineCode"],
  ["steeringSide", "color"],
  ["interior", "transmission"],
];

export function emptyOutvinVehicleInfo(): OutvinVehicleInfo {
  return {
    vinCode: "",
    series: "",
    typeCode: "",
    steeringSide: "",
    interior: "",
    model: "",
    generation: "",
    engineCode: "",
    color: "",
    transmission: "",
  };
}

export function emptyOutvinEquipmentLine(): OutvinEquipmentLine {
  return { code: "", description: "" };
}

export function emptyOutvinDealerReport(): OutvinDealerReport {
  return {
    vehicleInfo: emptyOutvinVehicleInfo(),
    accidentCheck: "",
    stolenCheck: "",
    equipment: [],
  };
}

export function outvinEquipmentLineHasData(l: OutvinEquipmentLine): boolean {
  return Boolean(l.code.trim() || l.description.trim());
}

export function outvinVehicleInfoHasData(v: OutvinVehicleInfo): boolean {
  return OUTVIN_VEHICLE_INFO_ROWS.some(({ key }) => v[key].trim().length > 0);
}

export function outvinDealerReportHasContent(r: OutvinDealerReport | undefined | null): boolean {
  if (!r) return false;
  return (
    outvinVehicleInfoHasData(r.vehicleInfo) ||
    r.accidentCheck.trim().length > 0 ||
    r.stolenCheck.trim().length > 0 ||
    r.equipment.some(outvinEquipmentLineHasData)
  );
}
