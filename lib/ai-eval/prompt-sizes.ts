/**
 * System-prompt size snapshot (chars and ≈ tokens at chars/3.2).
 * Used in PR body before/after comparison. No paid AI calls.
 */
import {
  AI_INCIDENTS_SUMMARY_SYSTEM,
  AI_INSPECTION_RECOMMENDATIONS_SYSTEM,
  AI_MILEAGE_COMMENT_SYSTEM,
  AI_PRICE_ANALYSIS_SYSTEM,
  AI_SELLER_ANALYSIS_SYSTEM,
  AI_SUMMARY_ANALYSIS_SYSTEM,
  AI_TECHNICAL_RISKS_ANALYSIS_SYSTEM,
  aiAutoRecordsOilIntervalSystemPrompt,
  aiSourceCommentSystemPrompt,
} from "@/lib/admin-ai-prompts";
import { SOURCE_BLOCK_LABELS } from "@/lib/admin-source-blocks";

export type PromptSizeRow = {
  field: string;
  chars: number;
  tokens: number;
};

const CHARS_PER_TOKEN = 3.2;

export function measurePromptSize(text: string): { chars: number; tokens: number } {
  const chars = text.length;
  return { chars, tokens: Math.round(chars / CHARS_PER_TOKEN) };
}

export function collectAdminSystemPromptSizes(): PromptSizeRow[] {
  const rows: Array<[string, string]> = [
    ["source_csdd", aiSourceCommentSystemPrompt(SOURCE_BLOCK_LABELS.csdd)],
    ["source_dealer", aiSourceCommentSystemPrompt(SOURCE_BLOCK_LABELS.auto_records)],
    ["technical_risks_v1", AI_TECHNICAL_RISKS_ANALYSIS_SYSTEM],
    ["inspection", AI_INSPECTION_RECOMMENDATIONS_SYSTEM],
    ["summary", AI_SUMMARY_ANALYSIS_SYSTEM],
    ["mileage", AI_MILEAGE_COMMENT_SYSTEM],
    ["incidents", AI_INCIDENTS_SUMMARY_SYSTEM],
    ["price", AI_PRICE_ANALYSIS_SYSTEM],
    ["seller", AI_SELLER_ANALYSIS_SYSTEM],
    ["oil_intervals", aiAutoRecordsOilIntervalSystemPrompt()],
  ];
  return rows.map(([field, text]) => ({ field, ...measurePromptSize(text) }));
}

export function formatPromptSizeTable(rows: PromptSizeRow[]): string {
  const header = "| Field | chars | ~tokens |";
  const sep = "|---|---:|---:|";
  const body = rows.map((r) => `| ${r.field} | ${r.chars.toLocaleString("en-US")} | ${r.tokens.toLocaleString("en-US")} |`);
  return [header, sep, ...body].join("\n");
}
