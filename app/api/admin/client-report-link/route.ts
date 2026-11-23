import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { isSafeOrderDraftSessionId } from "@/lib/admin-order-draft-store";
import {
  activeClientReportLink,
  clientReportLinkAbsoluteUrl,
  clientReportLinkTtlDays,
  resolveClientReportLinkLocale,
} from "@/lib/client-report-link";
import {
  createClientReportLink,
  readClientReportLinkDoc,
  readClientReportPdfInfo,
  revokeClientReportLinks,
} from "@/lib/client-report-link-store";
import { getPublicSiteOrigin } from "@/lib/site-url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "private, no-store" };

/**
 * Admin: klienta atskaites saite pasūtījumam.
 * GET ?sessionId= - statuss (vai ir nosūtīts PDF, aktīvās saites termiņš). Pašu saiti neatgriež
 * (glabājas tikai hešs), to parāda tikai izveides brīdī.
 * POST { sessionId, action: "create" | "revoke", locale? } - izveido jaunu (vecā tiek atsaukta) vai atsauc.
 */
async function status(sessionId: string) {
  const [doc, pdf] = await Promise.all([readClientReportLinkDoc(sessionId), readClientReportPdfInfo(sessionId)]);
  const active = activeClientReportLink(doc);
  return {
    pdf: { available: pdf.available, version: pdf.version, sentAt: pdf.sentAt },
    active: active ? { createdAt: active.createdAt, expiresAt: active.expiresAt, locale: active.locale } : null,
    ttlDays: clientReportLinkTtlDays(),
    defaultLocale: pdf.lang,
  };
}

export async function GET(req: Request) {
  if (!(await getAdminSession())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sessionId = new URL(req.url).searchParams.get("sessionId")?.trim() ?? "";
  if (!isSafeOrderDraftSessionId(sessionId)) return NextResponse.json({ error: "invalid_session" }, { status: 400 });
  return NextResponse.json({ ok: true, ...(await status(sessionId)) }, { headers: NO_STORE });
}

export async function POST(req: Request) {
  if (!(await getAdminSession())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const sessionId = String(body.sessionId ?? "").trim();
  if (!isSafeOrderDraftSessionId(sessionId)) return NextResponse.json({ error: "invalid_session" }, { status: 400 });
  const action = String(body.action ?? "").trim();

  if (action === "revoke") {
    const r = await revokeClientReportLinks(sessionId);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: 503 });
    return NextResponse.json({ ok: true, ...(await status(sessionId)) }, { headers: NO_STORE });
  }

  if (action === "create") {
    const pdf = await readClientReportPdfInfo(sessionId);
    if (!pdf.available) {
      return NextResponse.json(
        { error: "no_pdf", message: "PDF vēl nav nosūtīts klientam - saiti var izveidot pēc nosūtīšanas." },
        { status: 409 },
      );
    }
    const locale = resolveClientReportLinkLocale(typeof body.locale === "string" ? body.locale : pdf.lang);
    const created = await createClientReportLink(sessionId, { locale, pdfVersion: pdf.version });
    if (!created.ok) return NextResponse.json({ error: created.error }, { status: 503 });
    return NextResponse.json(
      {
        ok: true,
        url: clientReportLinkAbsoluteUrl(getPublicSiteOrigin(), locale, created.token),
        ...(await status(sessionId)),
      },
      { headers: NO_STORE },
    );
  }

  return NextResponse.json({ error: "invalid_action" }, { status: 400 });
}
