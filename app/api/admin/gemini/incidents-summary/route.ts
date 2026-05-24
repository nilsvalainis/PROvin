/**
 * Admin: Gemini — NEGADĪJUMU VĒSTURES KOPSAVILKUMS (tikai DEMO pasūtījumi).
 */
import { NextResponse } from "next/server";

import { getAdminSession } from "@/lib/admin-auth";
import { assertGeminiAllowedForSession } from "@/lib/admin-gemini-demo-guard";
import { getGeminiApiKeyFromEnv } from "@/lib/admin-gemini";
import { generateIncidentsSummaryWithGemini } from "@/lib/admin-gemini-incidents-summary";
import { mergeSourceBlocksFromBody, parseGeminiOrderContextFromBody } from "@/lib/admin-gemini-api-body";

export const maxDuration = 90;
export const runtime = "nodejs";

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

  const b = body as Record<string, unknown>;
  const sessionId = str(b.sessionId).trim();
  const guard = await assertGeminiAllowedForSession(sessionId);
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const sourceBlocks = mergeSourceBlocksFromBody(b);

  try {
    const text = await generateIncidentsSummaryWithGemini(parseGeminiOrderContextFromBody(b, sourceBlocks));
    return NextResponse.json({ text });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    console.error("[gemini/incidents-summary]", msg);
    if (msg === "empty_incident_data") {
      return NextResponse.json({ error: "empty_incident_data" }, { status: 400 });
    }
    return NextResponse.json({ error: "generation_failed", detail: msg }, { status: 502 });
  }
}
