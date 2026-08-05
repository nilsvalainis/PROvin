/**
 * Order Copilot — CSDD e.csdd.lv PDF atpazīšana un merge (tukšie lauki).
 */
import {
  CSDD_FORM_STRUCTURED_FIELDS,
  CSDD_RAW_UNPROCESSED_MAX_LEN,
  type CsddFormFields,
} from "@/lib/admin-source-blocks";
import { mergeCsddPdfRawSources } from "@/lib/csdd-pdf-raw-merge";
import {
  previousInspectionBlockHasData,
  type CsddTechnicalInspectionRow,
} from "@/lib/csdd-extended-parse";
import { backfillCsddExtendedFromRaw, isLikelyStructuredCsddPaste } from "@/lib/csdd-paste-parse";

function countMileageRows(f: CsddFormFields): number {
  return f.mileageHistory.filter((r) => r.odometer.trim()).length;
}

function countTaRows(rows: CsddTechnicalInspectionRow[] | undefined): number {
  return (rows ?? []).filter((r) => r.date.trim()).length;
}

function countTaDefects(rows: CsddTechnicalInspectionRow[] | undefined): number {
  return (rows ?? []).reduce((n, r) => n + (r.defects?.length ?? 0), 0);
}

/** Vai PDF teksta slānis izskatās pēc CSDD e.csdd.lv transportlīdzekļa datu izdrukas. */
export function isLikelyCsddPdfText(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (isLikelyStructuredCsddPaste(t)) return true;
  return (
    /Re[gģ]istr[aā]cijas\s+numurs/i.test(t) &&
    /Tehnisko\s+apska[šs]u\s+vēsture/i.test(t) &&
    (/Nobraukuma\s+vēsture/i.test(t) ||
      /Pēdēj[āa]\s+tehnisk[āa]\s+apskate/i.test(t) ||
      /Informācija\s+sagatavota\s+elektroniski/i.test(t))
  );
}

/** Apvieno CSDD formu — neaizstāj aizpildītos laukus; bagātinā masīvus, ja tie vēl tukši vai ienākošie ir pilnāki. */
export function mergeCsddFieldsFillEmpty(
  existing: CsddFormFields,
  incoming: CsddFormFields,
  incomingRaw?: string,
): CsddFormFields {
  let next: CsddFormFields = { ...existing };

  const rawMerged = mergeCsddPdfRawSources(
    existing.rawUnprocessedData ?? "",
    (incomingRaw ?? incoming.rawUnprocessedData ?? "").trim(),
  ).slice(0, CSDD_RAW_UNPROCESSED_MAX_LEN);
  if (rawMerged.trim()) {
    next = { ...next, rawUnprocessedData: rawMerged };
  }

  for (const { key } of CSDD_FORM_STRUCTURED_FIELDS) {
    const cur = String(next[key] ?? "").trim();
    const inc = String(incoming[key] ?? "").trim();
    if (!cur && inc) next = { ...next, [key]: inc };
  }

  const incMileage = incoming.mileageHistory.filter((r) => r.odometer.trim());
  if (countMileageRows(next) === 0 && incMileage.length > 0) {
    next = { ...next, mileageHistory: incoming.mileageHistory };
  } else if (incMileage.length > countMileageRows(next)) {
    next = { ...next, mileageHistory: incoming.mileageHistory };
  }

  const incOwners = incoming.ownerRegistrationEvents ?? [];
  if (!(next.ownerRegistrationEvents ?? []).some((e) => e.date.trim()) && incOwners.some((e) => e.date.trim())) {
    next = { ...next, ownerRegistrationEvents: incOwners };
  }

  const incTa = incoming.technicalInspectionHistory ?? [];
  if (!(next.technicalInspectionHistory ?? []).some((r) => r.date.trim()) && incTa.some((r) => r.date.trim())) {
    next = { ...next, technicalInspectionHistory: incTa };
  } else if (
    countTaRows(incTa) > countTaRows(next.technicalInspectionHistory) &&
    countTaDefects(incTa) > countTaDefects(next.technicalInspectionHistory)
  ) {
    next = { ...next, technicalInspectionHistory: incTa };
  }

  if (
    !previousInspectionBlockHasData(next.prevInspectionBlock) &&
    previousInspectionBlockHasData(incoming.prevInspectionBlock)
  ) {
    next = { ...next, prevInspectionBlock: incoming.prevInspectionBlock };
  }

  if (!next.opacityCoefficient.trim() && incoming.opacityCoefficient.trim()) {
    next = { ...next, opacityCoefficient: incoming.opacityCoefficient };
  }

  if (!next.geminiContextRaw.trim() && incoming.geminiContextRaw.trim()) {
    next = { ...next, geminiContextRaw: incoming.geminiContextRaw };
  }

  next = {
    ...next,
    comments: existing.comments,
    prevInspectionWarnings: existing.prevInspectionWarnings,
    technicalInspectionWarnings: existing.technicalInspectionWarnings,
    pdfChecklist: existing.pdfChecklist ?? incoming.pdfChecklist,
  };

  return backfillCsddExtendedFromRaw(next);
}
