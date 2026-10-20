import { NextResponse } from "next/server";
import { requireIrissSectionApi } from "@/lib/staff-auth";
import { isSafeIrissPavadzimeId } from "@/lib/iriss-pavadzimes-parse";
import { readIrissPavadzimePdf } from "@/lib/iriss-pavadzimes-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type RouteContext = { params: Promise<{ id: string }> };

function pdfHeaders(fileName: string, bytes: Uint8Array) {
  const safeName = fileName.replace(/[^\w.\u0100-\u017F-]+/g, "_") || "pavadzime.pdf";
  return {
    "Content-Type": "application/pdf",
    "Content-Length": String(bytes.byteLength),
    "Cache-Control": "private, no-store",
    "Content-Disposition": `inline; filename="${safeName}"`,
  };
}

export async function GET(_req: Request, ctx: RouteContext) {
  const gate = await requireIrissSectionApi("pavadzimes");
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;
  if (!isSafeIrissPavadzimeId(id)) return NextResponse.json({ error: "invalid_id" }, { status: 400 });

  try {
    const pdf = await readIrissPavadzimePdf(id);
    if (!pdf) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return new NextResponse(new Uint8Array(pdf.bytes), {
      status: 200,
      headers: pdfHeaders(pdf.fileName, pdf.bytes),
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "pdf_failed" }, { status: 500 });
  }
}
