/**
 * Admin: AI — ātrā sludinājuma komentārs (Gemini Flash / Gemini).
 */
import { NextResponse } from "next/server";
import { nextJsonBodyWithAiUsage } from "@/lib/admin-ai-route-response";

import { getAdminSession } from "@/lib/admin-auth";
import { hasAnyAdminAiProviderKey } from "@/lib/admin-ai-dispatch";
import { generateListingPeekCommentWithAi } from "@/lib/admin-ai-listing-peek";
import { parseAiModelTier } from "@/lib/ai-admin-model-tier";

export const maxDuration = 90;
export const runtime = "nodejs";

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

  const b = body as Record<string, unknown>;
  const listingUrl = str(b.listingUrl).trim();
  if (!listingUrl) {
    return NextResponse.json({ error: "empty_order_context" }, { status: 400 });
  }

  try {
    return await nextJsonBodyWithAiUsage(async () => {
      const result = await generateListingPeekCommentWithAi({
        listingUrl,
        operatorNotes: str(b.operatorNotes),
        existingDraftPlain: str(b.existingDraftPlain).trim() || undefined,
        modelTier:
          str(b.modelTier).trim() ? parseAiModelTier(b.modelTier) : "gemini-flash",
      });
      return {
        ...result.lines,
        closer: result.closer,
        text: result.text,
      };
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    if (msg === "empty_order_context") {
      return NextResponse.json({ error: "empty_order_context" }, { status: 400 });
    }
    console.error("[ai/listing-peek-comment]", msg);
    return NextResponse.json({ error: "generation_failed", detail: msg }, { status: 502 });
  }
}
