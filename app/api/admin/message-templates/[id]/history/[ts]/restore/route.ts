import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import {
  appendMessageTemplateHistory,
  readMessageTemplateHistoryEntry,
  readMessageTemplatesDoc,
  writeMessageTemplatesDoc,
} from "@/lib/messages/message-templates-store";
import { getMessageTemplateDef } from "@/lib/messages/registry";
import { snapshotOverrideFromDraft, validateMessageOverride } from "@/lib/messages/resolve-message";

type Ctx = { params: Promise<{ id: string; ts: string }> };

function adminActor(): string {
  return process.env.ADMIN_USERNAME?.trim() || "admin";
}

export async function POST(_req: Request, ctx: Ctx) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id, ts: tsRaw } = await ctx.params;
  if (!getMessageTemplateDef(id)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const ts = Number.parseInt(tsRaw, 10);
  const historical = await readMessageTemplateHistoryEntry(id, ts);
  if (!historical) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const validation = validateMessageOverride(id, { subject: historical.subject, body: historical.body });
  if (!validation.ok) {
    return NextResponse.json({ error: "validation", details: validation.errors }, { status: 400 });
  }

  const doc = await readMessageTemplatesDoc();
  const prev = doc.overrides[id];
  if (prev) await appendMessageTemplateHistory(id, prev);
  doc.overrides[id] = snapshotOverrideFromDraft(
    { subject: historical.subject, body: historical.body },
    adminActor(),
  );
  await writeMessageTemplatesDoc(doc);
  return NextResponse.json({ ok: true, override: doc.overrides[id] });
}
