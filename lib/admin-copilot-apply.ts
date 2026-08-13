/**
 * Piemēro Order Copilot darbības WorkspaceSourceBlocks (serveris + klients).
 */
import {
  emptyLtabRow,
  emptyAutoRecordsServiceRow,
  emptyVendorAvotuBlock,
  ltabRowHasData,
  mergeSourceBlocksWithDefaults,
  type LtabIncidentRow,
  type WorkspaceSourceBlocks,
  type VendorAvotuBlockState,
  type LtabBlockState,
  type AutoRecordsBlockState,
  type CitiAvotiBlockState,
} from "@/lib/admin-source-blocks";
import {
  ADMIN_MILEAGE_PASTE_RAW_MAX_LEN,
  ADMIN_PDF_IMPORT_RAW_MAX_LEN,
  ADMIN_RAW_UNPROCESSED_MAX_LEN,
} from "@/lib/admin-raw-field-limits";
import { clipGeminiContextRaw } from "@/lib/admin-gemini-context-raw";
import {
  autoRecordsMileageRowHasData,
  formatAutoRecordsDateForOutput,
  normalizeAutoRecordsOdometer,
  sortAutoRecordsDescending,
  type AutoRecordsServiceRow,
} from "@/lib/auto-records-paste-parse";
import { normalizeCountryNameLv } from "@/lib/country-names-lv";
import { normalizeLossAmountEurDisplay } from "@/lib/loss-amount-format";
import {
  emptyOutvinDealerReport,
  OUTVIN_VEHICLE_INFO_ROWS,
  type OutvinVehicleInfo,
} from "@/lib/outvin-dealer-types";
import type {
  CopilotAction,
  CopilotAppendRawAction,
  CopilotConfidence,
  CopilotDealerVehicleInfoAction,
  CopilotIncidentAction,
  CopilotMileageAction,
  CopilotServiceHistoryAction,
  CopilotSourceKey,
} from "@/lib/admin-copilot-types";
import { isCopilotSourceKey } from "@/lib/admin-copilot-types";

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
  // Allow 0 km (registry) — same rule as mileage-history paste
  if (!date.trim() || odometer === "") return null;
  if (!autoRecordsMileageRowHasData(row) && odometer !== "0") return null;
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

  const mileRows = [
    ...b.autodna.serviceHistory,
    ...b.carvertical.serviceHistory,
    ...b.auto_records.serviceHistory,
    ...(citi0?.serviceHistory ?? []),
    ...(b.csdd.mileageHistory ?? []),
  ];
  for (const r of mileRows) {
    if (autoRecordsMileageRowHasData(r) || (r.date.trim() && r.odometer === "0") || (r.date.trim() && r.odometer.trim() && r.country.trim())) {
      putMileage(r.date, r.odometer, r.country);
    }
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
  const withData = existing.filter(
    (r) => autoRecordsMileageRowHasData(r) || (r.date.trim() && r.odometer === "0"),
  );
  const key = mileageKey(incoming);
  if (withData.some((r) => mileageKey(r) === key)) {
    return sortAutoRecordsDescending(withData.length ? withData : [incoming]);
  }
  const emptyIdx = existing.findIndex(
    (r) => !autoRecordsMileageRowHasData(r) && !(r.date.trim() && r.odometer === "0"),
  );
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

function applyIncidentToLtab(b: LtabBlockState, row: LtabIncidentRow): LtabBlockState {
  return { ...b, rows: mergeIncidentRows(b.rows ?? [emptyLtabRow()], row) };
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
    serviceHistoryNotes: appendText(b.serviceHistoryNotes ?? "", action.text, 12_000),
  };
}

/** Precīzāks apzīmējums = ar iekavās norādītu rūpnīcas kodu („Havana Black Metallic (LY8X)”). */
function hasSpecCode(value: string): boolean {
  return /\([0-9A-Za-z][0-9A-Za-z /-]{1,20}\)/.test(value.trim());
}

/**
 * Tukšos dīlera laukus aizpilda; aizpildītu pārraksta tikai tad, ja jaunajā ir precīzs kods,
 * bet esošajā nav (piem. „Melns” → „Havana Black Metallic (LY8X)”).
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
    if (current && !(hasSpecCode(incoming) && !hasSpecCode(current))) continue;
    vehicleInfo[key] = incoming.slice(0, 500);
    changed = true;
  }

  if (!changed) return b;
  return { ...b, outvinReport: { ...report, vehicleInfo } };
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
          geminiContextRaw: clipGeminiContextRaw(
            appendText(cur.geminiContextRaw ?? "", text, ADMIN_MILEAGE_PASTE_RAW_MAX_LEN),
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
      }
      applied.push(action);
      changed.add(action.source);
      continue;
    }

    if (action.type === "set_service_history") {
      next = {
        ...next,
        auto_records: applyServiceHistoryNotes(next.auto_records, action),
      };
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

/** Īss konteksts Gemini — esošās tabulas + CSDD + komentāri/RAW (valsts cross-fill). */
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
    const filled = rows.filter((r) => autoRecordsMileageRowHasData(r) || (r.date.trim() && r.odometer === "0"));
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
  if ((csdd.geminiContextRaw ?? "").trim()) {
    pushClippedNote(lines, "CSDD AI context", csdd.geminiContextRaw, 800);
  }

  pushInc("autodna", b.autodna.incidents);
  pushMile("autodna", b.autodna.serviceHistory);
  pushClippedNote(lines, "autodna comments", b.autodna.comments);
  pushClippedNote(lines, "autodna RAW/AI", b.autodna.geminiContextRaw);

  pushInc("carvertical", b.carvertical.incidents);
  pushMile("carvertical", b.carvertical.serviceHistory);
  pushClippedNote(lines, "carvertical comments", b.carvertical.comments);
  pushClippedNote(lines, "carvertical RAW/AI", b.carvertical.geminiContextRaw);

  pushInc("ltab", b.ltab.rows);
  pushClippedNote(lines, "ltab comments", b.ltab.comments);
  pushClippedNote(lines, "ltab PDF RAW", b.ltab.pdfImportRaw ?? "");

  pushMile("auto_records", b.auto_records.serviceHistory);
  if ((b.auto_records.serviceHistoryNotes ?? "").trim()) {
    lines.push("auto_records Servisa vēsture:");
    lines.push(b.auto_records.serviceHistoryNotes.trim().slice(0, 2000));
  }
  pushClippedNote(lines, "auto_records comments", b.auto_records.comments);
  pushClippedNote(lines, "auto_records RAW", b.auto_records.rawUnprocessedData ?? "");

  const citi0 = b.citi_avoti.sections[0];
  if (citi0) {
    pushInc("citi_avoti", citi0.incidents);
    pushMile("citi_avoti", citi0.serviceHistory);
    pushClippedNote(lines, "citi_avoti comments", citi0.comments);
    pushClippedNote(lines, "citi_avoti RAW", citi0.rawUnprocessedData ?? "");
  } else {
    lines.push("citi_avoti: (no sections)");
  }

  lines.push(
    "COUNTRY HINT: Prefer copying a confirmed country across matching events (same date+EUR or date+km). Leave empty only if nothing confirms it 100%.",
  );

  return lines.join("\n");
}
