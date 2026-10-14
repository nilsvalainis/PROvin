import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { readMessageTemplatesDoc, writeMessageTemplatesDoc } from "@/lib/messages/message-templates-store";
import { getMessageTemplateDef } from "@/lib/messages/registry";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, ctx: Ctx) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  if (!getMessageTemplateDef(id)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const doc = await readMessageTemplatesDoc();
  delete doc.overrides[id];
  await writeMessageTemplatesDoc(doc);
  return NextResponse.json({ ok: true });
}
