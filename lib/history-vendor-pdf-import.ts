/**
 * AutoDNA / CarVertical / LTAB PDF teksta imports (kopīga teksta izvilkšana + heuristika).
 */
import type { LtabIncidentRow, SourcePdfChecklist } from "@/lib/admin-source-blocks";
import { ltabRowHasData } from "@/lib/admin-source-blocks";
import { parseAutodnaMileagePaste } from "@/lib/autodna-mileage-paste-parse";
import {
  autoRecordsRowHasData,
  sortAutoRecordsDescending,
  type AutoRecordsServiceRow,
} from "@/lib/auto-records-paste-parse";
import { parseCarverticalOdometerPaste } from "@/lib/carvertical-odometer-paste-parse";
import { extractClaimRowsForPdfInsight, type ClaimTableRow } from "@/lib/claim-rows-parse";
import { normalizeCountryNameLv } from "@/lib/country-names-lv";
import { mergeAutoRecordsServiceHistory } from "@/lib/auto-records-pdf-parse";

export type HistoryVendorPdfTarget = "autodna" | "carvertical" | "ltab";

const MAX_RAW = 120_000;

export type HistoryVendorPdfParseResult = {
  rawText: string;
  serviceHistory: AutoRecordsServiceRow[];
  incidents: LtabIncidentRow[];
  suggestedPdfChecklist: Partial<SourcePdfChecklist>;
  warnings: string[];
  meta: { charCount: number; mileageRowCount: number; incidentRowCount: number };
};

function claimRowsToLtabRows(claims: ClaimTableRow[]): LtabIncidentRow[] {
  return claims.map((c) => ({
    csngDate: c.date.trim(),
    lossAmount: c.amount.trim(),
    incidentNo: normalizeCountryNameLv(c.iso) || c.iso,
  }));
}

function mergeLtabIncidentRows(existing: LtabIncidentRow[], imported: LtabIncidentRow[]): LtabIncidentRow[] {
  const seen = new Set<string>();
  const out: LtabIncidentRow[] = [];
  const push = (r: LtabIncidentRow) => {
    if (!ltabRowHasData(r)) return;
    const key = `${r.csngDate}|${r.lossAmount}|${r.incidentNo}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(r);
  };
  for (const r of existing) push(r);
  for (const r of imported) push(r);
  return out.length > 0 ? out : existing.filter(ltabRowHasData);
}

function suggestChecklist(
  text: string,
  mileage: AutoRecordsServiceRow[],
  incidents: LtabIncidentRow[],
): Partial<SourcePdfChecklist> {
  const patch: Partial<SourcePdfChecklist> = {};
  if (mileage.length > 0) {
    patch.mileageHistory = true;
    patch.mileageLine = true;
  }
  if (incidents.length > 0) patch.incidents = true;
  return patch;
}

export function parseHistoryVendorPdfText(
  target: HistoryVendorPdfTarget,
  text: string,
): HistoryVendorPdfParseResult {
  const warnings: string[] = [];
  const trimmed = text.trim();
  const charCount = trimmed.length;

  if (!charCount) {
    return {
      rawText: "",
      serviceHistory: [],
      incidents: [],
      suggestedPdfChecklist: {},
      warnings: ["PDF nesatur izvelkamu tekstu (iespējams skenēts attēls)."],
      meta: { charCount: 0, mileageRowCount: 0, incidentRowCount: 0 },
    };
  }

  const rawText = trimmed.slice(0, MAX_RAW);
  let serviceHistory: AutoRecordsServiceRow[] = [];

  if (target === "carvertical") {
    serviceHistory = parseCarverticalOdometerPaste(trimmed);
    if (serviceHistory.length === 0) {
      warnings.push("Odometra žurnāla rindas netika atpazītas — teksts saglabāts iekopēšanas laukā.");
    }
  } else if (target === "autodna") {
    serviceHistory = parseAutodnaMileagePaste(trimmed);
    if (serviceHistory.length === 0) {
      warnings.push("TRANSPORTLĪDZEKĻA VĒSTURE rindas netika atpazītas — teksts saglabāts iekopēšanas laukā.");
    }
  }

  serviceHistory = sortAutoRecordsDescending(serviceHistory.filter(autoRecordsRowHasData));

  const claims = extractClaimRowsForPdfInsight(trimmed, 1);
  const incidents = claimRowsToLtabRows(claims);

  if (target === "ltab" && incidents.length === 0) {
    warnings.push("LTAB negadījumu rindas (datums + EUR) netika atrastas — teksts saglabāts RAW laukā.");
  } else if (target !== "ltab" && incidents.length === 0 && /claim|damage|accident|atlīdz|negad/i.test(trimmed)) {
    warnings.push("Iespējami negadījumi PDF, bet summas rindas netika strukturētas.");
  }

  return {
    rawText,
    serviceHistory,
    incidents,
    suggestedPdfChecklist: suggestChecklist(trimmed, serviceHistory, incidents),
    warnings,
    meta: {
      charCount,
      mileageRowCount: serviceHistory.length,
      incidentRowCount: incidents.length,
    },
  };
}

export function mergeVendorServiceHistory(
  existing: AutoRecordsServiceRow[],
  imported: AutoRecordsServiceRow[],
): AutoRecordsServiceRow[] {
  return mergeAutoRecordsServiceHistory(existing, imported);
}

export { mergeLtabIncidentRows };
