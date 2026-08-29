/**
 * FLASH MAX — viena poga: avotu komentāri + kopsavilkuma lauki.
 * Modeļi tie paši, kas atsevišķajām ✨ pogām. Esošais lauka teksts iet kā
 * existingDraftPlain — aģents to nedrīkst izmest.
 */
import {
  orderHasMileageDataForAi,
  orderHasSourceDataForAi,
} from "@/lib/admin-ai-data-availability";
import {
  orderHasOilIntervalDataForAi,
  sourceBlockHasDataExcludingComments,
  type AiSourceCommentBlockKey,
  type AiSourceCommentTargetField,
} from "@/lib/admin-source-comment-blocks";
import type { WorkspaceSourceBlocks } from "@/lib/admin-source-blocks";
import {
  ADMIN_INCIDENTS_SUMMARY_LABEL,
  ADMIN_MILEAGE_HISTORY_COMMENT_LABEL,
  ADMIN_SOURCES_COMPARISON_LABEL,
  ADMIN_TECHNICAL_RISKS_LABEL,
} from "@/lib/admin-workspace-field-labels";
import { AI_ADMIN_FIELD_DEFAULT_TIER } from "@/lib/ai-admin-field-defaults";
import type { AiAdminModelTier } from "@/lib/ai-admin-model-tier";

export const FLASH_MAX_DEFAULT_TIER: AiAdminModelTier = AI_ADMIN_FIELD_DEFAULT_TIER.source_comment;

export type FlashMaxSourceJob = {
  kind: "source";
  id: string;
  label: string;
  blockKey: AiSourceCommentBlockKey;
  targetField: AiSourceCommentTargetField;
};

export type FlashMaxSummaryJob = {
  kind: "summary";
  id:
    | "incidents"
    | "mileage"
    | "technical_risks"
    | "inspection"
    | "summary"
    | "sources_comparison";
  label: string;
  endpoint: string;
};

export type FlashMaxJob = FlashMaxSourceJob | FlashMaxSummaryJob;

export const FLASH_MAX_JOBS: readonly FlashMaxJob[] = [
  { kind: "source", id: "csdd", label: "CSDD", blockKey: "csdd", targetField: "comments" },
  { kind: "source", id: "autodna", label: "AutoDNA", blockKey: "autodna", targetField: "comments" },
  {
    kind: "source",
    id: "carvertical",
    label: "CarVertical",
    blockKey: "carvertical",
    targetField: "comments",
  },
  {
    kind: "source",
    id: "dealer_comments",
    label: "Oficiālā dīlera komentāri",
    blockKey: "auto_records",
    targetField: "comments",
  },
  {
    kind: "source",
    id: "dealer_service",
    label: "Oficiālā dīlera servisa vēsture",
    blockKey: "auto_records",
    targetField: "serviceHistoryNotes",
  },
  {
    kind: "source",
    id: "dealer_oil",
    label: "Eļļas maiņas intervāli",
    blockKey: "auto_records",
    targetField: "oilChangeIntervalNotes",
  },
  {
    kind: "summary",
    id: "incidents",
    label: ADMIN_INCIDENTS_SUMMARY_LABEL,
    endpoint: "/api/admin/ai/incidents-summary",
  },
  {
    kind: "summary",
    id: "mileage",
    label: ADMIN_MILEAGE_HISTORY_COMMENT_LABEL,
    endpoint: "/api/admin/ai/mileage-comment",
  },
  {
    kind: "summary",
    id: "technical_risks",
    label: `1. ${ADMIN_TECHNICAL_RISKS_LABEL}`,
    endpoint: "/api/admin/ai/technical-risk-analysis",
  },
  {
    kind: "summary",
    id: "inspection",
    label: "2. Ieteikumi klātienes apskatei",
    endpoint: "/api/admin/ai/inspection-recommendations",
  },
  {
    kind: "summary",
    id: "summary",
    label: "3. Kopsavilkums",
    endpoint: "/api/admin/ai/summary-analysis",
  },
  {
    kind: "summary",
    id: "sources_comparison",
    label: ADMIN_SOURCES_COMPARISON_LABEL,
    endpoint: "/api/admin/ai/sources-comparison",
  },
];

/** FLASH MAX lieto to pašu modeli, ko atsevišķā ✨ poga šim laukam. */
export function flashMaxJobModelTier(job: FlashMaxJob): AiAdminModelTier {
  if (job.kind === "source") return AI_ADMIN_FIELD_DEFAULT_TIER.source_comment;
  if (job.id === "incidents") return AI_ADMIN_FIELD_DEFAULT_TIER.incidents;
  if (job.id === "mileage") return AI_ADMIN_FIELD_DEFAULT_TIER.mileage;
  if (job.id === "technical_risks") return AI_ADMIN_FIELD_DEFAULT_TIER.technical_risks;
  if (job.id === "inspection") return AI_ADMIN_FIELD_DEFAULT_TIER.inspection;
  if (job.id === "summary") return AI_ADMIN_FIELD_DEFAULT_TIER.summary;
  return AI_ADMIN_FIELD_DEFAULT_TIER.sources_comparison;
}

export type FlashMaxSkipReason = "no_source_data" | "no_mileage_data" | "no_oil_data";

export function shouldSkipFlashMaxJob(
  job: FlashMaxJob,
  sourceBlocks: WorkspaceSourceBlocks,
): FlashMaxSkipReason | null {
  if (job.kind === "source") {
    if (job.targetField === "oilChangeIntervalNotes") {
      return orderHasOilIntervalDataForAi(sourceBlocks) ? null : "no_oil_data";
    }
    return sourceBlockHasDataExcludingComments(job.blockKey, sourceBlocks) ? null : "no_source_data";
  }
  if (job.id === "mileage") {
    return orderHasMileageDataForAi(sourceBlocks) ? null : "no_mileage_data";
  }
  if (job.id === "sources_comparison") {
    return orderHasSourceDataForAi(sourceBlocks) ? null : "no_source_data";
  }
  return null;
}

export function isFlashMaxEmptyDataError(error: string): boolean {
  const t = error.toLowerCase();
  return (
    t.includes("empty_source_data") ||
    t.includes("empty_mileage_data") ||
    t.includes("trūkst avota datu") ||
    t.includes("trūkst nobraukuma datu")
  );
}

export function formatFlashMaxSkipLabel(reason: FlashMaxSkipReason): string {
  if (reason === "no_mileage_data") return "nav nobraukuma datu";
  if (reason === "no_oil_data") return "nav eļļas intervāla datu";
  return "nav avota datu";
}

export type FlashMaxJobResult = {
  id: string;
  label: string;
  status: "ok" | "skipped" | "error";
  detail?: string;
};

export function formatFlashMaxNotice(results: FlashMaxJobResult[]): string {
  const ok = results.filter((r) => r.status === "ok").length;
  const skipped = results.filter((r) => r.status === "skipped").length;
  const failed = results.filter((r) => r.status === "error");
  if (ok === 0 && failed.length === 0) {
    return `FLASH MAX: nav ko ģenerēt (${skipped} izlaisti — vispirms aizpildi avotu tabulas).`;
  }
  if (failed.length === 0) {
    return `FLASH MAX: sagatavoti ${ok} lauki${skipped ? `, ${skipped} izlaisti` : ""}.`;
  }
  const names = failed.map((f) => f.label).join(", ");
  return `FLASH MAX: sagatavoti ${ok}, kļūdas: ${names}.`;
}
