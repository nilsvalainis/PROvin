/**
 * Admin: AI — Tehnisko risku analīze (APPROVED BY IRISS, 1. sadaļa).
 */
import { NextResponse } from "next/server";
import { nextJsonWithAiUsage } from "@/lib/admin-ai-route-response";
import { aiStreamResponse, wantsAiStream } from "@/lib/admin-ai-stream-response";

import { getAdminSession } from "@/lib/admin-auth";
import { assertAiAllowedForSession } from "@/lib/admin-ai-demo-guard";
import { generateTechnicalRiskAnalysisWithAi } from "@/lib/admin-ai-technical-risks";
import { hasAnyAdminAiProviderKey } from "@/lib/admin-ai-dispatch";
import { mergeSourceBlocksFromBody, parseAiOrderContextFromBody } from "@/lib/admin-ai-api-body";

export const maxDuration = 120;
export const runtime = "nodejs";

type BodyShape = {
  sessionId?: unknown;
  vin?: unknown;
  listingUrl?: unknown;
  customerName?: unknown;
  notes?: unknown;
  sourceBlocks?: unknown;
  iriss?: unknown;
  apskatesPlāns?: unknown;
  tehniskoRiskuAnalize?: unknown;
  cenasAtbilstiba?: unknown;
  internalComment?: unknown;
  mileageComment?: unknown;
  operatorNotes?: unknown;
  existingDraftPlain?: unknown;
};

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

export async function POST(req: Request) {
  const ok = await getAdminSession();
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  if (!hasAnyAdminAiProviderKey()) {
    return NextResponse.json({ error: "missing_ai_key" }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const b = body as BodyShape;
  const sessionId = str(b.sessionId).trim();
  const guard = await assertAiAllowedForSession(sessionId);
  if (!guard.ok) {
    return NextResponse.json(
      { error: guard.error, ...(guard.detail ? { detail: guard.detail } : {}) },
      { status: guard.status },
    );
  }

  const sourceBlocks = mergeSourceBlocksFromBody(b);
  const context = parseAiOrderContextFromBody(b, sourceBlocks);

  if (wantsAiStream(req)) {
    return aiStreamResponse(
      (stream) => generateTechnicalRiskAnalysisWithAi({ ...context, stream }),
      failureEvent,
    );
  }

  try {
    return await nextJsonWithAiUsage(() => generateTechnicalRiskAnalysisWithAi(context));
  } catch (e) {
    const { error, detail } = failureEvent(e);
    return NextResponse.json(
      { error, ...(detail ? { detail } : {}) },
      { status: error === "empty_order_context" ? 400 : 502 },
    );
  }
}

function failureEvent(e: unknown): { error: string; detail?: string } {
  const msg = e instanceof Error ? e.message : "unknown";
  console.error("[ai/technical-risk-analysis]", msg);
  if (msg === "empty_order_context") return { error: "empty_order_context" };
  return { error: "generation_failed", detail: msg };
}
