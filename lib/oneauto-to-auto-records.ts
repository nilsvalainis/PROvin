/**
 * OneAuto API → OFICIĀLĀ DĪLERA DATI (auto_records) lauki.
 * Ielāde nav atsevišķa klienta sadaļa: darbi, komplektācija un transporta info
 * iekrīt tajā pašā formā kā dīlera PDF / Copilot.
 */
import {
  extractCountryFromLocation,
  formatAutoRecordsDateForOutput,
  normalizeAutoRecordsOdometer,
  sortAutoRecordsDescending,
  type AutoRecordsServiceRow,
} from "@/lib/auto-records-paste-parse";
import {
  mergeAutoRecordsServiceWorkRow,
  type AutoRecordsServiceWorkRow,
} from "@/lib/auto-records-service-works";
import { countryFromDealerName } from "@/lib/dealer-report-extract";
import {
  ONEAUTO_DEFAULT_PRODUCT_IDS,
  ONEAUTO_PRODUCT_IDS,
  buildOneautoDisplay,
  filledOneautoKvRows,
  oneautoDisplayHasRows,
  parseOneautoProductIds,
  type OneautoDisplaySections,
  type OneautoKvRow,
  type OneautoProductId,
} from "@/lib/oneauto-catalog";
import {
  emptyOneautoBlock,
  parseResultMap,
  type OneautoBlockState,
  type OneautoProductResult,
} from "@/lib/oneauto-block";
import { oneautoDisplayToServiceWorks } from "@/lib/oneauto-dealer";
import {
  OUTVIN_VEHICLE_INFO_ROWS,
  emptyOutvinDealerReport,
  emptyOutvinVehicleInfo,
  outvinEquipmentLineHasData,
  type OutvinDealerReport,
  type OutvinEquipmentLine,
  type OutvinVehicleInfo,
} from "@/lib/outvin-dealer-types";

export type AutoRecordsOneautoIngest = {
  vinOverride: string;
  lastFetchedVin: string;
  fetchedAt: string;
  selectedProducts: OneautoProductId[];
  lastCostEur: string;
  results: Partial<Record<OneautoProductId, OneautoProductResult>>;
};

export function emptyOneautoIngest(): AutoRecordsOneautoIngest {
  return {
    vinOverride: "",
    lastFetchedVin: "",
    fetchedAt: "",
    selectedProducts: [...ONEAUTO_DEFAULT_PRODUCT_IDS],
    lastCostEur: "",
    results: {},
  };
}

export function parseOneautoIngestRaw(raw: unknown): AutoRecordsOneautoIngest {
  const d = emptyOneautoIngest();
  if (!raw || typeof raw !== "object") return d;
  const o = raw as Record<string, unknown>;
  const selected = parseOneautoProductIds(o.selectedProducts);
  return {
    vinOverride: typeof o.vinOverride === "string" ? o.vinOverride.slice(0, 24) : "",
    lastFetchedVin: typeof o.lastFetchedVin === "string" ? o.lastFetchedVin.slice(0, 24) : "",
    fetchedAt: typeof o.fetchedAt === "string" ? o.fetchedAt.slice(0, 40) : "",
    selectedProducts: selected.length > 0 ? selected : d.selectedProducts,
    lastCostEur: typeof o.lastCostEur === "string" ? o.lastCostEur.slice(0, 20) : "",
    results: parseResultMap(o.results),
  };
}

export function ingestFromOneautoBlock(oa: OneautoBlockState): AutoRecordsOneautoIngest {
  return {
    vinOverride: oa.vinOverride,
    lastFetchedVin: oa.lastFetchedVin,
    fetchedAt: oa.fetchedAt,
    selectedProducts:
      oa.selectedProducts.length > 0 ? oa.selectedProducts : [...ONEAUTO_DEFAULT_PRODUCT_IDS],
    lastCostEur: oa.lastCostEur,
    results: oa.results,
  };
}

const LABEL_TO_FIELD: { re: RegExp; key: keyof OutvinVehicleInfo }[] = [
  { re: /^(vin(\s*code)?|vehicle\s*identification(\s*number)?)$/i, key: "vinCode" },
  { re: /^(model\s*(range|series)|mode[lļ]a\s*s[eē]rija)(\s*desc)?$/i, key: "modelSeries" },
  { re: /^(model\s*code|mode[lļ]a\s*kods)$/i, key: "modelCode" },
  {
    re: /^(oem\s*)?(vehicle\s*desc|vehicle\s*description|derivative(\s*desc)?|model(\s*desc)?|modelis)$/i,
    key: "model",
  },
  { re: /^(engine\s*number|dzin[eē]ja\s*numurs)$/i, key: "engineNumber" },
  { re: /^(oem[_\s-]?engine|engine|dzin[eē]j|motor)(?!.*num)/i, key: "engineCode" },
  { re: /^(oem[_\s-]?transmission|transmission|gearbox|[aā]trumk[aā]rba|k[aā]rba)/i, key: "transmission" },
  { re: /^(power(\s*kw)?|jauda|kw)$/i, key: "power" },
  { re: /^(fuel(\s*type)?|degviel)/i, key: "fuel" },
  { re: /^(displacement|tilpums|capacity|ccm)$/i, key: "displacement" },
  { re: /^(drive|drivetrain|piedzi[nņ]a)/i, key: "drive" },
  { re: /^(body(\s*type)?|virsb[uū]ve)/i, key: "body" },
  { re: /^(vehicle\s*type|tips|type)$/i, key: "vehicleType" },
  { re: /^(steering|st[uū]re)/i, key: "steeringSide" },
  { re: /^(colou?r\s*code|paint\s*code|kr[aā]sas\s*kods)$/i, key: "colorCode" },
  { re: /^(colou?r|paint|kr[aā]sa)/i, key: "color" },
  { re: /^(upholstery\s*code|interior\s*code|interjera\s*kods)$/i, key: "interiorCode" },
  { re: /^(upholstery|interior|interjers)/i, key: "interior" },
  { re: /^(manufactured(\s*year)?|production|ra[zž]o[sš]anas|build\s*date)$/i, key: "productionDate" },
  { re: /^(first\s*reg|pirm[aā]\s*re[gģ])/i, key: "firstRegistration" },
  { re: /^(warranty)/i, key: "warrantyStartDate" },
  { re: /^(country|valsts|region)/i, key: "countryRegion" },
];

const POWER_BHP_RE = /^(power\s*(bhp|hp|ps)|bhp|hp|ps|zs)$/i;
const MODEL_YEAR_RE = /^(oem\s*)?model\s*year$/i;
const MANUFACTURER_RE = /^(manufacturer|make|marka)(\s*desc)?$/i;
const COLOR_CODE_IN_VALUE_RE = /^(.*?)\s*\(([0-9A-Za-z][0-9A-Za-z /-]{0,20})\)\s*$/;

function normalizeLabel(label: string): string {
  return label.replace(/^oem[_\s-]+/i, "").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
}

function splitColourAndCode(raw: string): { color: string; code: string } {
  const t = raw.trim();
  const m = t.match(COLOR_CODE_IN_VALUE_RE);
  if (m?.[1]?.trim() && m[2]?.trim()) return { color: m[1].trim(), code: m[2].trim() };
  return { color: t, code: "" };
}

function formatPowerKwBhp(kw: string, bhp: string): string {
  const kwN = kw.replace(/[^\d.,]/g, "").replace(",", ".");
  const bhpN = bhp.replace(/[^\d.,]/g, "").replace(",", ".");
  const kwPart = kwN ? `${kwN.replace(/\.0$/, "")} kW` : "";
  const bhpPart = bhpN ? `${bhpN.replace(/\.0$/, "")} ZS` : "";
  if (kwPart && bhpPart) return `${kwPart} (${bhpPart})`;
  return kwPart || bhpPart;
}

export function oneautoPowertrainToVehicleInfo(rows: readonly OneautoKvRow[]): {
  vehicleInfo: Partial<OutvinVehicleInfo>;
  leftovers: OneautoKvRow[];
} {
  const vehicleInfo: Partial<OutvinVehicleInfo> = {};
  const leftovers: OneautoKvRow[] = [];
  let powerBhp = "";
  let modelYear = "";
  let manufacturer = "";
  for (const row of filledOneautoKvRows(rows)) {
    const label = normalizeLabel(row.label);
    const value = row.value.trim();
    if (POWER_BHP_RE.test(label)) {
      if (!powerBhp) powerBhp = value;
      continue;
    }
    if (MODEL_YEAR_RE.test(label)) {
      if (!modelYear) modelYear = value;
      continue;
    }
    if (MANUFACTURER_RE.test(label)) {
      if (!manufacturer) manufacturer = value;
      continue;
    }
    const hit = LABEL_TO_FIELD.find(({ re }) => re.test(label));
    if (!hit) {
      leftovers.push(row);
      continue;
    }
    const current = (vehicleInfo[hit.key] ?? "").trim();
    if (!current) vehicleInfo[hit.key] = value.slice(0, 500);
  }

  if (vehicleInfo.color) {
    const split = splitColourAndCode(vehicleInfo.color);
    vehicleInfo.color = split.color.slice(0, 500);
    if (!vehicleInfo.colorCode && split.code) vehicleInfo.colorCode = split.code.slice(0, 80);
  }
  if (powerBhp && !/zs|bhp|\bhp\b/i.test(vehicleInfo.power ?? "")) {
    const formatted = formatPowerKwBhp(vehicleInfo.power ?? "", powerBhp);
    if (formatted) vehicleInfo.power = formatted;
  }
  if (!vehicleInfo.productionDate && modelYear) {
    vehicleInfo.productionDate = modelYear.slice(0, 40);
  } else if (modelYear && vehicleInfo.productionDate !== modelYear) {
    leftovers.push({ label: "Modeļa gads", value: modelYear });
  }
  if (manufacturer) {
    const model = (vehicleInfo.model ?? "").trim();
    if (!model) vehicleInfo.model = manufacturer.slice(0, 500);
    else if (!model.toLowerCase().includes(manufacturer.toLowerCase())) {
      vehicleInfo.model = `${manufacturer} ${model}`.slice(0, 500);
    }
  }
  return { vehicleInfo, leftovers };
}

function looksLikeEquipCode(raw: string): boolean {
  const t = raw.trim();
  if (!t || t.length > 12) return false;
  return /^(PR)?[0-9A-Z]{2,8}$/i.test(t) || /^S[0-9A-Z]{4}$/i.test(t);
}

export function oneautoKvToEquipmentLine(row: OneautoKvRow): OutvinEquipmentLine {
  const a = row.label.replace(/\s+/g, " ").trim();
  const b = row.value.replace(/\s+/g, " ").trim();
  const aCode = looksLikeEquipCode(a);
  const bCode = looksLikeEquipCode(b);
  if (bCode && !aCode) return { code: b, description: a === "Pozīcija" ? "" : a };
  if (aCode && !bCode) return { code: a, description: b };
  if (/^poz[iī]cija$/i.test(a)) return { code: "", description: b };
  return { code: "", description: [a, b].filter(Boolean).join(" ").slice(0, 400) };
}

export function oneautoDisplayToEquipment(display: OneautoDisplaySections): OutvinEquipmentLine[] {
  return filledOneautoKvRows(display.equipment)
    .map(oneautoKvToEquipmentLine)
    .filter(outvinEquipmentLineHasData);
}

function hasSpecCode(value: string): boolean {
  return /\([0-9A-Za-z][0-9A-Za-z /-]{1,20}\)/.test(value.trim());
}

function mergeVehicleField(current: string, incoming: string, override: boolean): string {
  const next = incoming.trim();
  if (!next) return current;
  const cur = current.trim();
  if (!cur) return next.slice(0, 500);
  if (cur === next) return current;
  if (override) return next.slice(0, 500);
  if (hasSpecCode(next) && !hasSpecCode(cur)) return next.slice(0, 500);
  return current;
}

function mergeEquipment(
  existing: OutvinEquipmentLine[],
  incoming: OutvinEquipmentLine[],
  replace: boolean,
): OutvinEquipmentLine[] {
  const current = existing.filter(outvinEquipmentLineHasData);
  if (incoming.length === 0) return current;
  if (replace) return incoming;
  const seen = new Set(current.map((l) => l.code.trim().toUpperCase() || l.description.trim().toLowerCase()));
  const added = incoming.filter(
    (l) => !seen.has(l.code.trim().toUpperCase() || l.description.trim().toLowerCase()),
  );
  return added.length > 0 ? [...current, ...added] : current;
}

function mileageKey(r: AutoRecordsServiceRow): string {
  return `${formatAutoRecordsDateForOutput(r.date) || r.date.trim()}|${normalizeAutoRecordsOdometer(r.odometer)}`;
}

function mergeMileageRows(
  existing: AutoRecordsServiceRow[],
  incoming: AutoRecordsServiceRow[],
): AutoRecordsServiceRow[] {
  const withData = existing.filter((r) => r.date.trim() || r.odometer.trim() || r.country.trim());
  const byKey = new Map(withData.map((r) => [mileageKey(r), r]));
  for (const row of incoming) {
    if (!row.date.trim() && !row.odometer.trim()) continue;
    const key = mileageKey(row);
    const cur = byKey.get(key);
    if (!cur) {
      byKey.set(key, row);
      continue;
    }
    if (!cur.country.trim() && row.country.trim()) {
      byKey.set(key, { ...cur, country: row.country });
    }
  }
  const next = sortAutoRecordsDescending([...byKey.values()]);
  return next.length > 0 ? next : existing;
}

function countryFromPlace(place: string): string {
  return countryFromDealerName(place) || extractCountryFromLocation(place);
}

export function oneautoDisplayToMileageRows(display: OneautoDisplaySections): AutoRecordsServiceRow[] {
  return oneautoDisplayToServiceWorks(display)
    .filter((r) => r.date.trim() || r.odometer.trim())
    .map((r) => ({
      date: r.date,
      odometer: r.odometer,
      country: countryFromPlace(r.location),
    }));
}

function fillEmptyNote(current: string, incoming: string): string {
  if (current.trim()) return current;
  return incoming.trim().slice(0, 12000);
}

function appendOemLeftovers(current: string, leftovers: OneautoKvRow[]): string {
  if (leftovers.length === 0) return current;
  const body = leftovers.map((r) => `${r.label}: ${r.value}`).join("\n");
  if (current.includes(body)) return current;
  return [current.trim(), `OEM (OneAuto)\n${body}`].filter(Boolean).join("\n\n").slice(0, 12000);
}

export type AutoRecordsOneautoTarget = {
  outvinReport?: OutvinDealerReport;
  serviceWorks?: AutoRecordsServiceWorkRow[];
  serviceHistory?: AutoRecordsServiceRow[];
  serviceHistoryNotes?: string;
  oilChangeIntervalNotes?: string;
  comments?: string;
  aiContextRaw?: string;
  oneautoIngest?: AutoRecordsOneautoIngest;
};

export function applyOneautoToAutoRecords<T extends AutoRecordsOneautoTarget>(
  current: T,
  input: {
    display: OneautoDisplaySections;
    ingest: AutoRecordsOneautoIngest;
    notes?: {
      serviceHistoryNotes?: string;
      oilChangeIntervalNotes?: string;
      comments?: string;
      aiContextRaw?: string;
    };
    vehicleOverride?: boolean;
  },
): T {
  const override = input.vehicleOverride === true;
  const report = current.outvinReport ?? emptyOutvinDealerReport();
  const mapped = oneautoPowertrainToVehicleInfo(input.display.powertrain);
  const vehicleInfo: OutvinVehicleInfo = { ...emptyOutvinVehicleInfo(), ...report.vehicleInfo };
  for (const { key } of OUTVIN_VEHICLE_INFO_ROWS) {
    const incoming = (mapped.vehicleInfo[key] ?? "").trim();
    if (!incoming) continue;
    vehicleInfo[key] = mergeVehicleField(vehicleInfo[key], incoming, override);
  }
  if (!vehicleInfo.vinCode.trim() && input.ingest.lastFetchedVin.trim()) {
    vehicleInfo.vinCode = input.ingest.lastFetchedVin.trim().slice(0, 24);
  }

  const equipment = mergeEquipment(
    report.equipment,
    oneautoDisplayToEquipment(input.display),
    override && input.ingest.selectedProducts.includes("oe_build_sheet"),
  );

  let serviceWorks = current.serviceWorks ?? [];
  for (const row of oneautoDisplayToServiceWorks(input.display)) {
    serviceWorks = mergeAutoRecordsServiceWorkRow(serviceWorks, row);
  }

  const serviceHistory = mergeMileageRows(
    current.serviceHistory ?? [],
    oneautoDisplayToMileageRows(input.display),
  );

  const notes = input.notes ?? {};
  return {
    ...current,
    outvinReport: { ...report, vehicleInfo, equipment },
    serviceWorks,
    serviceHistory,
    serviceHistoryNotes: fillEmptyNote(current.serviceHistoryNotes ?? "", notes.serviceHistoryNotes ?? ""),
    oilChangeIntervalNotes: fillEmptyNote(
      current.oilChangeIntervalNotes ?? "",
      notes.oilChangeIntervalNotes ?? "",
    ),
    comments: fillEmptyNote(current.comments ?? "", notes.comments ?? ""),
    aiContextRaw: appendOemLeftovers(
      fillEmptyNote(current.aiContextRaw ?? "", notes.aiContextRaw ?? ""),
      mapped.leftovers,
    ),
    oneautoIngest: input.ingest,
  };
}

export function oneautoBlockHasFoldableContent(oa: OneautoBlockState | null | undefined): boolean {
  if (!oa) return false;
  if (oneautoDisplayHasRows(oa.display)) return true;
  if (ONEAUTO_PRODUCT_IDS.some((id) => oa.results[id]?.payload != null)) return true;
  return Boolean(
    oa.lastFetchedVin.trim() ||
      oa.serviceHistoryNotes.trim() ||
      oa.oilChangeIntervalNotes.trim() ||
      oa.comments.trim() ||
      oa.aiContextRaw.trim(),
  );
}

function displayFromOneauto(oa: OneautoBlockState): OneautoDisplaySections {
  if (oneautoDisplayHasRows(oa.display)) return oa.display;
  const payloads: Partial<Record<OneautoProductId, unknown>> = {};
  for (const id of ONEAUTO_PRODUCT_IDS) payloads[id] = oa.results[id]?.payload;
  return buildOneautoDisplay(payloads);
}

export function foldOneautoBlockIntoAutoRecords<T extends AutoRecordsOneautoTarget>(
  autoRecords: T,
  oneauto: OneautoBlockState,
): { autoRecords: T; oneauto: OneautoBlockState } {
  if (!oneautoBlockHasFoldableContent(oneauto)) {
    return { autoRecords, oneauto };
  }
  return {
    autoRecords: applyOneautoToAutoRecords(autoRecords, {
      display: displayFromOneauto(oneauto),
      ingest: ingestFromOneautoBlock(oneauto),
      notes: {
        serviceHistoryNotes: oneauto.serviceHistoryNotes,
        oilChangeIntervalNotes: oneauto.oilChangeIntervalNotes,
        comments: oneauto.comments,
        aiContextRaw: oneauto.aiContextRaw,
      },
      vehicleOverride: false,
    }),
    oneauto: emptyOneautoBlock(),
  };
}

export function resolveDealerAutoRecords<T extends AutoRecordsOneautoTarget>(
  autoRecords: T | null | undefined,
  oneauto: OneautoBlockState | null | undefined,
  empty: T,
): T {
  const ar = autoRecords ?? empty;
  if (!oneauto || !oneautoBlockHasFoldableContent(oneauto)) return ar;
  return foldOneautoBlockIntoAutoRecords(ar, oneauto).autoRecords;
}

export function oneautoIngestHasMeta(ingest: AutoRecordsOneautoIngest | null | undefined): boolean {
  if (!ingest) return false;
  return Boolean(ingest.lastFetchedVin.trim() || ingest.fetchedAt.trim() || Object.keys(ingest.results).length > 0);
}
