/**
 * Admin: Gemini — pārdevēja analīze (tikai DEMO pasūtījumi).
 * Rezultāts → `listing_analysis.sellerPortrait` (Pārdevēja portrets).
 * Atslēga: `process.env.GEMINI_API_KEY` (tikai serverī).
 */
import { NextResponse } from "next/server";

import { getAdminSession } from "@/lib/admin-auth";
import { assertGeminiAllowedForSession } from "@/lib/admin-gemini-demo-guard";
import { getGeminiApiKeyFromEnv } from "@/lib/admin-gemini";
import { generateSellerAnalysisWithGemini } from "@/lib/admin-gemini-seller";
import { mergeSourceBlocksWithDefaults, type WorkspaceSourceBlocks } from "@/lib/admin-source-blocks";

export const maxDuration = 120;
export const runtime = "nodejs";

type BodyShape = {
  sessionId?: unknown;
  vin?: unknown;
  listingUrl?: unknown;
  customerName?: unknown;
  notes?: unknown;
  sourceBlocks?: unknown;
  extraSellerName?: unknown;
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
  const extraSellerName =
    str(b.extraSellerName).trim() || sourceBlocks.listing_analysis.extraSellerName.trim();

  try {
    const text = await generateSellerAnalysisWithGemini({
      sessionId,
      vin: str(b.vin).trim() || null,
      listingUrl: str(b.listingUrl).trim() || null,
      customerName: str(b.customerName).trim() || null,
      notes: str(b.notes).trim() || null,
      sourceBlocks,
      extraSellerName: extraSellerName || undefined,
      irissSummary: str(b.iriss),
      inspectionPlan: str(b.apskatesPlāns),
      priceFit: str(b.cenasAtbilstiba),
    });
    return NextResponse.json({ text });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    console.error("[gemini/seller-analysis]", msg);
    if (msg === "missing_seller_input") {
      return NextResponse.json({ error: "missing_seller_input" }, { status: 400 });
    }
    return NextResponse.json({ error: "generation_failed", detail: msg }, { status: 502 });
  }
}
