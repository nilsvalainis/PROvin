import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { warmMessageTemplatesCache } from "@/lib/messages/message-runtime";
import {
  isAllowedWhatsappPrefillTemplateId,
  renderWhatsappPrefillText,
  type WhatsappPrefillQuery,
} from "@/lib/messages/whatsapp-prefill-server";

export async function GET(req: Request) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const url = new URL(req.url);
  const templateId = url.searchParams.get("templateId")?.trim() ?? "";
  if (!templateId || !isAllowedWhatsappPrefillTemplateId(templateId)) {
    return NextResponse.json({ error: "invalid_template" }, { status: 400 });
  }
  const query: WhatsappPrefillQuery = {
    templateId,
    vin: url.searchParams.get("vin")?.trim() || undefined,
    summa: url.searchParams.get("summa")?.trim() || undefined,
  };
  const kind = url.searchParams.get("kind")?.trim();
  if (kind === "audits" || kind === "mini" || kind === "dealer") {
    query.kind = kind;
  }
  const doc = await warmMessageTemplatesCache();
  const text = renderWhatsappPrefillText(query, doc);
  if (!text) return NextResponse.json({ error: "render_failed" }, { status: 500 });
  return NextResponse.json({ templateId, text });
}
