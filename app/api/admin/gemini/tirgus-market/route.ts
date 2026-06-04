/**
 * Admin: Gemini — tirgus dati (ss.lv + IRISS EU izsoles + Latvijas tirgus).
 */
import { NextResponse } from "next/server";

import { getAdminSession } from "@/lib/admin-auth";
import { assertGeminiAllowedForSession } from "@/lib/admin-gemini-demo-guard";
import { getGeminiApiKeyFromEnv } from "@/lib/admin-gemini";
import { mergeSourceBlocksFromBody, parseGeminiOrderContextFromBody } from "@/lib/admin-gemini-api-body";
import { generateTirgusMarketWithGemini } from "@/lib/admin-gemini-tirgus-market";

export const maxDuration = 90;
export const runtime = "nodejs";

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

  const b = body as Record<string, unknown>;
  const sessionId = typeof b.sessionId === "string" ? b.sessionId.trim() : "";
  const guard = await assertGeminiAllowedForSession(sessionId);
  if (!guard.ok) {
    return NextResponse.json(
      { error: guard.error, ...(guard.detail ? { detail: guard.detail } : {}) },
      { status: guard.status },
    );
  }

  const sourceBlocks = mergeSourceBlocksFromBody(b);

  try {
    const result = await generateTirgusMarketWithGemini(parseGeminiOrderContextFromBody(b, sourceBlocks));
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    console.error("[gemini/tirgus-market]", msg);
    if (msg === "empty_order_context") {
      return NextResponse.json({ error: "empty_order_context" }, { status: 400 });
    }
    if (msg === "empty_tirgus_comment") {
      return NextResponse.json({ error: "empty_tirgus_comment" }, { status: 502 });
    }
    return NextResponse.json({ error: "generation_failed", detail: msg }, { status: 502 });
  }
}
