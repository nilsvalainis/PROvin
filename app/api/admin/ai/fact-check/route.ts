/**
 * Admin: pirms-publicēšanas faktu pārbaude AI komentāram pret PROVIN agregātu faktu bāzi.
 * Teksts NETIEK mainīts; atbilde ir karodziņi adminam. Deterministiskā daļa ir bez maksas;
 * Gemini Flash slānis tikai ar UNIT_FACT_CHECK_AI=1.
 */
import { NextResponse } from "next/server";

import { getAdminSession } from "@/lib/admin-auth";
import { assertAiAllowedForSession } from "@/lib/admin-ai-demo-guard";
import { nextJsonBodyWithAiUsage } from "@/lib/admin-ai-route-response";
import { mergeSourceBlocksFromBody, parseAiOrderContextFromBody } from "@/lib/admin-ai-api-body";
import { buildAiOrderContextText } from "@/lib/admin-ai-order-context";
import { adminRichHtmlToPlainText } from "@/lib/admin-rich-comment-html";
import { collectFilledFactCheckFields } from "@/lib/admin-fact-check-client";
import { buildCanonicalFacts } from "@/lib/canonical-facts-sheet";
import { checkCommentContradictions, mergeFactCheckFlags } from "@/lib/comment-contradiction-check";
import { checkAiCommentFacts } from "@/lib/unit-facts/check";
import { aiCheckAgainstUnitFacts, isUnitFactAiCheckEnabled } from "@/lib/unit-facts/ai-check";

export const runtime = "nodejs";
export const maxDuration = 60;

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

export async function POST(req: Request) {
  const ok = await getAdminSession();
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const b = body as Record<string, unknown>;
  const rawText = str(b.text);
  const text = /<[a-z][\s\S]*>/i.test(rawText) ? adminRichHtmlToPlainText(rawText) : rawText;
  if (!text.trim()) return NextResponse.json({ flags: [], appliedFactIds: [] });

  const sourceBlocks = mergeSourceBlocksFromBody(b);
  const context = parseAiOrderContextFromBody(b, sourceBlocks);
  // Tikai šī pasūtījuma dati (bez stila korpusa / citu auto vēstures), lai „avots” ir šis auto.
  const contextText = str(b.contextText).trim() || buildAiOrderContextText(context);
  const year = typeof b.year === "number" ? b.year : null;
  const input = {
    text,
    field: str(b.field) || undefined,
    contextText,
    vehicleLabel: str(b.vehicleLabel) || undefined,
    year,
  };

  const result = checkAiCommentFacts(input);
  const facts = buildCanonicalFacts(context);
  const otherFieldTexts = collectFilledFactCheckFields({
    tehniskoRiskuAnalize: context.technicalRiskAnalysis ?? "",
    iriss: context.irissSummary ?? "",
    apskatesPlāns: context.inspectionPlan ?? "",
    mileageComment: context.mileageComment ?? "",
    incidentsComment: context.internalComment ?? "",
    sourcesComparisonComment: context.sourcesComparisonComment ?? "",
    sourceBlocks,
  }).map((f) => ({ field: f.field, label: f.label, text: f.text }));
  const sheetFlags = checkCommentContradictions({
    text,
    field: input.field,
    facts,
    otherFieldTexts,
  });
  const mergedFlags = mergeFactCheckFlags(result.flags, sheetFlags);
  const merged = { ...result, flags: mergedFlags };
  const wantAi = b.useAi === true && isUnitFactAiCheckEnabled();
  if (!wantAi) return NextResponse.json({ ...merged, aiUsed: false });

  // Maksas slānis (Gemini Flash): tā pati demo/sesijas aizsardzība kā citiem AI maršrutiem.
  const guard = await assertAiAllowedForSession(context.sessionId);
  if (!guard.ok) return NextResponse.json({ ...result, aiUsed: false, aiSkipped: guard.error });

  return nextJsonBodyWithAiUsage(async () => {
    const aiFlags = await aiCheckAgainstUnitFacts(input);
    const seen = new Set(merged.flags.map((f) => `${f.factId ?? ""}|${f.sentence}`));
    const withAi = [...merged.flags, ...aiFlags.filter((f) => !seen.has(`${f.factId ?? ""}|${f.sentence}`))];
    return { ...merged, flags: withAi, aiUsed: true };
  });
}
