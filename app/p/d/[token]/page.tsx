import type { Metadata } from "next";
import { headers } from "next/headers";
import { IrissOfferPublicUnavailable } from "@/components/iriss-offer-public/IrissOfferPublicUnavailable";
import { PdClientActions } from "@/components/iriss-piedavajumi/PdClientActions";
import { PdClientView } from "@/components/iriss-piedavajumi/PdClientView";
import { getClientIpFromHeaders } from "@/lib/client-ip";
import { IRISS_OFFER_PUBLIC_BRAND, IRISS_OFFER_PUBLIC_LABELS } from "@/lib/iriss-offer-client-link";
import { buildIrissPdPublicView } from "@/lib/iriss-piedavajumi";
import { isSafeIrissPdToken } from "@/lib/iriss-piedavajumi-types";
import { IRISS_PUBLIC_DZA_CONTACT_LINES, IRISS_PUBLIC_PD_NOT_CURRENT_TITLE, IRISS_PUBLIC_SOLD_BODY } from "@/lib/iriss-public-availability";
import { irissPdPublicNotCurrentFor } from "@/lib/iriss-public-availability";
import { readIrissPdByToken, readIrissPdFresh, recordIrissPdFirstView } from "@/lib/iriss-piedavajumi-store";
import { checkRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: IRISS_OFFER_PUBLIC_BRAND,
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false, noimageindex: true } },
  referrer: "no-referrer",
};

/** j70: klienta piedāvājums. Tā pati `/p/` bāze; Auto1 tikai kā dati. */
export default async function IrissPiedavajumsPublicPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { token: raw } = await params;
  const adminPreview = (await searchParams)?.admins === "1";
  const token = raw?.trim() ?? "";
  const rl = await checkRateLimit(`iriss-pd-get:${getClientIpFromHeaders(await headers())}`, 40, 10 * 60 * 1000);
  if (!rl.ok || !isSafeIrissPdToken(token)) return <IrissOfferPublicUnavailable />;
  const found = await readIrissPdByToken(token);
  const nowMs = Date.now();
  const rec = found ? await readIrissPdFresh(found.id, nowMs) : null;
  if (!rec) return <IrissOfferPublicUnavailable />;
  // Nils 20.11: atcelts vai auto pārdots citam - neitrāli, bez statusiem un detaļām.
  if (await irissPdPublicNotCurrentFor(rec)) {
    return (
      <IrissOfferPublicUnavailable
        title={IRISS_PUBLIC_PD_NOT_CURRENT_TITLE}
        body={`${IRISS_PUBLIC_SOLD_BODY} ${IRISS_PUBLIC_DZA_CONTACT_LINES.slice(0, 2).join(", ")}.`}
      />
    );
  }
  const view = buildIrissPdPublicView(rec, "link", nowMs);
  if (view.state === "closed") {
    return rec.status === "expired" ? (
      <IrissOfferPublicUnavailable title={IRISS_OFFER_PUBLIC_LABELS.expired} />
    ) : (
      <IrissOfferPublicUnavailable />
    );
  }
  // Komunikācijas laika joslai: pirmā klienta atvēršana (admina «Klienta skats» ar ?admins=1 neskaitās).
  if (!adminPreview && (view.state === "open" || view.state === "approved")) await recordIrissPdFirstView(rec.id, new Date(nowMs).toISOString()).catch(() => undefined);
  const base = `/p/d/${token}/foto`;
  return (
    <PdClientView view={view} mode="link" token={token} photoSrc={(n, s) => `${base}/${n}${s === "full" ? "?s=full" : ""}`}>
      <PdClientActions
        token={token}
        needsContact={view.needsContact}
        initialState={view.state}
        initialQuestions={view.questions}
        vehicle={view.title}
        price={view.price}
      />
    </PdClientView>
  );
}
