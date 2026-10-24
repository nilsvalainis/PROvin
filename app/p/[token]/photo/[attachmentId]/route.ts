import { NextResponse } from "next/server";
import { isSafeIrissOfferAttachmentId, isSafeIrissOfferLinkToken } from "@/lib/iriss-offer-client-link";
import { readIrissOfferPublicPhoto, type IrissOfferPublicPhotoVariant } from "@/lib/iriss-offer-client-link-load";
import { pickIrissOfferDisplayWidth, pickIrissOfferImageFormat } from "@/lib/iriss-offer-image-thumb";
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
      /** Tikai privāts pārlūka kešs (ne CDN/starpniekserveris) - URL jau satur nepaminamu tokenu,
       * tāpēc bilžu bitiem kešošana ļauj ātri atkārtoti rādīt bez jauna pieprasījuma (j49). */
      "Cache-Control": "private, max-age=86400, immutable",
      Vary: "Accept",
      "X-Robots-Tag": "noindex, nofollow",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "Content-Disposition": "inline",
    },
  });
}
