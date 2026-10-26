import { NextResponse } from "next/server";
import { isSafeIrissOfferAttachmentId, isSafeIrissOfferLinkToken } from "@/lib/iriss-offer-client-link";
import { readIrissOfferPublicPhoto, type IrissOfferPublicPhotoVariant } from "@/lib/iriss-offer-client-link-load";
import { pickIrissOfferImageFormat } from "@/lib/iriss-offer-image-thumb";
import { IRISS_OFFER_PUBLIC_PHOTO_CACHE_CONTROL, pickIrissOfferDisplayWidth } from "@/lib/iriss-offer-public-photo";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIpFromRequest } from "@/lib/client-ip";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

function clientIp(req: Request): string {
  return getClientIpFromRequest(req);
}

function notFound() {
  return new NextResponse(null, { status: 404, headers: { "X-Robots-Tag": "noindex, nofollow", "Cache-Control": "private, no-store" } });
}

export async function GET(req: Request, ctx: { params: Promise<{ token: string; attachmentId: string }> }) {
  const ipRl = await checkRateLimit(`iriss-offer-photo:${clientIp(req)}`, 180, 10 * 60 * 1000);
  if (!ipRl.ok) return notFound();
  const { token: rawToken, attachmentId: rawId } = await ctx.params;
  const token = rawToken?.trim() ?? "";
  const attachmentId = rawId?.trim() ?? "";
  if (!isSafeIrissOfferLinkToken(token) || !isSafeIrissOfferAttachmentId(attachmentId)) return notFound();

  const url = new URL(req.url);
  const v = url.searchParams.get("v");
  const variant: IrissOfferPublicPhotoVariant =
    v === "thumb"
      ? { kind: "thumb" }
      : v === "display"
        ? {
            kind: "display",
            width: pickIrissOfferDisplayWidth(url.searchParams.get("w")),
            format: pickIrissOfferImageFormat(req.headers.get("accept")),
          }
        : { kind: "full" };

  const photo = await readIrissOfferPublicPhoto(token, attachmentId, variant);
  if (!photo) return notFound();
  return new NextResponse(new Uint8Array(photo.bytes), {
    status: 200,
    headers: {
      "Content-Type": photo.mimeType,
      /** URL jau satur nepaminamu tokenu. `public` ļauj Vercel CDN kešot pēc pirmā Sharp/lasīšanas,
       * citādi katrs viesis gaida on-the-fly kodēšanu (live /p/ "migla" 26.10). */
      "Cache-Control": IRISS_OFFER_PUBLIC_PHOTO_CACHE_CONTROL,
      Vary: "Accept",
      "X-Robots-Tag": "noindex, nofollow",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "Content-Disposition": "inline",
    },
  });
}
