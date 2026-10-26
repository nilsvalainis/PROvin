import { notFound, redirect } from "next/navigation";
import "@/components/iriss-piedavajumi/piedavajumi.css";
import { IrissPasutijumsEditor } from "@/components/admin/IrissPasutijumsEditor";
import { PdOrderStrip } from "@/components/admin/iriss-piedavajumi/PdOrderStrip";
import { listIrissPdRowsForOrder } from "@/lib/iriss-piedavajumi-store";
import {
  getIrissListingsStorageState,
  readIrissListingsDismissed,
} from "@/lib/iriss-listings-aggregate-store";
import { readIrissListingsLatestViewWithMarketplace } from "@/lib/marketplace/view";
import { emptyIrissListingsDismissed, listingIsDismissed } from "@/lib/iriss-listings-dismiss";
import { orderRoomMatchProps, prepareIrissListingMatchWorkspace } from "@/lib/iriss-listing-match-store";
import { coerceIrissDuplicatesByListing, coerceIrissHitStatusMap } from "@/lib/iriss-order-room-match-props";
import { buildIrissOrderRoomHits } from "@/lib/iriss-order-room";
import { isEcarstradeNoPriceNoBid } from "@/lib/iriss-listing-order-gate";
import { irissOfferDeadlinesByOfferId } from "@/lib/iriss-offer-client-link";
import { readIrissOfferClientLinksForOrder } from "@/lib/iriss-offer-client-link-store";
import { isIrissPasutijumiStoreEnabled, isSafeIrissPasutijumsId, readIrissListingOrderOv, readIrissPasutijums } from "@/lib/iriss-pasutijumi-store";
import { stripIrissOfferImageDataUrls } from "@/lib/iriss-pasutijums-offer-images";
import { requireIrissSectionPage } from "@/lib/staff-auth";
import { parseOfferSourceRef } from "@/lib/iriss-stock-photos";
import { readGoogleContactsConfig } from "@/lib/google-contacts";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function IrissPasutijumsDetailPage({
  params,
  searchParams,
}: Props & { searchParams?: Promise<{ newOffer?: string; noClientPdf?: string; offer?: string; room?: string; from?: string }> }) {
  const actor = await requireIrissSectionPage("pasutijumi");
  if (!isIrissPasutijumiStoreEnabled()) {
    redirect("/admin/iriss/pasutijumi");
  }
  const { id } = await params;
  if (!isSafeIrissPasutijumsId(id)) {
    notFound();
  }
  const rec = await readIrissPasutijums(id);
  if (!rec) {
    notFound();
  }
  const sp = (await searchParams) ?? {};
  const autoOpenNewOffer = sp.newOffer === "1";
  const forceNoClientPdf = sp.noClientPdf === "1";
  const autoOpenOfferId = typeof sp.offer === "string" ? sp.offer.trim() : "";
  const initialRoomTab = sp.room === "search" ? "search" : "overview";
  // Tikai jau saglabātais Meklētāja kešs. Sync, VIN OCR un citi maksas avoti šeit netiek saukti.
  // latest, dismissed un match darbavieta ir 45 s atmiņas kešs (IRISS_LISTINGS_READ_CACHE_TTL_MS).
  // Šis lasījums neraksta latest.json: ne pilnā atvēršanā, ne prefetch.
  const storage = getIrissListingsStorageState();
  const [latest, dismissedView, orderOv, offerLinks, pdRows] = await Promise.all([
    storage.enabled ? readIrissListingsLatestViewWithMarketplace() : Promise.resolve(null),
    storage.enabled ? readIrissListingsDismissed() : Promise.resolve(emptyIrissListingsDismissed()),
    readIrissListingOrderOv().catch(() => ({})),
    readIrissOfferClientLinksForOrder(id, { deadlines: irissOfferDeadlinesByOfferId(rec.offers) }).catch(() => []),
    // j70: šī klienta piedāvājumi no sadaļas «Piedāvājumi» (tikai adminam).
    actor.kind === "admin" ? listIrissPdRowsForOrder(id).catch(() => []) : Promise.resolve([]),
  ]);
  const listable = (latest?.vehicles ?? []).filter((v) => !isEcarstradeNoPriceNoBid(v));
  const match = storage.enabled
    ? await prepareIrissListingMatchWorkspace(listable, []).catch(() => null)
    : null;
  const roomMatch = match ? orderRoomMatchProps(match.state, id, match.duplicatesByListing) : null;
  const roomHits = buildIrissOrderRoomHits(listable, id, orderOv, roomMatch ? new Set(roomMatch.extraListingIds) : undefined, rec.brandModel ?? "");
  const dismissedHitIds = roomHits.filter((hit) => listingIsDismissed(hit, dismissedView.entries)).map((hit) => hit.id);
  return (
    <>
      {pdRows.length ? <PdOrderStrip rows={pdRows} nowMs={Date.now()} /> : null}
      <IrissPasutijumsEditor
        initialRecord={stripIrissOfferImageDataUrls(rec)}
        autoOpenNewOffer={autoOpenNewOffer}
        autoOpenOfferId={autoOpenOfferId}
        forceNoClientPdf={forceNoClientPdf}
        seedFrom={parseOfferSourceRef(sp.from) ? sp.from : ""}
        roomHits={roomHits}
        dismissedHitIds={dismissedHitIds}
        listingsCache={storage.enabled ? "on" : "off"}
        initialOfferLinks={offerLinks}
        initialHitStatus={coerceIrissHitStatusMap(roomMatch?.hitStatus)}
        duplicatesByListing={coerceIrissDuplicatesByListing(roomMatch?.duplicates)}
        initialRoomTab={initialRoomTab}
        googleContactsConfigured={Boolean(readGoogleContactsConfig())}
      />
    </>
  );
}
