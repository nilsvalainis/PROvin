/**
 * Admin: Gemini — ieteikumi klātienes apskatei (tikai DEMO pasūtījumi).
 * Atslēga: `process.env.GEMINI_API_KEY` (tikai serverī).
 */
import { NextResponse } from "next/server";

import { getAdminSession } from "@/lib/admin-auth";
import { assertGeminiAllowedForSession } from "@/lib/admin-gemini-demo-guard";
import { generateInspectionRecommendationsWithGemini } from "@/lib/admin-gemini-inspection";
import { getGeminiApiKeyFromEnv } from "@/lib/admin-gemini";
import { mergeSourceBlocksFromBody, parseGeminiOrderContextFromBody } from "@/lib/admin-gemini-api-body";

export const maxDuration = 90;
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

  if (!getGeminiApiKeyFromEnv()) {
    return NextResponse.json({ error: "missing_gemini_key" }, { status: 503 });
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
  const guard = await assertGeminiAllowedForSession(sessionId);
  if (!guard.ok) {
    return NextResponse.json(
      { error: guard.error, ...(guard.detail ? { detail: guard.detail } : {}) },
      { status: guard.status },
    );
  }

  const sourceBlocks = mergeSourceBlocksFromBody(b);

  try {
    const text = await generateInspectionRecommendationsWithGemini(parseGeminiOrderContextFromBody(b, sourceBlocks));
    return NextResponse.json({ text });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    console.error("[gemini/inspection-recommendations]", msg);
    if (msg === "empty_order_context") {
      return NextResponse.json({ error: "empty_order_context" }, { status: 400 });
    }
    return NextResponse.json({ error: "generation_failed", detail: msg }, { status: 502 });
  }
}
