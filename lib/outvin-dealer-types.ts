/**
 * Oficiālā dīlera atskaite — struktūra admin + PDF (bez nobraukuma tabulas dublēšanas PDF).
 *
 * Lauku kopa atbilst rūpnīcas / dīlera portāla izdrukai (BMW: MODEL SERIES … UPHOLSTERY CODE).
 * Tos pašus laukus aizpilda arī auto-records.com „VEHICLE INFORMATION” un AutoDNA / CarVertical
 * specifikācijas sadaļas, tāpēc lauku secība un nosaukumi ir vienā vietā.
 */

export type OutvinVehicleInfo = {
  model: string;
  modelSeries: string;
  vinCode: string;
  vehicleType: string;
  transmission: string;
  steeringSide: string;
  engineCode: string;
  engineNumber: string;
  body: string;
  drive: string;
  power: string;
  integrationLevel: string;
  currentILevel: string;
  developmentCode: string;
  modelCode: string;
  productionDate: string;
  firstRegistration: string;
  warrantyStartDate: string;
  countryRegion: string;
  color: string;
  colorCode: string;
  interior: string;
  interiorCode: string;
  fuel: string;
  displacement: string;
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
  { key: "model", labelEn: "Model", labelLv: "Modelis" },
  { key: "modelSeries", labelEn: "Model series", labelLv: "Modeļa sērija" },
  { key: "vinCode", labelEn: "VIN", labelLv: "VIN kods" },
  { key: "vehicleType", labelEn: "Vehicle type", labelLv: "Transportlīdzekļa tips" },
  { key: "transmission", labelEn: "Transmission", labelLv: "Ātrumkārba" },
  { key: "steeringSide", labelEn: "Steering", labelLv: "Stūre" },
  { key: "engineCode", labelEn: "Engine", labelLv: "Dzinējs" },
  { key: "engineNumber", labelEn: "Engine number", labelLv: "Dzinēja numurs" },
  { key: "body", labelEn: "Body", labelLv: "Virsbūve" },
  { key: "drive", labelEn: "Drive", labelLv: "Piedziņa" },
  { key: "power", labelEn: "Power", labelLv: "Jauda" },
  { key: "integrationLevel", labelEn: "Integration level", labelLv: "Integrācijas līmenis" },
  { key: "currentILevel", labelEn: "Current I level", labelLv: "Pašreizējais I-Level" },
  { key: "developmentCode", labelEn: "Development code", labelLv: "Izstrādes kods" },
  { key: "modelCode", labelEn: "Model code", labelLv: "Modeļa kods" },
  { key: "productionDate", labelEn: "Production date", labelLv: "Ražošanas datums" },
  { key: "firstRegistration", labelEn: "First registration", labelLv: "Pirmā reģistrācija" },
  { key: "warrantyStartDate", labelEn: "Warranty start date", labelLv: "Garantijas sākums" },
  { key: "countryRegion", labelEn: "Country/region", labelLv: "Valsts / reģions" },
  { key: "color", labelEn: "Colour", labelLv: "Krāsa" },
  { key: "colorCode", labelEn: "Colour code", labelLv: "Krāsas kods" },
  { key: "interior", labelEn: "Upholstery", labelLv: "Interjers" },
  { key: "interiorCode", labelEn: "Upholstery code", labelLv: "Interjera kods" },
  { key: "fuel", labelEn: "Fuel", labelLv: "Degviela" },
  { key: "displacement", labelEn: "Displacement", labelLv: "Tilpums" },
];

/** Vecās atskaites lauki → jaunie (saglabātie pasūtījumi nedrīkst pazaudēt datus). */
export const OUTVIN_LEGACY_VEHICLE_INFO_KEYS: Record<string, keyof OutvinVehicleInfo> = {
  generation: "modelSeries",
  series: "modelSeries",
  typeCode: "vehicleType",
};

export function emptyOutvinVehicleInfo(): OutvinVehicleInfo {
  return {
    model: "",
    modelSeries: "",
    vinCode: "",
    vehicleType: "",
    transmission: "",
    steeringSide: "",
    engineCode: "",
    engineNumber: "",
    body: "",
    drive: "",
    power: "",
    integrationLevel: "",
    currentILevel: "",
    developmentCode: "",
    modelCode: "",
    productionDate: "",
    firstRegistration: "",
    warrantyStartDate: "",
    countryRegion: "",
    color: "",
    colorCode: "",
    interior: "",
    interiorCode: "",
    fuel: "",
    displacement: "",
  };
}

/**
 * Saglabātie (arī vecie) dati → `OutvinVehicleInfo`. Vecos laukus (`generation`, `series`,
 * `typeCode`) pārliek uz jaunajiem tikai tad, ja jaunais lauks ir tukšs.
 */
export function parseOutvinVehicleInfoRaw(raw: unknown, maxLen = 500): OutvinVehicleInfo {
  const info = emptyOutvinVehicleInfo();
  if (!raw || typeof raw !== "object") return info;
  const v = raw as Record<string, unknown>;
  for (const { key } of OUTVIN_VEHICLE_INFO_ROWS) {
    const value = v[key];
    if (typeof value === "string") info[key] = value.slice(0, maxLen);
  }
  for (const [legacyKey, key] of Object.entries(OUTVIN_LEGACY_VEHICLE_INFO_KEYS)) {
    const value = v[legacyKey];
    if (typeof value !== "string" || !value.trim()) continue;
    if (info[key].trim()) continue;
    info[key] = value.slice(0, maxLen);
  }
  return info;
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

/** Plakans teksts AI / admin kontekstam (bez HTML). */
export function outvinDealerReportToPlainText(r: OutvinDealerReport): string {
  const lines: string[] = [];
  const vi = r.vehicleInfo;
  if (outvinVehicleInfoHasData(vi)) {
    lines.push("Transporta informācija:");
    for (const { key, labelLv, labelEn } of OUTVIN_VEHICLE_INFO_ROWS) {
      const v = vi[key].trim();
      if (v) lines.push(`${labelLv || labelEn}: ${v}`);
    }
  }
  const accident = r.accidentCheck.trim();
  if (accident) lines.push(`Negadījumu pārbaude: ${accident}`);
  const stolen = r.stolenCheck.trim();
  if (stolen) lines.push(`Nozagts transportlīdzeklis: ${stolen}`);
  const equipment = r.equipment.filter(outvinEquipmentLineHasData);
  if (equipment.length > 0) {
    lines.push("Komplektācija / aprīkojums:");
    for (const line of equipment) {
      const code = line.code.trim();
      const desc = line.description.trim();
      lines.push(code && desc ? `${code} — ${desc}` : code || desc);
    }
  }
  return lines.join("\n");
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
