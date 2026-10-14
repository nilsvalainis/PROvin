import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { listMessageTemplateHistory } from "@/lib/messages/message-templates-store";
import { getMessageTemplateDef } from "@/lib/messages/registry";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  if (!getMessageTemplateDef(id)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const history = await listMessageTemplateHistory(id);
  return NextResponse.json({ history });
}
