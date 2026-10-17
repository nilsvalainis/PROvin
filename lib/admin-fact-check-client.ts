/**
 * Admin faktu pārbaudes klients: atslēgas, lauku vākšana, POST.
 * Tekstu nemaina. useAi netiek sūtīts (UNIT_FACT_CHECK_AI paliek izslēgts).
 */
import { adminRichHtmlToPlainText } from "@/lib/admin-rich-comment-html";
import {
  AI_SOURCE_COMMENT_BLOCK_KEYS,
  sourceBlockCommentsPlain,
  sourceCommentAiBusyKey,
} from "@/lib/admin-source-comment-blocks";
import { mergeSourceBlocksWithDefaults, SOURCE_BLOCK_LABELS, type WorkspaceSourceBlocks } from "@/lib/admin-source-blocks";
import {
  ADMIN_INCIDENTS_SUMMARY_LABEL,
  ADMIN_MILEAGE_HISTORY_COMMENT_LABEL,
  ADMIN_SOURCES_COMPARISON_LABEL,
  ADMIN_SUMMARY_SECTION_INSPECTION_HEADING,
  ADMIN_SUMMARY_SECTION_RISK_HEADING,
  ADMIN_SUMMARY_SECTION_SUMMARY_HEADING,
} from "@/lib/admin-workspace-field-labels";
import type { FactCheckFlag, FactCheckResult } from "@/lib/unit-facts/types";

export function parseVehicleYear(modelYear?: string | null, firstRegistration?: string | null): number | null {
  const y = Number.parseInt(String(modelYear ?? "").trim(), 10);
  if (y > 1980 && y < 2100) return y;
  const m = String(firstRegistration ?? "").match(/\b(19[89]\d|20[0-4]\d)\b/);
  return m ? Number(m[1]) : null;
}

export type FactCheckFieldText = {
  field: string;
  label: string;
  text: string;
};

export function factCheckDismissKey(flag: Pick<FactCheckFlag, "id" | "sentence">): string {
  return `${flag.id}|${flag.sentence}`;
}

export function isIntervalWarningFlag(flag: FactCheckFlag): boolean {
  if (flag.level !== "W") return false;
  if (flag.id === "unsourced_interval") return true;
  const blob = `${flag.id} ${flag.factId ?? ""} ${flag.message}`.toLowerCase();
  return /intervāl|interval/.test(blob);
}

export function visibleFactCheckFlags(
  flags: readonly FactCheckFlag[] | undefined,
  dismissed: ReadonlySet<string> | readonly string[],
): FactCheckFlag[] {
  const skip = dismissed instanceof Set ? dismissed : new Set(dismissed);
  return (flags ?? []).filter((f) => !skip.has(factCheckDismissKey(f)));
}

export function openErrorFactCheckFlags(
  flags: readonly FactCheckFlag[] | undefined,
  dismissed: ReadonlySet<string> | readonly string[],
): FactCheckFlag[] {
  return visibleFactCheckFlags(flags, dismissed).filter((f) => f.level === "E");
}

export function collectFilledFactCheckFields(input: {
  tehniskoRiskuAnalize: string;
  iriss: string;
  apskatesPlāns: string;
  mileageComment: string;
  incidentsComment: string;
  sourcesComparisonComment: string;
  sourceBlocks: WorkspaceSourceBlocks;
}): FactCheckFieldText[] {
  const out: FactCheckFieldText[] = [];
  const push = (field: string, label: string, html: string) => {
    const text = adminRichHtmlToPlainText(html).trim();
    if (!text) return;
    out.push({ field, label, text });
  };

  push("technical_risks", ADMIN_SUMMARY_SECTION_RISK_HEADING, input.tehniskoRiskuAnalize);
  push("inspection", ADMIN_SUMMARY_SECTION_INSPECTION_HEADING, input.apskatesPlāns);
  push("summary", ADMIN_SUMMARY_SECTION_SUMMARY_HEADING, input.iriss);
  push("mileage", ADMIN_MILEAGE_HISTORY_COMMENT_LABEL, input.mileageComment);
  push("incidents", ADMIN_INCIDENTS_SUMMARY_LABEL, input.incidentsComment);
  push("sources_comparison", ADMIN_SOURCES_COMPARISON_LABEL, input.sourcesComparisonComment);

  const blocks = mergeSourceBlocksWithDefaults(input.sourceBlocks);
  for (const key of AI_SOURCE_COMMENT_BLOCK_KEYS) {
    if (key === "citi_avoti") {
      for (const [i, section] of blocks.citi_avoti.sections.entries()) {
        push(
          sourceCommentAiBusyKey("citi_avoti", "comments", i),
          `${SOURCE_BLOCK_LABELS.citi_avoti} ${i + 1}`,
          section.comments,
        );
      }
      continue;
    }
    push(sourceCommentAiBusyKey(key), SOURCE_BLOCK_LABELS[key], sourceBlockCommentsPlain(key, blocks));
    if (key === "auto_records") {
      push(
        sourceCommentAiBusyKey(key, "oilChangeIntervalNotes"),
        "Eļļas maiņas intervāli",
        blocks.auto_records.oilChangeIntervalNotes ?? "",
      );
      push(
        sourceCommentAiBusyKey(key, "serviceHistoryNotes"),
        "Servisa vēsture",
        blocks.auto_records.serviceHistoryNotes ?? "",
      );
    }
  }
  return out;
}

export async function postAdminFactCheck(body: Record<string, unknown>): Promise<FactCheckResult> {
  const res = await fetch("/api/admin/ai/fact-check", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as Partial<FactCheckResult> & { error?: string };
  if (!res.ok) {
    return { flags: [], appliedFactIds: [], checkedAt: new Date().toISOString() };
  }
  return {
    flags: Array.isArray(data.flags) ? data.flags : [],
    appliedFactIds: Array.isArray(data.appliedFactIds) ? data.appliedFactIds : [],
    checkedAt: typeof data.checkedAt === "string" ? data.checkedAt : new Date().toISOString(),
  };
}
