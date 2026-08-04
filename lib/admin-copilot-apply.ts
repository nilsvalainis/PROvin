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
  autoRecordsMileageRowHasData,
  formatAutoRecordsDateForOutput,
  normalizeAutoRecordsOdometer,
  sortAutoRecordsDescending,
  type AutoRecordsServiceRow,
} from "@/lib/auto-records-paste-parse";
import { normalizeCountryNameLv } from "@/lib/country-names-lv";
import { normalizeLossAmountEurDisplay } from "@/lib/loss-amount-format";
import type {
  CopilotAction,
  CopilotConfidence,
  CopilotIncidentAction,
  CopilotMileageAction,
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

  for (const action of actions) {
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
    }
  }

  return {
    sourceBlocks: next,
    applied,
    skipped,
    changedKeys: [...changed],
  };
}

/** Īss konteksts Gemini — esošās tabulas. */
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

  pushInc("autodna", b.autodna.incidents);
  pushMile("autodna", b.autodna.serviceHistory);
  pushInc("carvertical", b.carvertical.incidents);
  pushMile("carvertical", b.carvertical.serviceHistory);
  pushInc("ltab", b.ltab.rows);
  pushMile("auto_records", b.auto_records.serviceHistory);
  const citi0 = b.citi_avoti.sections[0];
  if (citi0) {
    pushInc("citi_avoti", citi0.incidents);
    pushMile("citi_avoti", citi0.serviceHistory);
  } else {
    lines.push("citi_avoti: (no sections)");
  }

  return lines.join("\n");
}
