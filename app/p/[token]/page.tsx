import type { Metadata } from "next";
import { headers } from "next/headers";
import { IrissOfferPublicUnavailable } from "@/components/iriss-offer-public/IrissOfferPublicUnavailable";
import { IrissOfferPublicView } from "@/components/iriss-offer-public/IrissOfferPublicView";
import { isSafeIrissOfferLinkToken } from "@/lib/iriss-offer-client-link";
import { hashIrissOfferLinkToken } from "@/lib/iriss-offer-client-link-token";
import { irissOfferLinkTokenNotCurrent, loadIrissOfferPublicView } from "@/lib/iriss-offer-client-link-load";
import { IRISS_PUBLIC_DZA_CONTACT_LINES, IRISS_PUBLIC_PD_NOT_CURRENT_TITLE, IRISS_PUBLIC_SOLD_BODY } from "@/lib/iriss-public-availability";
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
  // Nils 20.11: auto pārdots citam - neitrāli kā /p/d/, bez statusiem un detaļām.
  if (await irissOfferLinkTokenNotCurrent(token)) {
    return (
      <IrissOfferPublicUnavailable
        title={IRISS_PUBLIC_PD_NOT_CURRENT_TITLE}
        body={`${IRISS_PUBLIC_SOLD_BODY} ${IRISS_PUBLIC_DZA_CONTACT_LINES.slice(0, 2).join(", ")}.`}
      />
    );
  }
  const view = await loadIrissOfferPublicView(token);
  if (!view) return <IrissOfferPublicUnavailable />;
  return <IrissOfferPublicView token={token} view={view} />;
}
