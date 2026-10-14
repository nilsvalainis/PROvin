import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import {
  appendMessageTemplateHistory,
  readMessageTemplatesDoc,
  writeMessageTemplatesDoc,
} from "@/lib/messages/message-templates-store";
import { getMessageTemplateDef } from "@/lib/messages/registry";
import {
  snapshotOverrideFromDraft,
  validateMessageOverride,
} from "@/lib/messages/resolve-message";

type Ctx = { params: Promise<{ id: string }> };

function adminActor(): string {
  return process.env.ADMIN_USERNAME?.trim() || "admin";
}

export async function PUT(req: Request, ctx: Ctx) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const def = getMessageTemplateDef(id);
  if (!def) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const body = (await req.json().catch(() => null)) as { subject?: string; body?: string } | null;
  if (!body || typeof body.body !== "string") {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const validation = validateMessageOverride(id, { subject: body.subject, body: body.body });
  if (!validation.ok) {
    return NextResponse.json({ error: "validation", details: validation.errors }, { status: 400 });
  }

  const doc = await readMessageTemplatesDoc();
  const snapshot = snapshotOverrideFromDraft({ subject: body.subject, body: body.body }, adminActor());
  const prev = doc.overrides[id];
  if (prev) await appendMessageTemplateHistory(id, prev);
  doc.overrides[id] = snapshot;
  await writeMessageTemplatesDoc(doc);
  return NextResponse.json({ ok: true, override: snapshot });
}
