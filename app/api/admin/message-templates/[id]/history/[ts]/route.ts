import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { readMessageTemplateHistoryEntry } from "@/lib/messages/message-templates-store";
import { getMessageTemplateDef } from "@/lib/messages/registry";

type Ctx = { params: Promise<{ id: string; ts: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id, ts: tsRaw } = await ctx.params;
  if (!getMessageTemplateDef(id)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const ts = Number.parseInt(tsRaw, 10);
  const entry = await readMessageTemplateHistoryEntry(id, ts);
  if (!entry) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ entry });
}
