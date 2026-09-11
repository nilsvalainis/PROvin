/**
 * Admin: audit knowledge pipeline — backfill + promote + status (bez dārgā LLM).
 *
 * POST { action: "status" }
 * POST { action: "backfill", limit?: number }
 * POST { action: "promote", writeFile?: boolean }
 */
import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import {
  backfillAuditAggregateLearnings,
  promoteAuditKnowledgeCandidates,
} from "@/lib/admin-ai-aggregate-knowledge";
import { summarizeAuditLearnings } from "@/lib/admin-audit-learnings-store";

export const maxDuration = 120;
export const runtime = "nodejs";
export const preferredRegion = "fra1";

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

  const action = (body as { action?: unknown }).action;

  if (action === "status") {
    const summary = await summarizeAuditLearnings();
    return NextResponse.json({ ok: true, ...summary });
  }

  if (action === "backfill") {
    const limitRaw = (body as { limit?: unknown }).limit;
    const limit =
      typeof limitRaw === "number" && Number.isFinite(limitRaw) ? Math.floor(limitRaw) : undefined;
    const result = await backfillAuditAggregateLearnings({ limit });
    const summary = await summarizeAuditLearnings();
    return NextResponse.json({ ok: true, ...result, summary });
  }

  if (action === "promote") {
    const writeFile = (body as { writeFile?: unknown }).writeFile !== false;
    const result = await promoteAuditKnowledgeCandidates({ writeFile });
    return NextResponse.json({
      ok: true,
      candidateCount: result.candidateCount,
      markdownChars: result.markdownChars,
      outputPath: result.outputPath,
      /** Kompakts MD — Claude lasa tikai šo, nevis pasūtījumus. */
      markdown: result.markdown,
    });
  }

  return NextResponse.json(
    { error: "unknown_action", hint: "status | backfill | promote" },
    { status: 400 },
  );
}
