/**
 * Copilot — no ekstrahētā PDF teksta lokāli iesēj nobraukumu/negadījumus ar valstīm
 * (tieši tas, ko RAW paste jau dara korekti).
 */
import {
  emptyVendorAvotuBlock,
  ltabRowHasData,
  mergeSourceBlocksWithDefaults,
  type LtabIncidentRow,
  type WorkspaceSourceBlocks,
} from "@/lib/admin-source-blocks";
import { parseAutoRecordsPdfText } from "@/lib/auto-records-pdf-parse";
import {
  autoRecordsMileageRowHasData,
  formatAutoRecordsDateForOutput,
  normalizeAutoRecordsOdometer,
  sortAutoRecordsDescending,
  type AutoRecordsServiceRow,
} from "@/lib/auto-records-paste-parse";
import { normalizeCountryNameLv } from "@/lib/country-names-lv";
import { normalizeLossAmountEurDisplay } from "@/lib/loss-amount-format";
import { parseHistoryVendorPdfText, type HistoryVendorPdfTarget } from "@/lib/history-vendor-pdf-import";
import type { SourcePdfIngestTarget } from "@/lib/pdf-source-ingest";
import type { CopilotAction, CopilotSourceKey } from "@/lib/admin-copilot-types";

function normDate(raw: string): string {
  return formatAutoRecordsDateForOutput(raw.trim()) || raw.trim();
}

function normOdo(raw: string): string {
  return normalizeAutoRecordsOdometer(raw.trim()) || raw.replace(/\D/g, "");
}

function normLoss(raw: string): string {
  const t = normalizeLossAmountEurDisplay(raw.trim()) || raw.trim();
  return t.replace(/\s+/g, " ").toLowerCase();
}

function mergeMileagePreferCountry(
  existing: AutoRecordsServiceRow[],
  incoming: AutoRecordsServiceRow[],
): AutoRecordsServiceRow[] {
  const map = new Map<string, AutoRecordsServiceRow>();
  const keyOf = (r: AutoRecordsServiceRow) => `${normDate(r.date)}|${normOdo(r.odometer)}`;

  for (const r of existing) {
    if (!autoRecordsMileageRowHasData(r) && !(r.date.trim() && r.odometer === "0")) continue;
    map.set(keyOf(r), { ...r, country: normalizeCountryNameLv(r.country) || r.country });
  }
  for (const r of incoming) {
    if (!autoRecordsMileageRowHasData(r) && !(r.date.trim() && r.odometer === "0")) continue;
    const k = keyOf(r);
    const country = normalizeCountryNameLv(r.country) || r.country.trim();
    const prev = map.get(k);
    if (!prev) {
      map.set(k, { date: normDate(r.date) || r.date, odometer: normOdo(r.odometer) || r.odometer, country });
      continue;
    }
    if (!prev.country.trim() && country) {
      map.set(k, { ...prev, country });
    }
  }
  return sortAutoRecordsDescending([...map.values()]);
}

function mergeIncidentsPreferCountry(
  existing: LtabIncidentRow[],
  incoming: LtabIncidentRow[],
): LtabIncidentRow[] {
  const map = new Map<string, LtabIncidentRow>();
  const keyOf = (r: LtabIncidentRow) => `${normDate(r.csngDate)}|${normLoss(r.lossAmount)}`;

  for (const r of existing.filter(ltabRowHasData)) {
    map.set(keyOf(r), {
      ...r,
      incidentNo: normalizeCountryNameLv(r.incidentNo) || r.incidentNo,
    });
  }
  for (const r of incoming.filter(ltabRowHasData)) {
    const k = keyOf(r);
    const country = normalizeCountryNameLv(r.incidentNo) || r.incidentNo.trim();
    const prev = map.get(k);
    if (!prev) {
      map.set(k, {
        csngDate: normDate(r.csngDate) || r.csngDate,
        lossAmount: normalizeLossAmountEurDisplay(r.lossAmount) || r.lossAmount,
        incidentNo: country,
      });
      continue;
    }
    if (!prev.incidentNo.trim() && country) {
      map.set(k, { ...prev, incidentNo: country });
    }
  }
  return [...map.values()];
}

function rowsToSeedActions(
  source: CopilotSourceKey,
  mileage: AutoRecordsServiceRow[],
  incidents: LtabIncidentRow[],
): CopilotAction[] {
  const actions: CopilotAction[] = [];
  for (const r of mileage) {
    if (!autoRecordsMileageRowHasData(r) && !(r.date.trim() && r.odometer === "0")) continue;
    actions.push({
      type: "upsert_mileage",
      source,
      date: r.date,
      odometer: r.odometer,
      country: r.country,
      confidence: "high",
    });
  }
  for (const r of incidents.filter(ltabRowHasData)) {
    if (source === "auto_records") continue;
    actions.push({
      type: "upsert_incident",
      source,
      date: r.csngDate,
      lossAmount: r.lossAmount,
      country: r.incidentNo,
      confidence: "high",
    });
  }
  return actions;
}

/**
 * Lokāli parsē PDF tekstu → aizpilda/bagātina tabulas ar valstīm + atgriež high-confidence darbības Gemini bagātināšanai.
 */
export function seedCopilotBlocksFromPdfText(
  blocks: WorkspaceSourceBlocks,
  target: SourcePdfIngestTarget,
  text: string,
): { blocks: WorkspaceSourceBlocks; seedActions: CopilotAction[]; note: string } {
  const trimmed = text.trim();
  if (!trimmed) return { blocks, seedActions: [], note: "" };

  const b = mergeSourceBlocksWithDefaults(blocks);

  if (target === "autodna" || target === "carvertical" || target === "ltab") {
    const parsed = parseHistoryVendorPdfText(target as HistoryVendorPdfTarget, trimmed);
    const mile = parsed.serviceHistory;
    const inc = parsed.incidents;

    if (target === "ltab") {
      const rows = mergeIncidentsPreferCountry(b.ltab.rows, inc);
      const seedActions = rowsToSeedActions("ltab", [], rows);
      return {
        blocks: { ...b, ltab: { ...b.ltab, rows } },
        seedActions,
        note: `Lokāli no PDF: ${inc.length} negad. (ltab).`,
      };
    }

    const cur = { ...emptyVendorAvotuBlock(), ...b[target] };
    const serviceHistory = mergeMileagePreferCountry(cur.serviceHistory, mile);
    const incidents = mergeIncidentsPreferCountry(cur.incidents, inc);
    const nextVendor = {
      ...cur,
      serviceHistory,
      incidents,
      ...(parsed.vehicleHistoryTimeline?.length
        ? { vehicleHistoryTimeline: parsed.vehicleHistoryTimeline }
        : {}),
      ...(parsed.damageDetails?.length ? { damageDetails: parsed.damageDetails } : {}),
    };
    const seedActions = rowsToSeedActions(target, mile, inc);
    return {
      blocks: { ...b, [target]: nextVendor },
      seedActions,
      note: `Lokāli no PDF: ${mile.length} nobr. / ${inc.length} negad. (${target}), valstis no teksta.`,
    };
  }

  if (target === "auto_records") {
    const parsed = parseAutoRecordsPdfText(trimmed);
    const serviceHistory = mergeMileagePreferCountry(b.auto_records.serviceHistory, parsed.serviceHistory);
    const seedActions = rowsToSeedActions("auto_records", parsed.serviceHistory, []);
    return {
      blocks: { ...b, auto_records: { ...b.auto_records, serviceHistory } },
      seedActions,
      note: `Lokāli no PDF: ${parsed.serviceHistory.length} nobr. (auto_records).`,
    };
  }

  if (target === "citi_avoti") {
    // Mēģina CarVertical-stila timeline (bieži citi ārvalstu PDF).
    const parsed = parseHistoryVendorPdfText("carvertical", trimmed);
    const sections = [...(b.citi_avoti.sections ?? [])];
    const s0 = sections[0] ? { ...emptyVendorAvotuBlock(), ...sections[0] } : emptyVendorAvotuBlock();
    const serviceHistory = mergeMileagePreferCountry(s0.serviceHistory, parsed.serviceHistory);
    const incidents = mergeIncidentsPreferCountry(s0.incidents, parsed.incidents);
    sections[0] = { ...s0, serviceHistory, incidents };
    const seedActions = rowsToSeedActions("citi_avoti", parsed.serviceHistory, parsed.incidents);
    return {
      blocks: { ...b, citi_avoti: { sections } },
      seedActions,
      note: `Lokāli no PDF: ${parsed.serviceHistory.length} nobr. / ${parsed.incidents.length} negad. (citi_avoti).`,
    };
  }

  return { blocks: b, seedActions: [], note: "" };
}
