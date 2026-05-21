import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { patchConsultationDraft, readConsultationDraft } from "@/lib/admin-consultation-draft-store";
import {
  buildArtisMilicinsRecoveryOrderEdits,
  buildArtisMilicinsRecoveryWorkspace,
  RECOVERY_ARTIS_EMAIL,
} from "@/lib/consultation-recovery-artis-milicins";

export const maxDuration = 60;
export const runtime = "nodejs";

const TEMPLATES = {
  "artis-milicins-2026-05-21": true,
} as const;

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
  const sessionId = typeof b.sessionId === "string" ? b.sessionId.trim() : "";
  const template = typeof b.template === "string" ? b.template.trim() : "";
  if (!sessionId) {
    return NextResponse.json({ error: "missing_sessionId" }, { status: 400 });
  }
  if (!template || !(template in TEMPLATES)) {
    return NextResponse.json({ error: "invalid_template" }, { status: 400 });
  }

  if (template === "artis-milicins-2026-05-21") {
    const prev = await readConsultationDraft(sessionId);
    const result = await patchConsultationDraft(sessionId, {
      orderEdits: buildArtisMilicinsRecoveryOrderEdits(),
      workspace: buildArtisMilicinsRecoveryWorkspace(),
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.error === "store_disabled" ? 503 : 500 });
    }
    return NextResponse.json({
      ok: true,
      updatedAt: result.updatedAt,
      template,
      hadPrevious: Boolean(prev?.workspace),
      matchEmail: RECOVERY_ARTIS_EMAIL,
    });
  }

  return NextResponse.json({ error: "not_implemented" }, { status: 400 });
}
