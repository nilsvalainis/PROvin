import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { getMessageTemplateDef } from "@/lib/messages/registry";
import { previewMessage } from "@/lib/messages/resolve-message";
import { sendTemplateTestEmail } from "@/lib/messages/send-template-test-email";
import { isSmtpConfigured } from "@/lib/email/send-transactional";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const def = getMessageTemplateDef(id);
  if (!def || def.channel !== "email") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (!isSmtpConfigured()) {
    return NextResponse.json({ error: "smtp_not_configured" }, { status: 503 });
  }
  const body = (await req.json().catch(() => ({}))) as { subject?: string; text?: string };
  const rendered = previewMessage(id);
  const subject = `[Tests] ${(body.subject ?? rendered?.subject ?? def.subject ?? "PROVIN").slice(0, 170)}`;
  const text = body.text ?? rendered?.text ?? def.body;
  const html = rendered?.html ?? `<pre style="font-family:sans-serif;white-space:pre-wrap">${text}</pre>`;

  try {
    const to = await sendTemplateTestEmail({ subject, text, html });
    return NextResponse.json({ ok: true, to });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 503 });
  }
}
