import { NextResponse } from "next/server";

import { getAdminSession } from "@/lib/admin-auth";
import { applyCopilotActions } from "@/lib/admin-copilot-apply";
import { isSafeOrderDraftSessionId } from "@/lib/admin-order-draft-store";
import { mergeSourceBlocksWithDefaults, type LtabBlockState } from "@/lib/admin-source-blocks";
import { applyLtabCommentTemplate, LTAB_COMMENT_NO_OCTA_CLAIM } from "@/lib/admin-ltab-comment-presets";
import { markLtabAutoApplied } from "@/lib/ltab-auto";
import { readLtabAutoStatus } from "@/lib/ltab-auto-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Admin: LTAB automātikas rezultāts -> LTAB bloks (tas pats `set_ltab_certificate` ceļš, ko manuālā PDF augšupielāde).
 * Atgriež tikai izmainīto bloku; saglabā klienta autosave (kā vendor-pdf).
 */
export async function POST(req: Request) {
  if (!(await getAdminSession())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const sessionId = typeof body.sessionId === "string" ? body.sessionId.trim() : "";
  if (!isSafeOrderDraftSessionId(sessionId)) return NextResponse.json({ error: "invalid_session" }, { status: 400 });
  const status = await readLtabAutoStatus(sessionId);
  if (!status || (status.state !== "claims" && status.state !== "no_claims")) {
    return NextResponse.json({ error: "no_result" }, { status: 409 });
  }
  const blocks = mergeSourceBlocksWithDefaults({ ltab: body.ltab as LtabBlockState });
  let ltab = blocks.ltab;
  if (status.state === "claims") {
    if (!status.certificate) return NextResponse.json({ error: "no_certificate" }, { status: 409 });
    const result = applyCopilotActions(
      blocks,
      [{ type: "set_ltab_certificate", source: "ltab", certificate: status.certificate, confidence: "high" }],
      { onlyAuto: false },
    );
    ltab = result.sourceBlocks.ltab;
  } else {
    ltab = { ...ltab, comments: applyLtabCommentTemplate(ltab.comments, LTAB_COMMENT_NO_OCTA_CLAIM) };
  }
  const next = await markLtabAutoApplied(sessionId);
  return NextResponse.json({ ok: true, ltab, status: next });
}
