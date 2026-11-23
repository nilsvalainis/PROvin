import { NextResponse } from "next/server";
import { getClientIpFromHeaders } from "@/lib/client-ip";
import { AUCTION_ARCHIVE_HEADERS, isAuctionArchiveLinkActive } from "@/lib/auction-archive-offer";
import { findAuctionArchiveOfferByToken, readAuctionArchivePreview } from "@/lib/auction-archive-offer-store";
import { checkRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;

/**
 * E-pasta priekšskatījuma bilde (n = 0..1) - TIKAI jau serverī izplūdinātā kopija. Oriģinālās bildes
 * šeit nav pieejamas. E-pasta programmas bildes ielādē caur saviem starpniekiem, tāpēc limits ir plašs.
 */
export async function GET(req: Request, ctx: { params: Promise<{ token: string; n: string }> }) {
  const notFound = () => new NextResponse(null, { status: 404, headers: AUCTION_ARCHIVE_HEADERS });
  const ip = getClientIpFromHeaders(req.headers);
  const rl = await checkRateLimit(`auction-archive-preview:${ip}`, 120, 10 * 60 * 1000);
  if (!rl.ok) return new NextResponse(null, { status: 429, headers: AUCTION_ARCHIVE_HEADERS });
  const { token, n: rawN } = await ctx.params;
  const n = Number(rawN);
  if (!Number.isInteger(n) || n < 0 || n > 1) return notFound();
  try {
    const found = await findAuctionArchiveOfferByToken((token ?? "").trim());
    if (!found || !isAuctionArchiveLinkActive(found.doc) || n >= found.doc.previewIds.length) return notFound();
    const buf = await readAuctionArchivePreview(found.sessionId, n);
    if (!buf) return notFound();
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        ...AUCTION_ARCHIVE_HEADERS,
        "Content-Type": "image/jpeg",
        "Content-Length": String(buf.byteLength),
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return notFound();
  }
}
