import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { readMessageTemplatesDoc } from "@/lib/messages/message-templates-store";
import { listMessageTemplates, MESSAGE_TEMPLATE_DEFS } from "@/lib/messages/registry";
import { isTemplateOverridden } from "@/lib/messages/resolve-message";
import type { MessageChannel } from "@/lib/messages/types";

export async function GET(req: Request) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const url = new URL(req.url);
  const channel = url.searchParams.get("channel") as MessageChannel | null;
  const doc = await readMessageTemplatesDoc();
  const templates = listMessageTemplates(channel ?? undefined).map((def) => ({
    ...def,
    overridden: isTemplateOverridden(def.id, doc),
    override: doc.overrides[def.id] ?? null,
  }));
  return NextResponse.json({
    templates,
    counts: {
      email: listMessageTemplates("email").length,
      whatsapp: listMessageTemplates("whatsapp").length,
      iriss: listMessageTemplates("iriss").length,
      block: listMessageTemplates("block").length,
      total: MESSAGE_TEMPLATE_DEFS.length,
    },
  });
}
