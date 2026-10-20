import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { adminHtmlDocumentHeaders } from "@/lib/csp";
import { warmMessageTemplatesCache } from "@/lib/messages/message-runtime";
import { buildIrissPasutijumsPrintHtml } from "@/lib/iriss-pasutijums-pdf-html";
import { buildIrissPasutijumsPdfBytes } from "@/lib/iriss-pasutijums-pdf";
import { generatedDocumentResponseHeader } from "@/lib/iriss-generated-documents";
import { irissPasutijumsPdfContentDisposition, irissPasutijumsPdfFilename } from "@/lib/iriss-pasutijumi-list-overview";
import {
  hydrateIrissPasutijumsImages,
  isSafeIrissPasutijumsId,
  readIrissPasutijums,
  storeIrissGeneratedPdf,
} from "@/lib/iriss-pasutijumi-store";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const ok = await getAdminSession();
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  if (!isSafeIrissPasutijumsId(id)) return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  const stored = await readIrissPasutijums(id);
  if (!stored) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const rec = await hydrateIrissPasutijumsImages(stored);
  const dateFmt = new Intl.DateTimeFormat("lv-LV", { dateStyle: "long" });
  const generated = dateFmt.format(new Date());
  const url = new URL(req.url);
  const pdfCache =
    "no-store, no-cache, must-revalidate, max-age=0, private" satisfies string;
  if (url.searchParams.get("format") === "html") {
    const templatesDoc = await warmMessageTemplatesCache();
    const html = buildIrissPasutijumsPrintHtml(rec, generated, templatesDoc);
    return new NextResponse(html, {
      status: 200,
      headers: adminHtmlDocumentHeaders({
        "Cache-Control": pdfCache,
        "X-Robots-Tag": "noindex, nofollow",
      }),
    });
  }
  const bytes = await buildIrissPasutijumsPdfBytes(rec);
  const inline =
    url.searchParams.get("inline") === "1" ||
    url.searchParams.get("disposition") === "inline" ||
    url.searchParams.get("view") === "1";
  const disposition = irissPasutijumsPdfContentDisposition(rec, inline);
  let storedHeader: Record<string, string> = {};
  try {
    const stored = await storeIrissGeneratedPdf({
      orderId: rec.id,
      kind: "contract",
      name: irissPasutijumsPdfFilename(rec),
      bytes,
    });
    if (stored) storedHeader = generatedDocumentResponseHeader(stored.document, stored.workspaceRevision);
  } catch (e) {
    console.error("[iriss print store]", e instanceof Error ? e.message : e);
  }
  return new NextResponse(Buffer.from(bytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": disposition,
      "Cache-Control": pdfCache,
      Pragma: "no-cache",
      "X-Robots-Tag": "noindex, nofollow",
      ...storedHeader,
    },
  });
}
