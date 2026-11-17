import { NextResponse } from "next/server";
import { requireIrissSectionApi } from "@/lib/staff-auth";
import { isIrissOfferPublicImageMime, isSafeIrissOfferAttachmentId } from "@/lib/iriss-offer-client-link";
import { isSafeIrissPasutijumsId, readIrissOfferAttachmentBytes, readIrissPasutijums } from "@/lib/iriss-pasutijumi-store";

export const runtime = "nodejs";

/** Pilnā izmēra piedāvājuma bilde adminam (tālummaiņas skatam). Tikai Pasūtījumu tiesība. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string; offerId: string; attId: string }> }) {
  const gate = await requireIrissSectionApi("pasutijumi");
  if (!gate.ok) return gate.response;
  const { id, offerId, attId } = await ctx.params;
  if (!isSafeIrissPasutijumsId(id) || !isSafeIrissOfferAttachmentId(attId)) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }
  const rec = await readIrissPasutijums(id);
  const att = rec?.offers.find((o) => o.id === offerId)?.attachments.find((a) => a.id === attId);
  if (!att || !isIrissOfferPublicImageMime(att.mimeType)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const file = await readIrissOfferAttachmentBytes(att);
  if (!file) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return new NextResponse(new Uint8Array(file.bytes), {
    headers: {
      "Content-Type": file.mimeType.split(";")[0]?.trim() || "image/jpeg",
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
