/**
 * Piemēro Order Copilot darbības WorkspaceSourceBlocks (serveris + klients).
 */
import {
  emptyLtabRow,
  emptyAutoRecordsServiceRow,
  emptyVendorAvotuBlock,
  emptyVinRegistryIncidentRow,
  emptyVinRegistryMileageRow,
  ltabRowHasData,
  mergeSourceBlocksWithDefaults,
  repairVinRegistryBlock,
  sortVinRegistryMileage,
  vinRegistryIncidentRowHasData,
  vinRegistryMileageRowHasData,
  type LtabIncidentRow,
  type WorkspaceSourceBlocks,
  type VendorAvotuBlockState,
  type LtabBlockState,
  type AutoRecordsBlockState,
  type CitiAvotiBlockState,
  type VinRegistryBlockState,
  type VinRegistryIncidentRow,
  type VinRegistryMileageRow,
} from "@/lib/admin-source-blocks";
import {
  ADMIN_MILEAGE_PASTE_RAW_MAX_LEN,
  ADMIN_PDF_IMPORT_RAW_MAX_LEN,
  ADMIN_RAW_UNPROCESSED_MAX_LEN,
} from "@/lib/admin-raw-field-limits";
import { clipAiContextRaw } from "@/lib/admin-ai-context-raw";
import {
  autoRecordsMileageRowHasData,
  formatAutoRecordsDateForOutput,
  normalizeAutoRecordsOdometer,
  sortAutoRecordsDescending,
  type AutoRecordsServiceRow,
} from "@/lib/auto-records-paste-parse";
import { normalizeCountryNameLv } from "@/lib/country-names-lv";
import { sanitizeVinRegistryClientText } from "@/lib/vin-registry-client-text";
import {
  ltabCertificateHasContent,
  ltabCertificateToIncidentRows,
  type LtabCertificate,
} from "@/lib/ltab-report-extract";
import { normalizeLossAmountEurDisplay } from "@/lib/loss-amount-format";
import {
  emptyOutvinDealerReport,
  outvinEquipmentLineHasData,
  OUTVIN_VEHICLE_INFO_ROWS,
  type OutvinEquipmentLine,
  type OutvinVehicleInfo,
} from "@/lib/outvin-dealer-types";
import { mergeServiceHistoryFieldText } from "@/lib/vendor-service-history";
import {
  autoRecordsServiceWorkRowsToPlainText,
  mergeAutoRecordsServiceWorkRow,
  type AutoRecordsServiceWorkRow,
} from "@/lib/auto-records-service-works";
import {
  ccVinDamageRowHasData,
  emptyCcVinDamageRow,
  emptyCcVinMileageRow,
  type CcVinBlockState,
  type CcVinDamageRow,
} from "@/lib/cc-vin-report";
import type {
  CopilotAction,
  CopilotAppendRawAction,
  CopilotConfidence,
  CopilotDealerVehicleInfoAction,
  CopilotIncidentAction,
  CopilotMileageAction,
  CopilotRegistryFieldsAction,
  CopilotServiceHistoryAction,
  CopilotSourceKey,
} from "@/lib/admin-copilot-types";
import { isCopilotSourceKey, isVinRegistryCopilotSource } from "@/lib/admin-copilot-types";

export type CopilotApplyResult = {
  sourceBlocks: WorkspaceSourceBlocks;
  applied: CopilotAction[];
  skipped: { action: CopilotAction; reason: string }[];
  changedKeys: CopilotSourceKey[];
};

function normalizeIncidentRow(a: CopilotIncidentAction): LtabIncidentRow | null {
  const csngDate = formatAutoRecordsDateForOutput(a.date.trim());
  const rawLoss = a.lossAmount.trim();
  const lossAmount = normalizeLossAmountEurDisplay(rawLoss) || rawLoss;
  const incidentNo = normalizeCountryNameLv(a.country.trim()) || a.country.trim();
  const row: LtabIncidentRow = { csngDate, lossAmount, incidentNo };
  if (!ltabRowHasData(row)) return null;
  return row;
}

function normalizeMileageRow(a: CopilotMileageAction): AutoRecordsServiceRow | null {
  const date = formatAutoRecordsDateForOutput(a.date.trim());
  const odometer = normalizeAutoRecordsOdometer(a.odometer.trim()) || a.odometer.replace(/\D/g, "");
  const country = normalizeCountryNameLv(a.country.trim()) || a.country.trim();
  const row: AutoRecordsServiceRow = { date, odometer, country };
  // Mazi reģistru rādījumi (0 km, 14 km) ir derīgi, ja ir datums.
  if (!date.trim() || odometer === "") return null;
  if (!autoRecordsMileageRowHasData(row)) return null;
  return row;
}

function incidentKey(r: LtabIncidentRow): string {
  return `${r.csngDate}|${r.lossAmount}|${r.incidentNo}`;
}

function mileageKey(r: AutoRecordsServiceRow): string {
  return `${r.date}|${r.odometer}|${r.country}`;
}

function normDateKey(raw: string): string {
  return formatAutoRecordsDateForOutput(raw.trim()) || raw.trim();
}

function normLossKey(raw: string): string {
  const t = normalizeLossAmountEurDisplay(raw.trim()) || raw.trim();
  return t.replace(/\s+/g, " ").toLowerCase();
}

function normOdoKey(raw: string): string {
  return normalizeAutoRecordsOdometer(raw.trim()) || raw.replace(/\D/g, "");
}

function normCountryKey(raw: string): string {
  return normalizeCountryNameLv(raw.trim()) || raw.trim();
}

/** Collect confirmed countries for event keys from existing tables + this action batch. */
function collectConfirmedCountryMaps(
  blocks: WorkspaceSourceBlocks,
  actions: CopilotAction[],
): { byIncident: Map<string, string>; byMileage: Map<string, string> } {
  const byIncident = new Map<string, string>();
  const byMileage = new Map<string, string>();
  const incidentConflict = new Set<string>();
  const mileageConflict = new Set<string>();

  const putIncident = (date: string, loss: string, country: string) => {
    const c = normCountryKey(country);
    if (!c || !date) return;
    const key = `${normDateKey(date)}|${normLossKey(loss)}`;
    if (incidentConflict.has(key)) return;
    const prev = byIncident.get(key);
    if (prev && prev !== c) {
      byIncident.delete(key);
      incidentConflict.add(key);
      return;
    }
    byIncident.set(key, c);
  };
  const putMileage = (date: string, odo: string, country: string) => {
    const c = normCountryKey(country);
    if (!c || !date || !odo) return;
    const key = `${normDateKey(date)}|${normOdoKey(odo)}`;
    if (mileageConflict.has(key)) return;
    const prev = byMileage.get(key);
    if (prev && prev !== c) {
      byMileage.delete(key);
      mileageConflict.add(key);
      return;
    }
    byMileage.set(key, c);
  };

  const b = mergeSourceBlocksWithDefaults(blocks);
  for (const r of b.autodna.incidents.filter(ltabRowHasData)) putIncident(r.csngDate, r.lossAmount, r.incidentNo);
  for (const r of b.carvertical.incidents.filter(ltabRowHasData)) putIncident(r.csngDate, r.lossAmount, r.incidentNo);
  for (const r of b.ltab.rows.filter(ltabRowHasData)) putIncident(r.csngDate, r.lossAmount, r.incidentNo);
  const citi0 = b.citi_avoti.sections[0];
  if (citi0) {
    for (const r of citi0.incidents.filter(ltabRowHasData)) putIncident(r.csngDate, r.lossAmount, r.incidentNo);
  }

  const ccVin0 = b.cc_vin;
  for (const r of (ccVin0.damages ?? []).filter(ccVinDamageRowHasData)) {
    putIncident(r.date, r.amount, r.region);
  }

  const mileRows = [
    ...b.autodna.serviceHistory,
    ...b.carvertical.serviceHistory,
    ...b.auto_records.serviceHistory,
    ...(citi0?.serviceHistory ?? []),
    ...(b.csdd.mileageHistory ?? []),
    ...(ccVin0.mileage ?? []),
  ];
  for (const r of mileRows) {
    if (autoRecordsMileageRowHasData(r)) putMileage(r.date, r.odometer, r.country);
  }

  for (const a of actions) {
    if (a.type === "upsert_incident" && a.country.trim()) {
      putIncident(a.date, a.lossAmount, a.country);
    }
    if (a.type === "upsert_mileage" && a.country.trim()) {
      putMileage(a.date, a.odometer, a.country);
    }
  }

  return { byIncident, byMileage };
}

/**
 * Fill empty country on incident/mileage actions when another source (or sibling
 * action) already confirms the same event at 100% (unique date+loss / date+km).
 */
export function enrichCopilotActionCountries(
  blocks: WorkspaceSourceBlocks,
  actions: CopilotAction[],
): CopilotAction[] {
  const { byIncident, byMileage } = collectConfirmedCountryMaps(blocks, actions);
  return actions.map((a) => {
    if (a.type === "upsert_incident" && !a.country.trim()) {
      const found = byIncident.get(`${normDateKey(a.date)}|${normLossKey(a.lossAmount)}`);
      if (found) return { ...a, country: found };
    }
    if (a.type === "upsert_mileage" && !a.country.trim()) {
      const found = byMileage.get(`${normDateKey(a.date)}|${normOdoKey(a.odometer)}`);
      if (found) return { ...a, country: found };
    }
    return a;
  });
}

function mergeIncidentRows(existing: LtabIncidentRow[], incoming: LtabIncidentRow): LtabIncidentRow[] {
  const withData = existing.filter(ltabRowHasData);
  const key = incidentKey(incoming);
  if (withData.some((r) => incidentKey(r) === key)) return existing.length ? existing : [incoming];
  const emptyIdx = existing.findIndex((r) => !ltabRowHasData(r));
  if (emptyIdx >= 0) {
    const next = [...existing];
    next[emptyIdx] = incoming;
    return next;
  }
  return [...withData, incoming];
}

function mergeMileageRows(
  existing: AutoRecordsServiceRow[],
  incoming: AutoRecordsServiceRow,
): AutoRecordsServiceRow[] {
  const withData = existing.filter(autoRecordsMileageRowHasData);
  const key = mileageKey(incoming);
  if (withData.some((r) => mileageKey(r) === key)) {
    return sortAutoRecordsDescending(withData.length ? withData : [incoming]);
  }
  const emptyIdx = existing.findIndex((r) => !autoRecordsMileageRowHasData(r));
  let next: AutoRecordsServiceRow[];
  if (emptyIdx >= 0) {
    next = [...existing];
    next[emptyIdx] = incoming;
  } else {
    next = [...withData, incoming];
  }
  return sortAutoRecordsDescending(next);
}

function ensureVendor(b: VendorAvotuBlockState | undefined): VendorAvotuBlockState {
  return b ? { ...emptyVendorAvotuBlock(), ...b } : emptyVendorAvotuBlock();
}

function applyIncidentToVendor(b: VendorAvotuBlockState, row: LtabIncidentRow): VendorAvotuBlockState {
  const base = ensureVendor(b);
  return { ...base, incidents: mergeIncidentRows(base.incidents ?? [emptyLtabRow()], row) };
}

function applyMileageToVendor(b: VendorAvotuBlockState, row: AutoRecordsServiceRow): VendorAvotuBlockState {
  const base = ensureVendor(b);
  return {
    ...base,
    serviceHistory: mergeMileageRows(base.serviceHistory ?? [emptyAutoRecordsServiceRow()], row),
  };
}

function vinRegistryMileageKey(r: VinRegistryMileageRow): string {
  return `${r.date}|${r.odometer}|${r.country}`;
}

function vinRegistryIncidentKey(r: VinRegistryIncidentRow): string {
  return `${r.date}|${r.amount}|${r.country}|${r.note}`;
}

function mergeVinRegistryMileage(
  existing: VinRegistryMileageRow[],
  incoming: VinRegistryMileageRow,
): VinRegistryMileageRow[] {
  const withData = existing.filter(vinRegistryMileageRowHasData);
  const key = vinRegistryMileageKey(incoming);
  if (withData.some((r) => vinRegistryMileageKey(r) === key)) {
    return sortVinRegistryMileage(withData.length ? withData : [incoming]);
  }
  const emptyIdx = existing.findIndex((r) => !vinRegistryMileageRowHasData(r));
  let next: VinRegistryMileageRow[];
  if (emptyIdx >= 0) {
    next = [...existing];
    next[emptyIdx] = incoming;
  } else {
    next = [...withData, incoming];
  }
  return sortVinRegistryMileage(next);
}

function mergeVinRegistryIncidents(
  existing: VinRegistryIncidentRow[],
  incoming: VinRegistryIncidentRow,
): VinRegistryIncidentRow[] {
  const withData = existing.filter(vinRegistryIncidentRowHasData);
  const key = vinRegistryIncidentKey(incoming);
  if (withData.some((r) => vinRegistryIncidentKey(r) === key)) {
    return withData.length ? existing : [incoming];
  }
  const emptyIdx = existing.findIndex((r) => !vinRegistryIncidentRowHasData(r));
  if (emptyIdx >= 0) {
    const next = [...existing];
    next[emptyIdx] = incoming;
    return next;
  }
  return [...withData, incoming];
}

function mergeRegistryText(existing: string, incoming: string): string {
  const inc = sanitizeVinRegistryClientText(incoming);
  if (!inc) return sanitizeVinRegistryClientText(existing);
  const cur = sanitizeVinRegistryClientText(existing);
  if (!cur) return inc;
  if (cur.includes(inc)) return cur;
  if (inc.includes(cur) && inc.length >= cur.length) return inc;
  return sanitizeVinRegistryClientText(`${cur}\n${inc}`);
}

function applyVinRegistryMileage(
  block: VinRegistryBlockState,
  action: CopilotMileageAction,
): VinRegistryBlockState | null {
  const date = formatAutoRecordsDateForOutput(action.date.trim()) || action.date.trim();
  const odometer = normalizeAutoRecordsOdometer(action.odometer.trim()) || action.odometer.replace(/\D/g, "");
  const country = normalizeCountryNameLv(action.country.trim()) || action.country.trim();
  if (!odometer) return null;
  const row: VinRegistryMileageRow = {
    date,
    odometer,
    country,
    origin: action.note?.trim() || "",
  };
  if (!vinRegistryMileageRowHasData(row)) return null;
  const base = repairVinRegistryBlock(block);
  return {
    ...base,
    mileage: mergeVinRegistryMileage(base.mileage ?? [emptyVinRegistryMileageRow()], row),
  };
}

function applyVinRegistryIncident(
  block: VinRegistryBlockState,
  action: CopilotIncidentAction,
): VinRegistryBlockState | null {
  const date = formatAutoRecordsDateForOutput(action.date.trim()) || action.date.trim();
  const amount = normalizeLossAmountEurDisplay(action.lossAmount.trim()) || action.lossAmount.trim();
  const country = normalizeCountryNameLv(action.country.trim()) || action.country.trim();
  const note = action.note?.trim() || "";
  const row: VinRegistryIncidentRow = { date, amount, country, note };
  if (!vinRegistryIncidentRowHasData(row)) return null;
  const base = repairVinRegistryBlock(block);
  return {
    ...base,
    incidents: mergeVinRegistryIncidents(base.incidents ?? [emptyVinRegistryIncidentRow()], row),
  };
}

function applyVinRegistryFields(
  block: VinRegistryBlockState,
  action: CopilotRegistryFieldsAction,
): VinRegistryBlockState {
  const base = repairVinRegistryBlock(block);
  return {
    ...base,
    ownersSummary: mergeRegistryText(base.ownersSummary, action.ownersSummary),
    statusRecords: mergeRegistryText(base.statusRecords, action.statusRecords),
    autoNotes: mergeRegistryText(base.autoNotes, action.autoNotes),
  };
}

function applyIncidentToLtab(b: LtabBlockState, row: LtabIncidentRow): LtabBlockState {
  return { ...b, rows: mergeIncidentRows(b.rows ?? [emptyLtabRow()], row) };
}

function applyLtabCertificate(b: LtabBlockState, cert: LtabCertificate): LtabBlockState {
  let rows = b.rows ?? [emptyLtabRow()];
  for (const row of ltabCertificateToIncidentRows(cert)) {
    rows = mergeIncidentRows(rows, row);
  }
  return { ...b, certificate: cert, rows };
}

function applyMileageToAutoRecords(b: AutoRecordsBlockState, row: AutoRecordsServiceRow): AutoRecordsBlockState {
  return {
    ...b,
    serviceHistory: mergeMileageRows(b.serviceHistory ?? [emptyAutoRecordsServiceRow()], row),
  };
}

function applyIncidentToCiti(b: CitiAvotiBlockState, row: LtabIncidentRow): CitiAvotiBlockState {
  const sections = [...(b.sections ?? [])];
  if (sections.length === 0) {
    sections.push({ ...emptyVendorAvotuBlock(), incidents: [row] });
    return { sections };
  }
  sections[0] = applyIncidentToVendor(sections[0]!, row);
  return { sections };
}

function applyMileageToCiti(b: CitiAvotiBlockState, row: AutoRecordsServiceRow): CitiAvotiBlockState {
  const sections = [...(b.sections ?? [])];
  if (sections.length === 0) {
    sections.push({ ...emptyVendorAvotuBlock(), serviceHistory: [row] });
    return { sections };
  }
  sections[0] = applyMileageToVendor(sections[0]!, row);
  return { sections };
}

function damageKey(r: CcVinDamageRow): string {
  return `${r.date}|${r.amount}|${r.region}|${r.description}`.toLowerCase();
}

function mergeCcVinDamageRows(existing: CcVinDamageRow[], incoming: CcVinDamageRow): CcVinDamageRow[] {
  const withData = existing.filter(ccVinDamageRowHasData);
  const key = damageKey(incoming);
  if (withData.some((r) => damageKey(r) === key)) return existing.length ? existing : [incoming];
  const emptyIdx = existing.findIndex((r) => !ccVinDamageRowHasData(r));
  if (emptyIdx >= 0) {
    const next = [...existing];
    next[emptyIdx] = incoming;
    return next;
  }
  return [...withData, incoming];
}

function applyMileageToCcVin(b: CcVinBlockState, row: AutoRecordsServiceRow): CcVinBlockState {
  return {
    ...b,
    mileage: mergeMileageRows(b.mileage ?? [emptyCcVinMileageRow()], row),
  };
}

function applyIncidentToCcVin(
  b: CcVinBlockState,
  action: CopilotIncidentAction,
  row: LtabIncidentRow,
): CcVinBlockState {
  const damage: CcVinDamageRow = {
    date: row.csngDate,
    region: row.incidentNo,
    amount: row.lossAmount,
    description: action.note?.trim() || "Negadījums",
  };
  return {
    ...b,
    damages: mergeCcVinDamageRows(b.damages ?? [emptyCcVinDamageRow()], damage),
  };
}

function appendText(existing: string, incoming: string, maxLen: number): string {
  const add = incoming.trim();
  if (!add) return existing;
  const base = existing.trim();
  if (!base) return add.slice(0, maxLen);
  if (base.includes(add)) return base.slice(0, maxLen);
  return `${base}\n\n${add}`.slice(0, maxLen);
}

function applyServiceHistoryNotes(
  b: AutoRecordsBlockState,
  action: CopilotServiceHistoryAction,
): AutoRecordsBlockState {
  return {
    ...b,
    serviceHistoryNotes: mergeServiceHistoryFieldText(b.serviceHistoryNotes ?? "", action.text),
  };
}

function sameServiceWorkRows(
  a: AutoRecordsServiceWorkRow[],
  b: AutoRecordsServiceWorkRow[],
): boolean {
  if (a.length !== b.length) return false;
  return a.every((r, i) => {
    const other = b[i]!;
    return (
      r.date === other.date &&
      r.odometer === other.odometer &&
      r.location === other.location &&
      r.works === other.works
    );
  });
}

/** Precīzāks apzīmējums = ar iekavās norādītu rūpnīcas kodu („Havana Black Metallic (LY8X)”). */
function hasSpecCode(value: string): boolean {
  return /\([0-9A-Za-z][0-9A-Za-z /-]{1,20}\)/.test(value.trim());
}

/**
 * Tukšos dīlera laukus aizpilda; aizpildītu pārraksta tikai tad, ja jaunajā ir precīzs kods,
 * bet esošajā nav (piem. „Melns” → „Havana Black Metallic (LY8X)”).
 *
 * `action.override` (oficiālā dīlera / rūpnīcas izdruka) pārraksta visus laukus — tā ir
 * primārā specifikācija arī tad, ja lauki jau nāca no AutoDNA vai CarVertical.
 */
function applyDealerVehicleInfo(
  b: AutoRecordsBlockState,
  action: CopilotDealerVehicleInfoAction,
): AutoRecordsBlockState {
  const report = b.outvinReport ?? emptyOutvinDealerReport();
  const vehicleInfo: OutvinVehicleInfo = { ...report.vehicleInfo };
  let changed = false;

  for (const { key } of OUTVIN_VEHICLE_INFO_ROWS) {
    const incoming = (action.vehicleInfo[key] ?? "").trim();
    if (!incoming) continue;
    const current = vehicleInfo[key].trim();
    if (current === incoming) continue;
    if (!action.override && current && !(hasSpecCode(incoming) && !hasSpecCode(current))) continue;
    vehicleInfo[key] = incoming.slice(0, 500);
    changed = true;
  }

  let equipment = report.equipment;
  const incomingEquipment = (action.equipment ?? []).filter(outvinEquipmentLineHasData);
  if (incomingEquipment.length > 0) {
    const merged = mergeDealerEquipment(report.equipment, incomingEquipment, action.override === true);
    if (merged !== report.equipment) {
      equipment = merged;
      changed = true;
    }
  }

  let accidentCheck = report.accidentCheck;
  const incomingAccident = (action.accidentCheck ?? "").trim();
  if (incomingAccident && (action.override || !accidentCheck.trim())) {
    if (incomingAccident !== accidentCheck) {
      accidentCheck = incomingAccident.slice(0, 8000);
      changed = true;
    }
  }

  let stolenCheck = report.stolenCheck;
  const incomingStolen = (action.stolenCheck ?? "").trim();
  if (incomingStolen && (action.override || !stolenCheck.trim())) {
    if (incomingStolen !== stolenCheck) {
      stolenCheck = incomingStolen.slice(0, 8000);
      changed = true;
    }
  }

  if (!changed) return b;
  return { ...b, outvinReport: { vehicleInfo, equipment, accidentCheck, stolenCheck } };
}

/** Komplektācija: dīlera izdruka aizstāj sarakstu, citādi pieliek tikai jaunos kodus. */
function mergeDealerEquipment(
  existing: OutvinEquipmentLine[],
  incoming: OutvinEquipmentLine[],
  replace: boolean,
): OutvinEquipmentLine[] {
  const current = existing.filter(outvinEquipmentLineHasData);
  if (replace) {
    const same =
      current.length === incoming.length &&
      current.every((l, i) => l.code === incoming[i]!.code && l.description === incoming[i]!.description);
    return same ? existing : incoming;
  }
  const seen = new Set(current.map((l) => l.code.trim().toUpperCase() || l.description.trim().toLowerCase()));
  const added = incoming.filter(
    (l) => !seen.has(l.code.trim().toUpperCase() || l.description.trim().toLowerCase()),
  );
  return added.length > 0 ? [...current, ...added] : existing;
}

function applyAppendRaw(
  blocks: WorkspaceSourceBlocks,
  action: CopilotAppendRawAction,
): { blocks: WorkspaceSourceBlocks; ok: boolean; reason?: string } {
  const text = action.text.trim();
  if (!text) return { blocks, ok: false, reason: "empty_raw_text" };

  if (action.source === "auto_records") {
    return {
      ok: true,
      blocks: {
        ...blocks,
        auto_records: {
          ...blocks.auto_records,
          rawUnprocessedData: appendText(
            blocks.auto_records.rawUnprocessedData ?? "",
            text,
            ADMIN_RAW_UNPROCESSED_MAX_LEN,
          ),
        },
      },
    };
  }
  if (action.source === "ltab") {
    return {
      ok: true,
      blocks: {
        ...blocks,
        ltab: {
          ...blocks.ltab,
          pdfImportRaw: appendText(blocks.ltab.pdfImportRaw ?? "", text, ADMIN_PDF_IMPORT_RAW_MAX_LEN),
        },
      },
    };
  }
  if (action.source === "autodna" || action.source === "carvertical") {
    const key = action.source;
    const cur = ensureVendor(blocks[key]);
    return {
      ok: true,
      blocks: {
        ...blocks,
        [key]: {
          ...cur,
          aiContextRaw: clipAiContextRaw(
            appendText(cur.aiContextRaw ?? "", text, ADMIN_MILEAGE_PASTE_RAW_MAX_LEN),
          ),
        },
      },
    };
  }
  if (action.source === "cc_vin") {
    return {
      ok: true,
      blocks: {
        ...blocks,
        cc_vin: {
          ...blocks.cc_vin,
          aiContextRaw: clipAiContextRaw(
            appendText(blocks.cc_vin.aiContextRaw ?? "", text, ADMIN_MILEAGE_PASTE_RAW_MAX_LEN),
          ),
        },
      },
    };
  }
  if (action.source === "citi_avoti") {
    const sections = [...(blocks.citi_avoti.sections ?? [])];
    if (sections.length === 0) {
      sections.push({
        ...emptyVendorAvotuBlock(),
        rawUnprocessedData: text.slice(0, ADMIN_RAW_UNPROCESSED_MAX_LEN),
      });
    } else {
      const s0 = sections[0]!;
      sections[0] = {
        ...s0,
        rawUnprocessedData: appendText(s0.rawUnprocessedData ?? "", text, ADMIN_RAW_UNPROCESSED_MAX_LEN),
      };
    }
    return { ok: true, blocks: { ...blocks, citi_avoti: { sections } } };
  }
  if (isVinRegistryCopilotSource(action.source)) {
    const key = action.source;
    const cur = repairVinRegistryBlock(blocks[key]);
    return {
      ok: true,
      blocks: {
        ...blocks,
        [key]: {
          ...cur,
          rawUnprocessedData: appendText(cur.rawUnprocessedData ?? "", text, ADMIN_RAW_UNPROCESSED_MAX_LEN),
        },
      },
    };
  }
  return { blocks, ok: false, reason: "unknown_source" };
}

export function shouldAutoApply(confidence: CopilotConfidence, clarificationNeeded: string): boolean {
  if (clarificationNeeded.trim()) return false;
  return confidence === "high";
}

/**
 * Piemēro darbības. Ja `onlyAuto` — tikai high confidence (un bez clarification).
 */
export function applyCopilotActions(
  blocks: WorkspaceSourceBlocks,
  actions: CopilotAction[],
  opts?: { onlyAuto?: boolean; clarificationNeeded?: string },
): CopilotApplyResult {
  let next = mergeSourceBlocksWithDefaults(blocks);
  const applied: CopilotAction[] = [];
  const skipped: CopilotApplyResult["skipped"] = [];
  const changed = new Set<CopilotSourceKey>();
  const clarification = opts?.clarificationNeeded?.trim() ?? "";
  const enrichedActions = enrichCopilotActionCountries(next, actions);

  for (const action of enrichedActions) {
    if (!isCopilotSourceKey(action.source)) {
      skipped.push({ action, reason: "unknown_source" });
      continue;
    }
    if (opts?.onlyAuto && !shouldAutoApply(action.confidence, clarification)) {
      skipped.push({ action, reason: "needs_confirm" });
      continue;
    }

    if (action.type === "upsert_incident") {
      if (action.source === "auto_records") {
        skipped.push({ action, reason: "auto_records_has_no_incidents" });
        continue;
      }
      if (isVinRegistryCopilotSource(action.source)) {
        const updated = applyVinRegistryIncident(next[action.source], action);
        if (!updated) {
          skipped.push({ action, reason: "invalid_incident_row" });
          continue;
        }
        next = { ...next, [action.source]: updated };
        applied.push(action);
        changed.add(action.source);
        continue;
      }
      const row = normalizeIncidentRow(action);
      if (!row) {
        skipped.push({ action, reason: "invalid_incident_row" });
        continue;
      }
      if (action.source === "ltab") {
        next = { ...next, ltab: applyIncidentToLtab(next.ltab, row) };
      } else if (action.source === "citi_avoti") {
        next = { ...next, citi_avoti: applyIncidentToCiti(next.citi_avoti, row) };
      } else if (action.source === "autodna") {
        next = { ...next, autodna: applyIncidentToVendor(next.autodna, row) };
      } else if (action.source === "carvertical") {
        next = { ...next, carvertical: applyIncidentToVendor(next.carvertical, row) };
      } else if (action.source === "cc_vin") {
        next = { ...next, cc_vin: applyIncidentToCcVin(next.cc_vin, action, row) };
      } else {
        skipped.push({ action, reason: "unknown_source" });
        continue;
      }
      applied.push(action);
      changed.add(action.source);
      continue;
    }

    if (action.type === "upsert_mileage") {
      if (action.source === "ltab") {
        skipped.push({ action, reason: "ltab_has_no_mileage" });
        continue;
      }
      if (isVinRegistryCopilotSource(action.source)) {
        const updated = applyVinRegistryMileage(next[action.source], action);
        if (!updated) {
          skipped.push({ action, reason: "invalid_mileage_row" });
          continue;
        }
        next = { ...next, [action.source]: updated };
        applied.push(action);
        changed.add(action.source);
        continue;
      }
      const row = normalizeMileageRow(action);
      if (!row) {
        skipped.push({ action, reason: "invalid_mileage_row" });
        continue;
      }
      if (action.source === "auto_records") {
        next = { ...next, auto_records: applyMileageToAutoRecords(next.auto_records, row) };
      } else if (action.source === "citi_avoti") {
        next = { ...next, citi_avoti: applyMileageToCiti(next.citi_avoti, row) };
      } else if (action.source === "autodna") {
        next = { ...next, autodna: applyMileageToVendor(next.autodna, row) };
      } else if (action.source === "carvertical") {
        next = { ...next, carvertical: applyMileageToVendor(next.carvertical, row) };
      } else if (action.source === "cc_vin") {
        next = { ...next, cc_vin: applyMileageToCcVin(next.cc_vin, row) };
      } else {
        skipped.push({ action, reason: "unknown_source" });
        continue;
      }
      applied.push(action);
      changed.add(action.source);
      continue;
    }

    if (action.type === "set_service_history") {
      const updated = applyServiceHistoryNotes(next.auto_records, action);
      if (updated.serviceHistoryNotes === next.auto_records.serviceHistoryNotes) {
        skipped.push({ action, reason: "service_history_already_filled" });
        continue;
      }
      next = { ...next, auto_records: updated };
      applied.push(action);
      changed.add("auto_records");
      continue;
    }

    if (action.type === "upsert_service_work") {
      const rows = mergeAutoRecordsServiceWorkRow(next.auto_records.serviceWorks ?? [], {
        date: action.date,
        odometer: action.odometer,
        location: action.location,
        works: action.works,
      });
      if (rows === (next.auto_records.serviceWorks ?? [])) {
        skipped.push({ action, reason: "invalid_service_work_row" });
        continue;
      }
      if (sameServiceWorkRows(rows, next.auto_records.serviceWorks ?? [])) {
        skipped.push({ action, reason: "service_work_row_exists" });
        continue;
      }
      next = { ...next, auto_records: { ...next.auto_records, serviceWorks: rows } };
      applied.push(action);
      changed.add("auto_records");
      continue;
    }

    if (action.type === "set_dealer_vehicle_info") {
      const updated = applyDealerVehicleInfo(next.auto_records, action);
      if (updated === next.auto_records) {
        skipped.push({ action, reason: "dealer_fields_already_filled" });
        continue;
      }
      next = { ...next, auto_records: updated };
      applied.push(action);
      changed.add("auto_records");
      continue;
    }

    if (action.type === "set_ltab_certificate") {
      if (!ltabCertificateHasContent(action.certificate)) {
        skipped.push({ action, reason: "empty_ltab_certificate" });
        continue;
      }
      next = { ...next, ltab: applyLtabCertificate(next.ltab, action.certificate) };
      applied.push(action);
      changed.add("ltab");
      continue;
    }

    if (action.type === "set_registry_fields") {
      if (!isVinRegistryCopilotSource(action.source)) {
        skipped.push({ action, reason: "unknown_source" });
        continue;
      }
      const updated = applyVinRegistryFields(next[action.source], action);
      next = { ...next, [action.source]: updated };
      applied.push(action);
      changed.add(action.source);
      continue;
    }

    if (action.type === "append_raw") {
      const result = applyAppendRaw(next, action);
      if (!result.ok) {
        skipped.push({ action, reason: result.reason ?? "append_raw_failed" });
        continue;
      }
      next = result.blocks;
      applied.push(action);
      changed.add(action.source);
    }
  }

  return {
    sourceBlocks: next,
    applied,
    skipped,
    changedKeys: [...changed],
  };
}

function pushClippedNote(lines: string[], label: string, text: string, max = 1200) {
  const t = text.trim();
  if (!t) return;
  lines.push(`${label}:`);
  lines.push(t.length > max ? `${t.slice(0, max)}…` : t);
}

/** Īss konteksts AI — esošās tabulas + CSDD + komentāri/RAW (valsts cross-fill). */
export function buildCopilotBlocksSummary(blocks: WorkspaceSourceBlocks): string {
  const b = mergeSourceBlocksWithDefaults(blocks);
  const lines: string[] = [];

  const pushInc = (label: string, rows: LtabIncidentRow[]) => {
    const filled = rows.filter(ltabRowHasData);
    if (filled.length === 0) {
      lines.push(`${label} incidents: (empty)`);
      return;
    }
    lines.push(`${label} incidents:`);
    for (const r of filled.slice(0, 40)) {
      lines.push(`  - ${r.csngDate} | ${r.lossAmount} | ${r.incidentNo}`);
    }
  };
  const pushMile = (label: string, rows: AutoRecordsServiceRow[]) => {
    const filled = rows.filter(autoRecordsMileageRowHasData);
    if (filled.length === 0) {
      lines.push(`${label} mileage: (empty)`);
      return;
    }
    lines.push(`${label} mileage:`);
    for (const r of filled.slice(0, 40)) {
      lines.push(`  - ${r.date} | ${r.odometer} km | ${r.country}`);
    }
  };

  const csdd = b.csdd;
  lines.push("CSDD (use for country timeline when unambiguous):");
  lines.push(`  - Pirmā reģistrācija: ${csdd.firstRegistration || "—"}`);
  lines.push(`  - Iepriekšējās reģistrācijas valsts: ${csdd.previousRegistrationCountry || "—"}`);
  const csddMile = (csdd.mileageHistory ?? []).filter((r) => r.date.trim() || r.odometer.trim());
  if (csddMile.length > 0) {
    lines.push("CSDD mileage:");
    for (const r of csddMile.slice(0, 40)) {
      lines.push(`  - ${r.date} | ${r.odometer} km | ${r.country}`);
    }
  }
  if ((csdd.comments ?? "").trim()) pushClippedNote(lines, "CSDD comments", csdd.comments, 800);
  if ((csdd.rawUnprocessedData ?? "").trim()) {
    pushClippedNote(lines, "CSDD RAW", csdd.rawUnprocessedData, 1000);
  }
  if ((csdd.aiContextRaw ?? "").trim()) {
    pushClippedNote(lines, "CSDD AI context", csdd.aiContextRaw, 800);
  }

  pushInc("autodna", b.autodna.incidents);
  pushMile("autodna", b.autodna.serviceHistory);
  pushClippedNote(lines, "autodna comments", b.autodna.comments);
  pushClippedNote(lines, "autodna RAW/AI", b.autodna.aiContextRaw);

  pushInc("carvertical", b.carvertical.incidents);
  pushMile("carvertical", b.carvertical.serviceHistory);
  pushClippedNote(lines, "carvertical comments", b.carvertical.comments);
  pushClippedNote(lines, "carvertical RAW/AI", b.carvertical.aiContextRaw);

  pushInc("ltab", b.ltab.rows);
  pushClippedNote(lines, "ltab comments", b.ltab.comments);
  pushClippedNote(lines, "ltab PDF RAW", b.ltab.pdfImportRaw ?? "");

  pushMile("auto_records", b.auto_records.serviceHistory);
  const serviceWorksTxt = autoRecordsServiceWorkRowsToPlainText(b.auto_records.serviceWorks ?? []);
  if (serviceWorksTxt) {
    lines.push("auto_records servisa/remontu tabula (jau aizpildīta):");
    lines.push(serviceWorksTxt.slice(0, 3000));
  }
  if ((b.auto_records.serviceHistoryNotes ?? "").trim()) {
    lines.push("auto_records Servisa vēsture:");
    lines.push(b.auto_records.serviceHistoryNotes.trim().slice(0, 2000));
  }
  pushClippedNote(lines, "auto_records comments", b.auto_records.comments);
  pushClippedNote(lines, "auto_records RAW", b.auto_records.rawUnprocessedData ?? "");

  pushMile("cc_vin", b.cc_vin.mileage ?? []);
  const ccDamages = (b.cc_vin.damages ?? []).filter(ccVinDamageRowHasData);
  if (ccDamages.length === 0) {
    lines.push("cc_vin incidents: (empty)");
  } else {
    lines.push("cc_vin incidents:");
    for (const r of ccDamages.slice(0, 40)) {
      lines.push(`  - ${r.date} | ${r.amount} | ${r.region} | ${r.description}`);
    }
  }
  pushClippedNote(lines, "cc_vin comments", b.cc_vin.comments);
  pushClippedNote(lines, "cc_vin RAW/AI", b.cc_vin.aiContextRaw || b.cc_vin.rawUnprocessedData);

  const citi0 = b.citi_avoti.sections[0];
  if (citi0) {
    pushInc("citi_avoti", citi0.incidents);
    pushMile("citi_avoti", citi0.serviceHistory);
    pushClippedNote(lines, "citi_avoti comments", citi0.comments);
    pushClippedNote(lines, "citi_avoti RAW", citi0.rawUnprocessedData ?? "");
  } else {
    lines.push("citi_avoti: (no sections)");
  }

  for (const key of ["tjekbil", "mnt_ee", "lkf_ee", "carinfo"] as const) {
    const block = b[key];
    const mile = (block.mileage ?? []).filter(vinRegistryMileageRowHasData);
    if (mile.length === 0) {
      lines.push(`${key} mileage: (empty)`);
    } else {
      lines.push(`${key} mileage:`);
      for (const r of mile.slice(0, 40)) {
        lines.push(`  - ${r.date} | ${r.odometer} km | ${r.country}`);
      }
    }
    const inc = (block.incidents ?? []).filter(vinRegistryIncidentRowHasData);
    if (inc.length === 0) {
      lines.push(`${key} incidents: (empty)`);
    } else {
      lines.push(`${key} incidents:`);
      for (const r of inc.slice(0, 20)) {
        lines.push(`  - ${r.date} | ${r.amount} | ${r.country} | ${r.note}`);
      }
    }
    pushClippedNote(lines, `${key} owners`, block.ownersSummary);
    pushClippedNote(lines, `${key} status`, block.statusRecords);
    pushClippedNote(lines, `${key} notes`, block.autoNotes);
    pushClippedNote(lines, `${key} RAW`, block.rawUnprocessedData);
  }

  lines.push(
    "COUNTRY HINT: Prefer copying a confirmed country across matching events (same date+EUR or date+km). Leave empty only if nothing confirms it 100%.",
  );

  return lines.join("\n");
}
