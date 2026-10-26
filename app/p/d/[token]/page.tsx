import type { Metadata } from "next";
import { headers } from "next/headers";
import { IrissOfferPublicUnavailable } from "@/components/iriss-offer-public/IrissOfferPublicUnavailable";
import { PdApproveForm } from "@/components/iriss-piedavajumi/PdApproveForm";
import { PdClientView } from "@/components/iriss-piedavajumi/PdClientView";
import { getClientIpFromHeaders } from "@/lib/client-ip";
import { IRISS_OFFER_PUBLIC_BRAND, IRISS_OFFER_PUBLIC_LABELS } from "@/lib/iriss-offer-client-link";
import { buildIrissPdPublicView } from "@/lib/iriss-piedavajumi";
import { readIrissPdByToken, readIrissPdFresh } from "@/lib/iriss-piedavajumi-store";
import { isSafeIrissPdToken } from "@/lib/iriss-piedavajumi-types";
import { checkRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: IRISS_OFFER_PUBLIC_BRAND,
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false, noimageindex: true } },
  referrer: "no-referrer",
};

/** j70: klienta piedāvājums. Tā pati `/p/` bāze; Auto1 tikai kā dati. */
export default async function IrissPiedavajumsPublicPage({ params }: { params: Promise<{ token: string }> }) {
  const { token: raw } = await params;
  const token = raw?.trim() ?? "";
  const rl = await checkRateLimit(`iriss-pd-get:${getClientIpFromHeaders(await headers())}`, 40, 10 * 60 * 1000);
  if (!rl.ok || !isSafeIrissPdToken(token)) return <IrissOfferPublicUnavailable />;
  const found = await readIrissPdByToken(token);
  const nowMs = Date.now();
  const rec = found ? await readIrissPdFresh(found.id, nowMs) : null;
  if (!rec) return <IrissOfferPublicUnavailable />;
  const view = buildIrissPdPublicView(rec, "link", nowMs);
  if (view.state === "closed") {
    return rec.status === "expired" ? (
      <IrissOfferPublicUnavailable title={IRISS_OFFER_PUBLIC_LABELS.expired} />
    ) : (
      <IrissOfferPublicUnavailable />
    );
  }
  const base = `/p/d/${token}/foto`;
  return (
    <PdClientView view={view} mode="link" token={token} photoSrc={(n, s) => `${base}/${n}${s === "full" ? "?s=full" : ""}`}>
      {view.state === "approved" ? null : <PdApproveForm token={token} needsContact={view.needsContact} />}
    </PdClientView>
  );
}
