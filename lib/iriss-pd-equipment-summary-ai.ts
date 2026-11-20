import "server-only";

import { CLAUDE_MODEL_SONNET, aiGenerateJsonWithSchema, getAnthropicApiKeyFromEnv } from "@/lib/admin-ai";
import {
  IRISS_PD_EQ_SUMMARY_SCHEMA,
  IRISS_PD_EQ_SUMMARY_SYSTEM,
  irissPdEqSummaryDecision,
  irissPdEqSummaryHash,
  irissPdEqSummarySource,
  irissPdEqSummaryUserPrompt,
  newIrissPdEquipmentSummary,
  parseIrissPdEqSummaryAiJson,
  type IrissPdEquipmentSummary,
} from "@/lib/iriss-pd-equipment-summary";
import type { IrissPiedavajums } from "@/lib/iriss-piedavajumi-types";

/** Sonnet līmenis pietiek (failover tikai uz lētāko Haiku, nekad uz Opus). */
export const IRISS_PD_EQ_SUMMARY_MODEL = CLAUDE_MODEL_SONNET;

export type IrissPdEqSummaryResult =
  | { ok: true; summary: IrissPdEquipmentSummary; generated: boolean }
  | { ok: false; error: "no_source" | "confirm_required" | "no_ai" | "ai_failed" };

type Generate = typeof aiGenerateJsonWithSchema;

/**
 * Viens AI izsaukums piedāvājumam. Bez `force` ģenerē tikai, ja nav vai avots mainījies (un teksts nav labots).
 * Kļūmes gadījumā esošais kopsavilkums paliek, PD strādā tāpat.
 */
export async function generateIrissPdEquipmentSummary(
  rec: Pick<IrissPiedavajums, "vehicle" | "auto1" | "equipmentSummaryLv">,
  opts: { force?: boolean; confirm?: boolean; at: string },
  deps: { generate?: Generate; hasKey?: () => boolean } = {},
): Promise<IrissPdEqSummaryResult> {
  const src = irissPdEqSummarySource(rec);
  const existing = rec.equipmentSummaryLv;
  const decision = irissPdEqSummaryDecision(existing, src, opts);
  if (decision === "no_source" || decision === "confirm_required") return { ok: false, error: decision };
  if (decision === "keep" && existing) return { ok: true, summary: existing, generated: false };
  if (!(deps.hasKey ?? (() => Boolean(getAnthropicApiKeyFromEnv())))()) return { ok: false, error: "no_ai" };
  try {
    const raw = await (deps.generate ?? aiGenerateJsonWithSchema)({
      model: IRISS_PD_EQ_SUMMARY_MODEL,
      systemInstruction: IRISS_PD_EQ_SUMMARY_SYSTEM,
      parts: [{ text: irissPdEqSummaryUserPrompt(src) }],
      responseSchema: IRISS_PD_EQ_SUMMARY_SCHEMA as unknown as Record<string, unknown>,
      maxTokens: 8000,
    });
    const parsed = parseIrissPdEqSummaryAiJson(raw);
    if (!parsed) return { ok: false, error: "ai_failed" };
    return {
      ok: true,
      generated: true,
      summary: newIrissPdEquipmentSummary(parsed, {
        at: opts.at,
        sourceHash: irissPdEqSummaryHash(src),
        model: IRISS_PD_EQ_SUMMARY_MODEL,
        on: existing?.on ?? true,
      }),
    };
  } catch (e) {
    console.warn("[iriss-pd-eq-summary] ai_failed", { message: (e instanceof Error ? e.message : String(e)).slice(0, 200) });
    return { ok: false, error: "ai_failed" };
  }
}
