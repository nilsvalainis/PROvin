/**
 * Admin: Gemini — cenas atbilstības analīze (tikai DEMO pasūtījumi).
 * Rezultāts → workspace `cenasAtbilstiba`.
 * Atslēga: `process.env.GEMINI_API_KEY` (tikai serverī).
 */
import { NextResponse } from "next/server";

import { getAdminSession } from "@/lib/admin-auth";
import { assertGeminiAllowedForSession } from "@/lib/admin-gemini-demo-guard";
import { getGeminiApiKeyFromEnv } from "@/lib/admin-gemini";
import { generatePriceAnalysisWithGemini } from "@/lib/admin-gemini-price";
import { mergeSourceBlocksWithDefaults, type WorkspaceSourceBlocks } from "@/lib/admin-source-blocks";

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
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const sourceBlocks = mergeSourceBlocksWithDefaults(
    (b.sourceBlocks ?? {}) as Partial<WorkspaceSourceBlocks>,
  );

  try {
    const text = await generatePriceAnalysisWithGemini({
      sessionId,
      vin: str(b.vin).trim() || null,
      listingUrl: str(b.listingUrl).trim() || null,
      customerName: str(b.customerName).trim() || null,
      notes: str(b.notes).trim() || null,
      sourceBlocks,
      irissSummary: str(b.iriss),
      inspectionPlan: str(b.apskatesPlāns),
      priceFit: str(b.cenasAtbilstiba),
    });
    return NextResponse.json({ text });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    console.error("[gemini/price-analysis]", msg);
    if (msg === "empty_order_context") {
      return NextResponse.json({ error: "empty_order_context" }, { status: 400 });
    }
    if (msg === "listing_scrape_failed") {
      return NextResponse.json({ error: "listing_scrape_failed" }, { status: 502 });
    }
    return NextResponse.json({ error: "generation_failed", detail: msg }, { status: 502 });
  }
}
