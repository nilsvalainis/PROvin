import { NextResponse } from "next/server";
import { isSafeIrissOfferAttachmentId, isSafeIrissOfferLinkToken } from "@/lib/iriss-offer-client-link";
import { readIrissOfferPublicPhoto } from "@/lib/iriss-offer-client-link-load";
import { checkRateLimit } from "@/lib/rate-limit-memory";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip")?.trim() || "unknown";
}

export async function GET(req: Request, ctx: { params: Promise<{ token: string; attachmentId: string }> }) {
  const ipRl = checkRateLimit(`iriss-offer-photo:${clientIp(req)}`, 180, 10 * 60 * 1000);
  if (!ipRl.ok) {
    return new NextResponse(null, { status: 404, headers: { "X-Robots-Tag": "noindex, nofollow", "Cache-Control": "private, no-store" } });
  }
  const { token: rawToken, attachmentId: rawId } = await ctx.params;
  const token = rawToken?.trim() ?? "";
  const attachmentId = rawId?.trim() ?? "";
  if (!isSafeIrissOfferLinkToken(token) || !isSafeIrissOfferAttachmentId(attachmentId)) {
    return new NextResponse(null, { status: 404, headers: { "X-Robots-Tag": "noindex, nofollow", "Cache-Control": "private, no-store" } });
  }
  const photo = await readIrissOfferPublicPhoto(token, attachmentId);
  if (!photo) {
    return new NextResponse(null, { status: 404, headers: { "X-Robots-Tag": "noindex, nofollow", "Cache-Control": "private, no-store" } });
  }
  return new NextResponse(new Uint8Array(photo.bytes), {
    status: 200,
    headers: {
      "Content-Type": photo.mimeType,
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex, nofollow",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "Content-Disposition": "inline",
    },
  });
}
