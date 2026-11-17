/**
 * Order Copilot — CSDD e.csdd.lv PDF atpazīšana un merge (tukšie lauki).
 */
import {
  CSDD_FORM_STRUCTURED_FIELDS,
  CSDD_RAW_UNPROCESSED_MAX_LEN,
  type CsddFormFields,
  type WorkspaceSourceBlocks,
} from "@/lib/admin-source-blocks";
import type { CopilotApplyMode, CopilotSourceKey } from "@/lib/admin-copilot-types";
import { listCsddCriticalGaps } from "@/lib/csdd-pdf-ingest";
import { mergeCsddPdfRawSources } from "@/lib/csdd-pdf-raw-merge";
import {
  previousInspectionBlockHasData,
  type CsddTechnicalInspectionRow,
} from "@/lib/csdd-extended-parse";
import { backfillCsddExtendedFromRaw, isLikelyStructuredCsddPaste } from "@/lib/csdd-paste-parse";
import { CSDD_API_LOCKED_KEYS, protectCsddApiFields } from "@/lib/csdd-field-lock";

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

  if (!next.aiContextRaw.trim() && incoming.aiContextRaw.trim()) {
    next = { ...next, aiContextRaw: incoming.aiContextRaw };
  }

  next = {
    ...next,
    comments: existing.comments,
    prevInspectionWarnings: existing.prevInspectionWarnings,
    technicalInspectionWarnings: existing.technicalInspectionWarnings,
    pdfChecklist: existing.pdfChecklist ?? incoming.pdfChecklist,
  };

  // API (reģistra) lauki paliek prioritāri; atšķirīga PDF vērtība → konflikta atzīme.
  if (!existing.registry) return backfillCsddExtendedFromRaw(next);
  const withIncoming: CsddFormFields = { ...next };
  for (const key of CSDD_API_LOCKED_KEYS) {
    const inc = String(incoming[key] ?? "").trim();
    if (inc) withIncoming[key] = inc;
  }
  return backfillCsddExtendedFromRaw(protectCsddApiFields(existing, withIncoming, "pdf"));
}

function scalarNewlyFilled(before: string, after: string): boolean {
  return !before.trim() && Boolean(after.trim());
}

function csddCoreVisibleFilled(fields: CsddFormFields): boolean {
  return Boolean(
    fields.ownerCountLatvia.trim() ||
      fields.previousRegistrationCountry.trim() ||
      fields.prevInspectionDate.trim() ||
      fields.nextInspectionDate.trim() ||
      previousInspectionBlockHasData(fields.prevInspectionBlock) ||
      (fields.technicalInspectionHistory ?? []).some((row) => row.date.trim()) ||
      fields.mileageHistory.some((row) => row.odometer.trim()),
  );
}

function labelFromForm(label: string): string {
  const bare = label.replace(/:\s*$/, "").trim();
  if (!bare) return bare;
  return bare.charAt(0).toLocaleLowerCase("lv") + bare.slice(1);
}

/**
 * Kuri tukšie CSDD lauki merge rezultātā tiešām ieguva vērtību.
 * Ziņojums drīkst nosaukt tikai šos.
 */
export function listCsddEmptyFieldsWritten(before: CsddFormFields, after: CsddFormFields): string[] {
  const labels: string[] = [];
  const used = new Set<keyof CsddFormFields>();

  if (scalarNewlyFilled(before.ownerCountLatvia, after.ownerCountLatvia)) {
    labels.push(`īpašnieku skaits (${after.ownerCountLatvia.trim()})`);
    used.add("ownerCountLatvia");
  }
  if (scalarNewlyFilled(before.previousRegistrationCountry, after.previousRegistrationCountry)) {
    labels.push(`iepriekšējās reģistrācijas valsts (${after.previousRegistrationCountry.trim()})`);
    used.add("previousRegistrationCountry");
  }

  const beforeOwners = (before.ownerRegistrationEvents ?? []).some((event) => event.date.trim() || event.label.trim());
  const afterOwners = (after.ownerRegistrationEvents ?? []).some((event) => event.date.trim() || event.label.trim());
  if (!beforeOwners && afterOwners) labels.push("īpašnieku reģistrācija");

  const taAfter = countTaRows(after.technicalInspectionHistory);
  const taGrew = taAfter > countTaRows(before.technicalInspectionHistory);
  if (taGrew) labels.push(`TA vēsture (${taAfter})`);

  const inspectionScalar =
    scalarNewlyFilled(before.prevInspectionDate, after.prevInspectionDate) ||
    scalarNewlyFilled(before.nextInspectionDate, after.nextInspectionDate) ||
    scalarNewlyFilled(before.opacityCoefficient, after.opacityCoefficient) ||
    scalarNewlyFilled(before.particulateMatter, after.particulateMatter);
  const prevGained =
    !previousInspectionBlockHasData(before.prevInspectionBlock) &&
    previousInspectionBlockHasData(after.prevInspectionBlock);
  if (prevGained || inspectionScalar) {
    labels.push("apskates dati");
    used.add("prevInspectionDate");
    used.add("nextInspectionDate");
    used.add("opacityCoefficient");
    used.add("particulateMatter");
  }

  const mileageAfter = countMileageRows(after);
  if (mileageAfter > countMileageRows(before)) labels.push(`nobraukums (${mileageAfter})`);

  for (const { key, label } of CSDD_FORM_STRUCTURED_FIELDS) {
    if (used.has(key)) continue;
    if (scalarNewlyFilled(String(before[key] ?? ""), String(after[key] ?? ""))) {
      labels.push(labelFromForm(label));
    }
  }

  return labels;
}

/**
 * Īsa latviešu rinda Copilot čatam.
 * «aizpildīti tukšie lauki» tikai ja kaut kas tiešām ierakstīts un kritiskie lauki nav palikuši tukši.
 */
export function formatCsddCopilotImportNote(
  fileName: string,
  writtenLabels: string[],
  missingCritical: string[] = [],
  rawOnly = false,
): string {
  const name = fileName.trim() || "PDF";
  if (missingCritical.length > 0) {
    const wrote = writtenLabels.length > 0 ? `Ierakstīts: ${writtenLabels.join(", ")}. ` : "";
    return `CSDD PDF „${name}” - ${wrote}Nav nolasīts: ${missingCritical.join(", ")}.`;
  }
  if (writtenLabels.length > 0) {
    return `CSDD PDF „${name}” - aizpildīti tukšie lauki: ${writtenLabels.join(", ")}.`;
  }
  if (rawOnly) {
    return `CSDD PDF „${name}” - strukturētie lauki nav nolasīti.`;
  }
  return `CSDD PDF „${name}” - jaunu tukšu lauku nav.`;
}

export type CsddPdfEmptyFillResult = {
  block: CsddFormFields;
  /** Strukturētie lauki, kas no tukša kļuva par vērtību. */
  writtenLabels: string[];
  /** PDF tekstā redzami, bet pēc merge joprojām tukši. */
  missingCritical: string[];
  /** Vai bloks jānosūta klientam (arī ja ierakstīts tikai neapstrādātais teksts). */
  changed: boolean;
  note: string;
};

/** CSDD PDF → tukšie pasūtījuma lauki + godīga piezīme. */
export function applyCsddPdfToEmptyFields(
  existing: CsddFormFields,
  incoming: CsddFormFields,
  incomingRaw: string | undefined,
  fileName: string,
): CsddPdfEmptyFillResult {
  const block = mergeCsddFieldsFillEmpty(existing, incoming, incomingRaw);
  const writtenLabels = listCsddEmptyFieldsWritten(existing, block);
  const missingCritical = listCsddCriticalGaps(block, block.rawUnprocessedData || incomingRaw || "");
  const rawGrew =
    (block.rawUnprocessedData ?? "").trim().length > (existing.rawUnprocessedData ?? "").trim().length;
  const rawOnly = writtenLabels.length === 0 && rawGrew && !csddCoreVisibleFilled(block) && missingCritical.length === 0;
  if (writtenLabels.length === 0 && rawGrew && csddCoreVisibleFilled(existing) && missingCritical.length === 0) {
    writtenLabels.push("neapstrādātais teksts");
  }
  const changed = writtenLabels.length > 0 || rawOnly || (missingCritical.length > 0 && rawGrew);
  return {
    block,
    writtenLabels,
    missingCritical,
    changed,
    note: formatCsddCopilotImportNote(fileName, writtenLabels, missingCritical, rawOnly),
  };
}

/**
 * Chat vienmēr sūta preview, tāpēc AI darbības paliek apstiprināšanai.
 * Determinētais CSDD imports (tukšie lauki) jāatgriež uzreiz, citādi čats saka, ka aizpildīja, bet forma paliek tukša.
 */
export function selectCopilotClientPatch(opts: {
  applyMode: CopilotApplyMode;
  autoAppliedCount: number;
  changedKeys: readonly CopilotSourceKey[];
  workingBlocks: WorkspaceSourceBlocks;
  deterministicPatches: Partial<WorkspaceSourceBlocks>;
}): { changedKeys: CopilotSourceKey[]; patchedSourceBlocks: Partial<WorkspaceSourceBlocks> } {
  const deterministicKeys = (Object.keys(opts.deterministicPatches) as CopilotSourceKey[]).filter(
    (key) => opts.deterministicPatches[key] != null,
  );
  const autoShouldPatch =
    opts.applyMode === "auto" && (opts.autoAppliedCount > 0 || opts.changedKeys.length > 0 || deterministicKeys.length > 0);

  if (autoShouldPatch) {
    const keys = [...new Set<CopilotSourceKey>([...opts.changedKeys, ...deterministicKeys])];
    const patchedSourceBlocks = Object.fromEntries(
      keys.flatMap((key) => {
        const block = opts.workingBlocks[key] ?? opts.deterministicPatches[key];
        return block != null ? [[key, block] as const] : [];
      }),
    ) as Partial<WorkspaceSourceBlocks>;
    return { changedKeys: keys, patchedSourceBlocks };
  }

  const patchedSourceBlocks = Object.fromEntries(
    deterministicKeys.flatMap((key) => {
      const block = opts.deterministicPatches[key];
      return block != null ? [[key, block] as const] : [];
    }),
  ) as Partial<WorkspaceSourceBlocks>;
  return { changedKeys: deterministicKeys, patchedSourceBlocks };
}
