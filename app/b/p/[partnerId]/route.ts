import { NextResponse } from "next/server";
import { isSafeB2bPartnerId } from "@/lib/b2b-partner-account";
import { getB2bPartnerById } from "@/lib/b2b-partner-store";
import { businessLinkPublicPath } from "@/lib/business-link";
import { storeBusinessLinkRecord } from "@/lib/business-link-store";
import { fetchPartnerListingHtml } from "@/lib/business-partner-listing-fetch";
import {
  BUSINESS_LINK_CLOSED_PATH,
  checkPartnerClick,
  listingHtmlHasVin,
  newPartnerBusinessLinkRecord,
  parsePartnerClickParams,
} from "@/lib/business-partner-link";
import { getClientIpFromRequest } from "@/lib/client-ip";
import { hashClientLinkToken, newClientLinkToken } from "@/lib/client-link-crypto";
import { checkRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ partnerId: string }> };

const NO_STORE = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow", "Referrer-Policy": "no-referrer" };

function closed(req: Request): NextResponse {
  return NextResponse.redirect(new URL(BUSINESS_LINK_CLOSED_PATH, req.url), { status: 303, headers: NO_STORE });
}

/**
 * Partnera PROVIN Business poga. Derīgs klikšķis -> jauna vienreizēja `/b/{token}` saite.
 * Jebkas cits -> slēgtā lapa (bez paskaidrojuma, kāpēc).
 */
export async function GET(req: Request, ctx: Ctx) {
  const ip = getClientIpFromRequest(req);
  if (!(await checkRateLimit(`business-partner-click:${ip}`, 30, 10 * 60 * 1000)).ok) return closed(req);

  const { partnerId } = await ctx.params;
  if (!isSafeB2bPartnerId(partnerId)) return closed(req);
  const partner = await getB2bPartnerById(partnerId);
  const params = parsePartnerClickParams(new URL(req.url).searchParams);

  const check = checkPartnerClick({ partner, referer: req.headers.get("referer"), params });
  if (!check.ok || !partner) return closed(req);

  if (!(await checkRateLimit(`business-partner-vin:${partnerId}:${params.vin}`, 20, 60 * 60 * 1000)).ok) {
    return closed(req);
  }

  /** VIN jābūt sludinājuma lapā. Ja lapu nevar nolasīt (tīkls), saite tiek izveidota, bet atzīmēta. */
  const listing = await fetchPartnerListingHtml(params.listingUrl, partner.businessEmbed.domains);
  if (listing.ok && !listingHtmlHasVin(listing.html, params.vin)) return closed(req);
  if (!listing.ok && listing.error === "host") return closed(req);
  if (!listing.ok) {
    console.warn("[business-partner-link] sludinājumu neizdevās nolasīt", { partnerId, error: listing.error });
  }

  const token = newClientLinkToken();
  const record = newPartnerBusinessLinkRecord({
    tokenHash: hashClientLinkToken(token),
    partnerId,
    params,
    listingVerified: listing.ok,
  });
  const stored = await storeBusinessLinkRecord(record);
  if (!stored.ok) return closed(req);

  return NextResponse.redirect(new URL(businessLinkPublicPath(token), req.url), { status: 303, headers: NO_STORE });
}
