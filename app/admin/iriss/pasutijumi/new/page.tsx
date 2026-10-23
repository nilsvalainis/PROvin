import { redirect } from "next/navigation";
import { IrissPasutijumsEditor } from "@/components/admin/IrissPasutijumsEditor";
import { isIrissPasutijumiStoreEnabled } from "@/lib/iriss-pasutijumi-store";
import { appendIrissStatusHistory } from "@/lib/iriss-pasutijumi-audit-fields";
import { emptyIrissPasutijums } from "@/lib/iriss-pasutijumi-types";
import { requireIrissSectionPage } from "@/lib/staff-auth";
import { IRISS_OFFER_CREATED_REASON } from "@/lib/iriss-offer-client-picker";
import { parseOfferSourceRef } from "@/lib/iriss-stock-photos";

export const dynamic = "force-dynamic";

export default async function IrissPasutijumsNewPage({
  searchParams,
}: {
  searchParams?: Promise<{ newOffer?: string; noClientPdf?: string; from?: string }>;
}) {
  const actor = await requireIrissSectionPage("pasutijumi");
  if (!isIrissPasutijumiStoreEnabled()) {
    redirect("/admin/iriss/pasutijumi");
  }
  const sp = (await searchParams) ?? {};
  const now = new Date().toISOString();
  const empty = emptyIrissPasutijums(crypto.randomUUID(), now);
  // "+ Piedāvājums" bez klienta: jauns NEAKTĪVS pasūtījums (Nila atbilde 10). Esošie pasūtījumi netiek mainīti.
  const rec =
    sp.newOffer === "1"
      ? appendIrissStatusHistory(empty, "inactive", {
          at: now,
          by: actor.kind === "admin" ? actor.name : actor.user.name || actor.user.email,
          reason: IRISS_OFFER_CREATED_REASON,
        })
      : empty;
  return (
    <IrissPasutijumsEditor
      initialRecord={rec}
      unsavedDraft
      autoOpenNewOffer={sp.newOffer === "1"}
      forceNoClientPdf={sp.noClientPdf === "1"}
      seedFrom={parseOfferSourceRef(sp.from) ? sp.from : ""}
    />
  );
}
