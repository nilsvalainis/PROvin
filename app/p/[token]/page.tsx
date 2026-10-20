import type { Metadata } from "next";
import { headers } from "next/headers";
import { IrissOfferPublicUnavailable } from "@/components/iriss-offer-public/IrissOfferPublicUnavailable";
import { IrissOfferPublicView } from "@/components/iriss-offer-public/IrissOfferPublicView";
import { isSafeIrissOfferLinkToken } from "@/lib/iriss-offer-client-link";
import { hashIrissOfferLinkToken } from "@/lib/iriss-offer-client-link-token";
import { loadIrissOfferPublicView } from "@/lib/iriss-offer-client-link-load";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIpFromHeaders } from "@/lib/client-ip";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Dzintarzeme Auto",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false, noimageindex: true } },
  referrer: "no-referrer",
};

function clientIp(headerList: Headers): string {
  return getClientIpFromHeaders(headerList);
}

export default async function IrissOfferPublicPage({ params }: { params: Promise<{ token: string }> }) {
  const { token: raw } = await params;
  const token = raw?.trim() ?? "";
  const headerList = await headers();
  const ipRl = await checkRateLimit(`iriss-offer-get:${clientIp(headerList)}`, 40, 10 * 60 * 1000);
  if (!ipRl.ok || !isSafeIrissOfferLinkToken(token)) return <IrissOfferPublicUnavailable />;
  const tokenRl = await checkRateLimit(`iriss-offer-token:${hashIrissOfferLinkToken(token).slice(0, 16)}`, 40, 10 * 60 * 1000);
  if (!tokenRl.ok) return <IrissOfferPublicUnavailable />;
  const view = await loadIrissOfferPublicView(token);
  if (!view) return <IrissOfferPublicUnavailable />;
  return <IrissOfferPublicView token={token} view={view} />;
}
