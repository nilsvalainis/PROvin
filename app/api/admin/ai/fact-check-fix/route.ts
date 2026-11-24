/**
 * Admin: faktu pārbaudes «Labot» - viens AI izsaukums vienam laukam (teksts + pretrunas + faktu lapa).
 * Atbilde ir labojumu ieteikumi; serverī teksts netiek mainīts un nekas netiek saglabāts.
 */
import { NextResponse } from "next/server";

import { getAdminSession } from "@/lib/admin-auth";
import { getAnthropicApiKeyFromEnv } from "@/lib/admin-ai";
import { mergeSourceBlocksFromBody, parseAiOrderContextFromBody } from "@/lib/admin-ai-api-body";
import { assertAiAllowedForSession } from "@/lib/admin-ai-demo-guard";
import { withAiUsageOnJsonResponse } from "@/lib/admin-ai-route-response";
import { adminRichHtmlToPlainText } from "@/lib/admin-rich-comment-html";
import { AI_ROUTE_BUDGET_MS, createAiRequestBudget } from "@/lib/ai-request-budget";
import { clipFactCheckAiFixFlags, factCheckAiFixField } from "@/lib/fact-check-ai-fix";
import { runFactCheckAiFix } from "@/lib/fact-check-ai-fix-server";

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

  const rawText = typeof b.text === "string" ? b.text : "";
  const text = /<[a-z][\s\S]*>/i.test(rawText) ? adminRichHtmlToPlainText(rawText) : rawText;
  const field = factCheckAiFixField(typeof b.fieldLabel === "string" ? b.fieldLabel : "", text);
  const flags = clipFactCheckAiFixFlags(b.flags);
  if (!field.text || flags.length === 0) return NextResponse.json({ findings: [] });

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
    const result = await runFactCheckAiFix({
      field,
      flags,
      facts: context,
      budget: createAiRequestBudget(AI_ROUTE_BUDGET_MS.text),
    });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 502 });
    return NextResponse.json({ findings: result.findings });
  });
}
