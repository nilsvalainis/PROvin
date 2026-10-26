import "@/components/iriss-piedavajumi/piedavajumi.css";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { PdApproveForm } from "@/components/iriss-piedavajumi/PdApproveForm";
import { PdClientView } from "@/components/iriss-piedavajumi/PdClientView";
import { getClientIpFromHeaders } from "@/lib/client-ip";
import { IRISS_OFFER_PUBLIC_BRAND } from "@/lib/iriss-offer-client-link";
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

function Unavailable({ text }: { text: string }) {
  return (
    <div className="pdc pdc-page">
      <div className="pdc-brand">{IRISS_OFFER_PUBLIC_BRAND}</div>
      <div className="pd-card">{text}</div>
    </div>
  );
}

/** j70: klienta piedāvājums (Piedāvājumi sadaļa). Avots, izsoles saite un iepirkuma cena netiek rādīti. */
export default async function IrissPiedavajumsPublicPage({ params }: { params: Promise<{ token: string }> }) {
  const { token: raw } = await params;
  const token = raw?.trim() ?? "";
  const rl = await checkRateLimit(`iriss-pd-get:${getClientIpFromHeaders(await headers())}`, 40, 10 * 60 * 1000);
  if (!rl.ok || !isSafeIrissPdToken(token)) return <Unavailable text="Piedāvājums nav pieejams." />;
  const found = await readIrissPdByToken(token);
  const nowMs = Date.now();
  const rec = found ? await readIrissPdFresh(found.id, nowMs) : null;
  if (!rec) return <Unavailable text="Piedāvājums nav pieejams." />;
  const view = buildIrissPdPublicView(rec, "link", nowMs);
  if (view.state === "closed") {
    return <Unavailable text={rec.status === "expired" ? "Piedāvājuma termiņš ir beidzies." : "Piedāvājums nav pieejams."} />;
  }
  const base = `/p/d/${token}/foto`;
  return (
    <div className="pdc pdc-page">
      <div className="pdc-brand">{IRISS_OFFER_PUBLIC_BRAND}</div>
      <div className="pd-card">
        <PdClientView view={view} mode="link" photoSrc={(n, s) => `${base}/${n}${s === "full" ? "?s=full" : ""}`}>
          {view.state === "approved" ? (
            <div className="pdc-done">Piedāvājums apstiprināts. Paldies!</div>
          ) : (
            <PdApproveForm token={token} needsContact={view.needsContact} />
          )}
        </PdClientView>
      </div>
    </div>
  );
}
