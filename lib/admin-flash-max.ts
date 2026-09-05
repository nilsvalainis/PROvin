/**
 * FLASH MAX — avotu komentāri + kopsavilkuma lauki.
 * Modeļi pēc noklusējuma tie paši, kas atsevišķajām ✨ pogām.
 * Esošais lauka teksts iet kā existingDraftPlain — aģents to nedrīkst izmest.
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
import {
  citiAvotiSectionHasContent,
  citiAvotiSectionLabel,
  SOURCE_BLOCK_LABELS,
  type WorkspaceSourceBlocks,
} from "@/lib/admin-source-blocks";
import {
  ADMIN_INCIDENTS_SUMMARY_LABEL,
  ADMIN_MILEAGE_HISTORY_COMMENT_LABEL,
  ADMIN_SOURCES_COMPARISON_LABEL,
  ADMIN_TECHNICAL_RISKS_LABEL,
} from "@/lib/admin-workspace-field-labels";
import { AI_ADMIN_FIELD_DEFAULT_TIER } from "@/lib/ai-admin-field-defaults";
import type { AiAdminModelTier } from "@/lib/ai-admin-model-tier";

export const FLASH_MAX_DEFAULT_TIER: AiAdminModelTier = AI_ADMIN_FIELD_DEFAULT_TIER.source_comment;

export type FlashMaxJobGroup = "daily" | "extra";

export type FlashMaxSourceJob = {
  kind: "source";
  id: string;
  label: string;
  group: FlashMaxJobGroup;
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
  group: FlashMaxJobGroup;
  endpoint: string;
};

export type FlashMaxListingJob = {
  kind: "listing";
  id: "seller" | "price";
  label: string;
  group: FlashMaxJobGroup;
  endpoint: string;
};

export type FlashMaxJob = FlashMaxSourceJob | FlashMaxSummaryJob | FlashMaxListingJob;

const dailySource = (
  id: string,
  label: string,
  blockKey: AiSourceCommentBlockKey,
  targetField: AiSourceCommentTargetField = "comments",
): FlashMaxSourceJob => ({
  kind: "source",
  id,
  label,
  group: "daily",
  blockKey,
  targetField,
});

const extraSource = (
  id: string,
  label: string,
  blockKey: AiSourceCommentBlockKey,
): FlashMaxSourceJob => ({
  kind: "source",
  id,
  label,
  group: "extra",
  blockKey,
  targetField: "comments",
});

export const FLASH_MAX_JOBS: readonly FlashMaxJob[] = [
  dailySource("csdd", "CSDD", "csdd"),
  dailySource("autodna", "AutoDNA", "autodna"),
  dailySource("carvertical", "CarVertical", "carvertical"),
  dailySource("dealer_comments", "Oficiālā dīlera komentāri", "auto_records"),
  dailySource("dealer_service", "Oficiālā dīlera servisa vēsture", "auto_records", "serviceHistoryNotes"),
  dailySource("dealer_oil", "Eļļas maiņas intervāli", "auto_records", "oilChangeIntervalNotes"),
  {
    kind: "summary",
    id: "incidents",
    label: ADMIN_INCIDENTS_SUMMARY_LABEL,
    group: "daily",
    endpoint: "/api/admin/ai/incidents-summary",
  },
  {
    kind: "summary",
    id: "mileage",
    label: ADMIN_MILEAGE_HISTORY_COMMENT_LABEL,
    group: "daily",
    endpoint: "/api/admin/ai/mileage-comment",
  },
  {
    kind: "summary",
    id: "technical_risks",
    label: `1. ${ADMIN_TECHNICAL_RISKS_LABEL}`,
    group: "daily",
    endpoint: "/api/admin/ai/technical-risk-analysis",
  },
  {
    kind: "summary",
    id: "inspection",
    label: "2. Ieteikumi klātienes apskatei",
    group: "daily",
    endpoint: "/api/admin/ai/inspection-recommendations",
  },
  {
    kind: "summary",
    id: "summary",
    label: "3. Kopsavilkums",
    group: "daily",
    endpoint: "/api/admin/ai/summary-analysis",
  },
  {
    kind: "summary",
    id: "sources_comparison",
    label: ADMIN_SOURCES_COMPARISON_LABEL,
    group: "daily",
    endpoint: "/api/admin/ai/sources-comparison",
  },
  extraSource("ltab", SOURCE_BLOCK_LABELS.ltab, "ltab"),
  extraSource("cc_vin", SOURCE_BLOCK_LABELS.cc_vin, "cc_vin"),
  extraSource("tjekbil", SOURCE_BLOCK_LABELS.tjekbil, "tjekbil"),
  extraSource("mnt_ee", SOURCE_BLOCK_LABELS.mnt_ee, "mnt_ee"),
  extraSource("lkf_ee", SOURCE_BLOCK_LABELS.lkf_ee, "lkf_ee"),
  extraSource("carinfo", SOURCE_BLOCK_LABELS.carinfo, "carinfo"),
  extraSource("citi_avoti", SOURCE_BLOCK_LABELS.citi_avoti, "citi_avoti"),
  extraSource("tirgus", SOURCE_BLOCK_LABELS.tirgus, "tirgus"),
  {
    kind: "listing",
    id: "seller",
    label: "Pārdevēja portrets",
    group: "extra",
    endpoint: "/api/admin/ai/seller-analysis",
  },
  {
    kind: "listing",
    id: "price",
    label: "Cenas vērtējums",
    group: "extra",
    endpoint: "/api/admin/ai/price-analysis",
  },
];

export const FLASH_MAX_DAILY_JOB_IDS: readonly string[] = FLASH_MAX_JOBS.filter((j) => j.group === "daily").map(
  (j) => j.id,
);

export const FLASH_MAX_SUMMARY_ONLY_JOB_IDS: readonly string[] = [
  "technical_risks",
  "inspection",
  "summary",
];

/** FLASH MAX noklusējuma modelis — tas pats, ko atsevišķā ✨ poga šim laukam. */
export function flashMaxJobModelTier(job: FlashMaxJob): AiAdminModelTier {
  if (job.kind === "source") return AI_ADMIN_FIELD_DEFAULT_TIER.source_comment;
  if (job.kind === "listing") {
    return job.id === "seller" ? AI_ADMIN_FIELD_DEFAULT_TIER.seller : AI_ADMIN_FIELD_DEFAULT_TIER.price;
  }
  if (job.id === "incidents") return AI_ADMIN_FIELD_DEFAULT_TIER.incidents;
  if (job.id === "mileage") return AI_ADMIN_FIELD_DEFAULT_TIER.mileage;
  if (job.id === "technical_risks") return AI_ADMIN_FIELD_DEFAULT_TIER.technical_risks;
  if (job.id === "inspection") return AI_ADMIN_FIELD_DEFAULT_TIER.inspection;
  if (job.id === "summary") return AI_ADMIN_FIELD_DEFAULT_TIER.summary;
  return AI_ADMIN_FIELD_DEFAULT_TIER.sources_comparison;
}

export const FLASH_MAX_OPERATOR_NOTES_MAX_LEN = 8000;

export function clipFlashMaxOperatorNotes(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.trim().slice(0, FLASH_MAX_OPERATOR_NOTES_MAX_LEN);
}

export type FlashMaxSelection = {
  selectedIds: string[];
  tiers: Record<string, AiAdminModelTier>;
  /** Operatora komanda visiem izvēlētajiem aģentiem (OPERATORA KOMANDAS). */
  operatorNotes?: string;
};

export function defaultFlashMaxTiers(): Record<string, AiAdminModelTier> {
  return Object.fromEntries(FLASH_MAX_JOBS.map((job) => [job.id, flashMaxJobModelTier(job)]));
}

export function defaultFlashMaxSelection(): FlashMaxSelection {
  return {
    selectedIds: [...FLASH_MAX_DAILY_JOB_IDS],
    tiers: defaultFlashMaxTiers(),
  };
}

export function summaryOnlyFlashMaxSelection(): FlashMaxSelection {
  return {
    selectedIds: [...FLASH_MAX_SUMMARY_ONLY_JOB_IDS],
    tiers: defaultFlashMaxTiers(),
  };
}

export function emptyFlashMaxSelection(): FlashMaxSelection {
  return { selectedIds: [], tiers: defaultFlashMaxTiers() };
}

export function flashMaxSelectedJobs(selection: FlashMaxSelection): FlashMaxJob[] {
  const ids = new Set(selection.selectedIds);
  return FLASH_MAX_JOBS.filter((job) => ids.has(job.id));
}

export function flashMaxJobTier(job: FlashMaxJob, selection: FlashMaxSelection): AiAdminModelTier {
  return selection.tiers[job.id] ?? flashMaxJobModelTier(job);
}

export type FlashMaxRunJob = FlashMaxJob & {
  runId: string;
  runLabel: string;
  citiAvotiSectionIndex?: number;
};

export function expandFlashMaxRunJobs(
  jobs: FlashMaxJob[],
  sourceBlocks: WorkspaceSourceBlocks,
): FlashMaxRunJob[] {
  const out: FlashMaxRunJob[] = [];
  for (const job of jobs) {
    if (job.kind === "source" && job.blockKey === "citi_avoti") {
      const sections = sourceBlocks.citi_avoti.sections ?? [];
      const total = Math.max(1, sections.length);
      const rows = sections.length > 0 ? sections : [undefined];
      rows.forEach((section, i) => {
        out.push({
          ...job,
          runId: `${job.id}:${i}`,
          runLabel: section ? citiAvotiSectionLabel(section, i, total) : job.label,
          citiAvotiSectionIndex: i,
        });
      });
      continue;
    }
    out.push({ ...job, runId: job.id, runLabel: job.label });
  }
  return out;
}

export type FlashMaxSkipReason = "no_source_data" | "no_mileage_data" | "no_oil_data";

export function shouldSkipFlashMaxJob(
  job: FlashMaxJob,
  sourceBlocks: WorkspaceSourceBlocks,
  opts?: { citiAvotiSectionIndex?: number },
): FlashMaxSkipReason | null {
  if (job.kind === "listing") return null;
  if (job.kind === "source") {
    if (job.blockKey === "citi_avoti" && opts?.citiAvotiSectionIndex != null) {
      const section = sourceBlocks.citi_avoti.sections?.[opts.citiAvotiSectionIndex];
      if (!section) return "no_source_data";
      return citiAvotiSectionHasContent({ ...section, comments: "" }) ? null : "no_source_data";
    }
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
