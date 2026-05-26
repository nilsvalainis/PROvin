/**
 * Admin: Gemini — avota bloka „Komentāri” ģenerēšana (tikai DEMO pasūtījumi).
 */
import { NextResponse } from "next/server";

import { getAdminSession } from "@/lib/admin-auth";
import { assertGeminiAllowedForSession } from "@/lib/admin-gemini-demo-guard";
import { getGeminiApiKeyFromEnv } from "@/lib/admin-gemini";
import {
  generateSourceCommentWithGemini,
  isGeminiSourceCommentBlockKey,
} from "@/lib/admin-gemini-source-comment";
import { mergeSourceBlocksFromBody } from "@/lib/admin-gemini-api-body";
import { sourceBlockCommentsPlainForGemini } from "@/lib/admin-source-comment-blocks";
import { adminRichHtmlToPlainText } from "@/lib/admin-rich-comment-html";

export const maxDuration = 90;
export const runtime = "nodejs";

type BodyShape = {
  sessionId?: unknown;
  blockKey?: unknown;
  vin?: unknown;
  listingUrl?: unknown;
  customerName?: unknown;
  notes?: unknown;
  sourceBlocks?: unknown;
  internalComment?: unknown;
  mileageComment?: unknown;
  operatorNotes?: unknown;
  existingDraftPlain?: unknown;
  citiAvotiSectionIndex?: unknown;
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
  const blockKeyRaw = str(b.blockKey).trim();
  if (!isGeminiSourceCommentBlockKey(blockKeyRaw)) {
    return NextResponse.json({ error: "invalid_block_key" }, { status: 400 });
  }

  const guard = await assertGeminiAllowedForSession(sessionId);
  if (!guard.ok) {
    return NextResponse.json(
      { error: guard.error, ...(guard.detail ? { detail: guard.detail } : {}) },
      { status: guard.status },
    );
  }

  const sourceBlocks = mergeSourceBlocksFromBody(b);
  const citiAvotiSectionIndex =
    typeof b.citiAvotiSectionIndex === "number" && Number.isInteger(b.citiAvotiSectionIndex) ?
      Math.max(0, b.citiAvotiSectionIndex)
    : undefined;
  const existingDraftPlain =
    str(b.existingDraftPlain).trim() ||
    adminRichHtmlToPlainText(
      sourceBlockCommentsPlainForGemini(blockKeyRaw, sourceBlocks, citiAvotiSectionIndex),
    ).trim();

  try {
    const text = await generateSourceCommentWithGemini({
      sessionId,
      blockKey: blockKeyRaw,
      citiAvotiSectionIndex,
      vin: str(b.vin).trim() || null,
      listingUrl: str(b.listingUrl).trim() || null,
      customerName: str(b.customerName).trim() || null,
      notes: str(b.notes).trim() || null,
      sourceBlocks,
      internalComment: str(b.internalComment),
      mileageComment: str(b.mileageComment),
      operatorNotes: str(b.operatorNotes),
      existingDraftPlain,
    });
    return NextResponse.json({ text });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    if (msg === "empty_source_data") {
      return NextResponse.json({ error: "empty_source_data" }, { status: 400 });
    }
    console.error("[gemini/source-comment]", blockKeyRaw, msg);
    return NextResponse.json({ error: "generation_failed", detail: msg }, { status: 502 });
  }
}
