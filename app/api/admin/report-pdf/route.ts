import { NextResponse } from "next/server";
import { del, get, put } from "@vercel/blob";
import { getAdminSession } from "@/lib/admin-auth";
import { isReportPdfPathname, reportPdfPathPrefix, safeReportPdfFilename } from "@/lib/report-pdf-constants";
import { renderReportHtmlToPdf } from "@/lib/report-pdf-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * Servera PDF izmēģinājums ("Sūtīt atskaiti" 1. posms, Nils 17.11).
 * POST: HTML (jau augšupielādēts privātā Blob) -> Chromium -> PDF privātā Blob. Neko nesūta, pasūtījumu nemaina.
 * GET: straumē gatavo PDF lejupielādei (Vercel atbildes limits ~4.5 MB neattiecas uz straumi).
 */
export async function POST(request: Request) {
  if (!(await getAdminSession())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { sessionId?: unknown; htmlPathname?: unknown; filename?: unknown } | null;
  const sessionId = typeof body?.sessionId === "string" ? body.sessionId.trim() : "";
  const htmlPathname = typeof body?.htmlPathname === "string" ? body.htmlPathname.trim() : "";
  if (!isReportPdfPathname(sessionId, htmlPathname, ".html")) {
    return NextResponse.json({ error: "invalid_path" }, { status: 400 });
  }
  const filename = safeReportPdfFilename(typeof body?.filename === "string" ? body.filename : "");

  let html = "";
  try {
    const res = await get(htmlPathname, { access: "private", useCache: false });
    if (!res || res.statusCode !== 200 || !res.stream) return NextResponse.json({ error: "html_not_found" }, { status: 404 });
    html = await new Response(res.stream).text();
  } catch (e) {
    return NextResponse.json({ error: "html_read_failed", message: e instanceof Error ? e.message : String(e) }, { status: 502 });
  } finally {
    await del(htmlPathname).catch(() => undefined);
  }

  try {
    const r = await renderReportHtmlToPdf(html);
    const pdfPathname = `${reportPdfPathPrefix(sessionId)}${Date.now()}-${filename}`;
    await put(pdfPathname, Buffer.from(r.pdf), {
      access: "private",
      addRandomSuffix: false,
      contentType: "application/pdf",
    });
    return NextResponse.json({ ok: true, pdfPathname, filename, bytes: r.pdf.byteLength, ms: r.ms, fontsReady: r.fontsReady });
  } catch (e) {
    console.error("[api/admin/report-pdf]", e);
    return NextResponse.json({ error: "render_failed", message: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

export async function GET(request: Request) {
  if (!(await getAdminSession())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const u = new URL(request.url);
  const sessionId = u.searchParams.get("sessionId")?.trim() ?? "";
  const pathname = u.searchParams.get("pathname")?.trim() ?? "";
  if (!isReportPdfPathname(sessionId, pathname, ".pdf")) return NextResponse.json({ error: "invalid_path" }, { status: 400 });
  const res = await get(pathname, { access: "private", useCache: false }).catch(() => null);
  if (!res || res.statusCode !== 200 || !res.stream) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const filename = pathname.slice(reportPdfPathPrefix(sessionId).length).replace(/^\d+-/, "");
  return new Response(res.stream, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
