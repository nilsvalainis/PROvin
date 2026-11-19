/**
 * Admin: FLASH MAX noslēguma pārbaude - viens Claude Opus izsaukums pāri visiem ģenerētajiem laukiem
 * + kanoniskajai faktu lapai. Atbilde ir ieteikumi; teksts serverī netiek mainīts.
 * Atslēga: `process.env.ANTHROPIC_API_KEY` (tikai serverī, tā pati kā pārējiem ✨).
 */
import { NextResponse } from "next/server";

import { getAdminSession } from "@/lib/admin-auth";
import { mergeSourceBlocksFromBody, parseAiOrderContextFromBody } from "@/lib/admin-ai-api-body";
import { assertAiAllowedForSession } from "@/lib/admin-ai-demo-guard";
import { getAnthropicApiKeyFromEnv } from "@/lib/admin-ai";
import { withAiUsageOnJsonResponse } from "@/lib/admin-ai-route-response";
import { AI_ROUTE_BUDGET_MS, createAiRequestBudget } from "@/lib/ai-request-budget";
import { clipFlashMaxReviewFields } from "@/lib/flash-max-final-review";
import { runFlashMaxFinalReview } from "@/lib/flash-max-final-review-server";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!getAnthropicApiKeyFromEnv()) return NextResponse.json({ error: "missing_ai_key" }, { status: 503 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!body || typeof body !== "object") return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  const b = body as Record<string, unknown>;

  const fields = clipFlashMaxReviewFields(b.fields);
  if (fields.length === 0) return NextResponse.json({ findings: [] });

  const sourceBlocks = mergeSourceBlocksFromBody(b);
  const context = parseAiOrderContextFromBody(b, sourceBlocks);
  const guard = await assertAiAllowedForSession(context.sessionId);
  if (!guard.ok) {
    return NextResponse.json(
      { error: guard.error, ...(guard.detail ? { detail: guard.detail } : {}) },
      { status: guard.status },
    );
  }

  return withAiUsageOnJsonResponse(async () => {
    const result = await runFlashMaxFinalReview({
      fields,
      facts: context,
      budget: createAiRequestBudget(AI_ROUTE_BUDGET_MS.text),
    });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 502 });
    return NextResponse.json({ findings: result.findings });
  });
}
