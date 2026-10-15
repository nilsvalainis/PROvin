import { notFound, redirect } from "next/navigation";
import { IrissPasutijumsEditor } from "@/components/admin/IrissPasutijumsEditor";
import {
  getIrissListingsStorageState,
  readIrissListingsDismissed,
  readIrissListingsLatestView,
} from "@/lib/iriss-listings-aggregate-store";
import { emptyIrissListingsDismissed, listingIsDismissed } from "@/lib/iriss-listings-dismiss";
import { orderRoomMatchProps, prepareIrissListingMatchWorkspace } from "@/lib/iriss-listing-match-store";
import { coerceIrissDuplicatesByListing, coerceIrissHitStatusMap } from "@/lib/iriss-order-room-match-props";
import { buildIrissOrderRoomHits } from "@/lib/iriss-order-room";
import { readIrissOfferClientLinksForOrder } from "@/lib/iriss-offer-client-link-store";
import { isIrissPasutijumiStoreEnabled, isSafeIrissPasutijumsId, readIrissListingOrderOv, readIrissPasutijums } from "@/lib/iriss-pasutijumi-store";
import { stripIrissOfferImageDataUrls } from "@/lib/iriss-pasutijums-offer-images";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function IrissPasutijumsDetailPage({
  params,
  searchParams,
}: Props & { searchParams?: Promise<{ newOffer?: string; noClientPdf?: string; room?: string }> }) {
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
  const initialRoomTab = sp.room === "search" ? "search" : "overview";
  // Tikai jau saglabātais Meklētāja kešs. Sync, VIN OCR un citi maksas avoti šeit netiek saukti.
  const storage = getIrissListingsStorageState();
  const [latest, dismissedView, orderOv, offerLinks] = await Promise.all([
    storage.enabled ? readIrissListingsLatestView() : Promise.resolve(null),
    storage.enabled ? readIrissListingsDismissed() : Promise.resolve(emptyIrissListingsDismissed()),
    readIrissListingOrderOv().catch(() => ({})),
    readIrissOfferClientLinksForOrder(id).catch(() => []),
  ]);
  const match = storage.enabled
    ? await prepareIrissListingMatchWorkspace(latest?.vehicles ?? [], []).catch(() => null)
    : null;
  const roomMatch = match ? orderRoomMatchProps(match.state, id, match.duplicatesByListing) : null;
  const roomHits = buildIrissOrderRoomHits(latest?.vehicles ?? [], id, orderOv, roomMatch ? new Set(roomMatch.extraListingIds) : undefined);
  const dismissedHitIds = roomHits.filter((hit) => listingIsDismissed(hit, dismissedView.entries)).map((hit) => hit.id);
  return (
    <IrissPasutijumsEditor
      initialRecord={stripIrissOfferImageDataUrls(rec)}
      autoOpenNewOffer={autoOpenNewOffer}
      forceNoClientPdf={forceNoClientPdf}
      roomHits={roomHits}
      dismissedHitIds={dismissedHitIds}
      listingsCache={storage.enabled ? "on" : "off"}
      initialOfferLinks={offerLinks}
      initialHitStatus={coerceIrissHitStatusMap(roomMatch?.hitStatus)}
      duplicatesByListing={coerceIrissDuplicatesByListing(roomMatch?.duplicates)}
      initialRoomTab={initialRoomTab}
    />
  );
}
