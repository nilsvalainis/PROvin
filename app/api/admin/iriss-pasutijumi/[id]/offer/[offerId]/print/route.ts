import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { buildIrissOfferPrintHtml } from "@/lib/iriss-pasutijums-pdf-html";
import { buildIrissOfferPdfBytes } from "@/lib/iriss-pasutijums-pdf";
import { isSafeIrissPasutijumsId, readIrissPasutijums } from "@/lib/iriss-pasutijumi-store";

export const runtime = "nodejs";

export async function GET(req: Request, ctx: { params: Promise<{ id: string; offerId: string }> }) {
  const ok = await getAdminSession();
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id, offerId } = await ctx.params;
  if (!isSafeIrissPasutijumsId(id)) return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  const rec = await readIrissPasutijums(id);
  if (!rec) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const offer = rec.offers.find((o) => o.id === offerId);
  if (!offer) return NextResponse.json({ error: "offer_not_found" }, { status: 404 });
  const dateFmt = new Intl.DateTimeFormat("lv-LV", { dateStyle: "long" });
  const generated = dateFmt.format(new Date());
  const url = new URL(req.url);
  if (url.searchParams.get("format") === "html") {
    const html = buildIrissOfferPrintHtml(rec, offer, generated);
    return new NextResponse(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  }
  const embedImages = url.searchParams.get("images") !== "0";
  const bytes = await buildIrissOfferPdfBytes(rec, offer, { embedImages });
  return new NextResponse(Buffer.from(bytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="piedavajums.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}

