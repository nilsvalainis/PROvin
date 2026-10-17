/**
 * Admin: audit knowledge pipeline — v1 backfill/promote/approve + TRAINING_V2 zināšanu panelis.
 *
 * POST { action: "status" }
 * POST { action: "backfill", limit?: number }
 * POST { action: "promote", writeFile?: boolean }
 * POST { action: "approve", key: string }   (v1 agregātu mācība)
 * POST { action: "approve", id: string }    (TRAINING_V2 zināšanu vienība)
 */
import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import {
  backfillAuditAggregateLearnings,
  promoteAuditKnowledgeCandidates,
} from "@/lib/admin-ai-aggregate-knowledge";
import { approveAuditAggregateLearning, summarizeAuditLearnings } from "@/lib/admin-audit-learnings-store";
import { isTrainingV2Enabled } from "@/lib/feature-flags-v2";
import { conflictWarningFor } from "@/lib/admin-audit-knowledge-items-logic";
import {
  editKnowledgeItem,
  getKnowledgeUsage,
  listKnowledgeItemsFromStore,
  readKnowledgeItemsDoc,
  reviewKnowledgeItem,
  summarizeKnowledgeStore,
} from "@/lib/admin-audit-knowledge-items-store";
import { recordAiDraftRevision, getAiFieldRevisions } from "@/lib/admin-ai-field-revisions-store";
import { parseAiDraftMeta } from "@/lib/admin-ai-draft-fields";
import { PROVIN_AI_PROMPT_VERSION } from "@/lib/ai-prompt-version";

export const maxDuration = 120;
export const runtime = "nodejs";
export const preferredRegion = "fra1";

function reviewerName(): string {
  return process.env.ADMIN_USERNAME?.trim() || "admin";
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

export async function POST(req: Request) {
  const ok = await getAdminSession();
  if (!ok) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
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
  const action = b.action;
  const trainingV2 = isTrainingV2Enabled();

  if (action === "status") {
    const summary = await summarizeAuditLearnings();
    const v2 = trainingV2 ? await summarizeKnowledgeStore() : null;
    return NextResponse.json({ ok: true, trainingV2, ...summary, knowledge: v2 });
  }

  if (action === "backfill") {
    const limitRaw = b.limit;
    const limit =
      typeof limitRaw === "number" && Number.isFinite(limitRaw) ? Math.floor(limitRaw) : undefined;
    const result = await backfillAuditAggregateLearnings({ limit });
    const summary = await summarizeAuditLearnings();
    const v2 = trainingV2 ? await summarizeKnowledgeStore() : null;
    return NextResponse.json({ ok: true, trainingV2, ...result, summary, knowledge: v2 });
  }

  if (action === "approve" && typeof b.key === "string" && !str(b.id)) {
    const key = b.key;
    const entry = await approveAuditAggregateLearning(key);
    if (!entry) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    const summary = await summarizeAuditLearnings();
    return NextResponse.json({ ok: true, key: entry.key, status: entry.status, summary });
  }

  if (action === "promote") {
    const writeFile = b.writeFile !== false;
    const result = await promoteAuditKnowledgeCandidates({ writeFile });
    return NextResponse.json({
      ok: true,
      trainingV2,
      candidateCount: result.candidateCount,
      markdownChars: result.markdownChars,
      outputPath: result.outputPath,
      markdown: result.markdown,
    });
  }

  if (action === "recordDraft") {
    const sessionId = str(b.sessionId);
    const field = str(b.field);
    if (!sessionId || !field) {
      return NextResponse.json({ error: "missing_session_or_field" }, { status: 400 });
    }
    if (!trainingV2) return NextResponse.json({ ok: true, skipped: true });
    const draft = parseAiDraftMeta({
      model: str(b.model) || "unknown",
      promptVersion: str(b.promptVersion) || PROVIN_AI_PROMPT_VERSION,
      text: typeof b.text === "string" ? b.text : "",
      ts: new Date().toISOString(),
    });
    if (!draft) return NextResponse.json({ error: "empty_draft" }, { status: 400 });
    const saved = await recordAiDraftRevision({ sessionId, field, draft });
    return NextResponse.json({ ok: true, aiDrafts: saved.aiDrafts });
  }

  if (action === "revisions") {
    const sessionId = str(b.sessionId);
    if (!sessionId) return NextResponse.json({ error: "missing_session_id" }, { status: 400 });
    const rev = await getAiFieldRevisions(sessionId);
    return NextResponse.json({ ok: true, trainingV2, revisions: rev });
  }

  if (action === "used") {
    const sessionId = str(b.sessionId);
    if (!sessionId) return NextResponse.json({ error: "missing_session_id" }, { status: 400 });
    const used = await getKnowledgeUsage(sessionId);
    const rev = await getAiFieldRevisions(sessionId);
    return NextResponse.json({ ok: true, trainingV2, used, revisions: rev });
  }

  if (!trainingV2) {
    return NextResponse.json(
      { error: "unknown_action", hint: "status | backfill | promote", trainingV2: false },
      { status: 400 },
    );
  }

  if (action === "list") {
    const status = str(b.status) || "all";
    const aggregate = str(b.aggregate) || undefined;
    const doc = await readKnowledgeItemsDoc();
    const items = await listKnowledgeItemsFromStore(
      status === "all" || status === "candidate" || status === "approved" || status === "rejected" || status === "deleted"
        ? status
        : "all",
      aggregate,
    );
    return NextResponse.json({
      ok: true,
      trainingV2: true,
      items: items.map((item) => ({
        ...item,
        conflict: item.status === "candidate" ? conflictWarningFor(doc, item) : null,
      })),
      aggregates: (await summarizeKnowledgeStore()).aggregates,
    });
  }

  if (action === "approve" || action === "reject" || action === "delete" || action === "restore") {
    const id = str(b.id);
    if (!id) return NextResponse.json({ error: "missing_id" }, { status: 400 });
    const item = await reviewKnowledgeItem(id, action, {
      by: reviewerName(),
      reason: str(b.reason) || undefined,
      claim: str(b.claim) || undefined,
    });
    if (!item) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json({ ok: true, item });
  }

  if (action === "edit") {
    const id = str(b.id);
    const claim = str(b.claim);
    if (!id || !claim) return NextResponse.json({ error: "missing_id_or_claim" }, { status: 400 });
    const item = await editKnowledgeItem(id, claim, { by: reviewerName() });
    if (!item) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json({ ok: true, item });
  }

  return NextResponse.json(
    {
      error: "unknown_action",
      hint: "status | backfill | promote | list | approve | reject | delete | restore | edit | recordDraft | used | revisions",
    },
    { status: 400 },
  );
}
