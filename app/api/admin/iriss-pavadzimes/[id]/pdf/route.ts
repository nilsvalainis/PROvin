import { NextResponse } from "next/server";
import { contentDispositionHeader } from "@/lib/content-disposition";
import { isWaybillOnlyActor, requireIrissSectionApi } from "@/lib/staff-auth";
import { loadIrissPavadzimesActiveCardData } from "@/lib/iriss-pavadzimes-list";
import { isSafeIrissPavadzimeId } from "@/lib/iriss-pavadzimes-parse";
import { readIrissPavadzimePdf } from "@/lib/iriss-pavadzimes-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type RouteContext = { params: Promise<{ id: string }> };

function pdfHeaders(fileName: string, bytes: Uint8Array) {
  return {
    "Content-Type": "application/pdf",
    "Content-Length": String(bytes.byteLength),
    "Cache-Control": "private, no-store",
    // «Škoda» u.c. latviešu burti galvenē krita ar ByteString kļūdu (Nils 28.10).
    "Content-Disposition": contentDispositionHeader(fileName, "inline", "pavadzime.pdf"),
  };
}

export async function GET(_req: Request, ctx: RouteContext) {
  const gate = await requireIrissSectionApi("pavadzimes");
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;
  if (!isSafeIrissPavadzimeId(id)) return NextResponse.json({ error: "invalid_id" }, { status: 400 });

  try {
    // Partneris ("tikai Pavadzīmes") arhīvu neredz: PDF tikai tām, kas viņam rādītas aktīvajās kartītēs.
    // ID ir secīgs numurs (p02790) - bez šīs pārbaudes visu arhīvu varēja izlasīt pēc kārtas (nakts tests 07.11).
    if (isWaybillOnlyActor(gate.actor)) {
      const { rows } = await loadIrissPavadzimesActiveCardData(new Date(), { withOrders: false });
      if (!rows.some((row) => row.id === id)) return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
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
