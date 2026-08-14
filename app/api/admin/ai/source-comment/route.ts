/**
 * Admin: AI — avota bloka „Komentāri” ģenerēšana (tikai DEMO pasūtījumi).
 */
import { NextResponse } from "next/server";

import { getAdminSession } from "@/lib/admin-auth";
import { assertAiAllowedForSession } from "@/lib/admin-ai-demo-guard";
import { hasAnyAdminAiProviderKey } from "@/lib/admin-ai-dispatch";
import {
  generateSourceCommentWithAi,
  isAiSourceCommentBlockKey,
} from "@/lib/admin-ai-source-comment";
import { mergeSourceBlocksFromBody } from "@/lib/admin-ai-api-body";
import { parseAiModelTier } from "@/lib/ai-admin-model-tier";
import {
  isAiSourceCommentTargetField,
  sourceBlockCommentsPlainForAi,
} from "@/lib/admin-source-comment-blocks";
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
  targetField?: unknown;
  modelTier?: unknown;
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
  const blockKeyRaw = str(b.blockKey).trim();
  if (!isAiSourceCommentBlockKey(blockKeyRaw)) {
    return NextResponse.json({ error: "invalid_block_key" }, { status: 400 });
  }

  const guard = await assertAiAllowedForSession(sessionId);
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
  const targetFieldRaw = str(b.targetField).trim();
  const targetField = isAiSourceCommentTargetField(targetFieldRaw) ? targetFieldRaw : "comments";
  if (targetField === "serviceHistoryNotes" && blockKeyRaw !== "auto_records") {
    return NextResponse.json({ error: "invalid_target_field" }, { status: 400 });
  }
  const existingDraftPlain =
    str(b.existingDraftPlain).trim() ||
    adminRichHtmlToPlainText(
      sourceBlockCommentsPlainForAi(blockKeyRaw, sourceBlocks, citiAvotiSectionIndex, targetField),
    ).trim();

  try {
    const text = await generateSourceCommentWithAi({
      sessionId,
      blockKey: blockKeyRaw,
      citiAvotiSectionIndex,
      targetField,
      vin: str(b.vin).trim() || null,
      listingUrl: str(b.listingUrl).trim() || null,
      customerName: str(b.customerName).trim() || null,
      notes: str(b.notes).trim() || null,
      sourceBlocks,
      internalComment: str(b.internalComment),
      mileageComment: str(b.mileageComment),
      operatorNotes: str(b.operatorNotes),
      existingDraftPlain,
      modelTier: parseAiModelTier(b.modelTier),
    });
    return NextResponse.json({ text });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    if (msg === "empty_source_data") {
      return NextResponse.json({ error: "empty_source_data" }, { status: 400 });
    }
    console.error("[ai/source-comment]", blockKeyRaw, targetField, msg);
    return NextResponse.json({ error: "generation_failed", detail: msg }, { status: 502 });
  }
}
