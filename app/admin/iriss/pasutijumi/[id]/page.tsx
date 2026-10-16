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
import { isEcarstradeNoPriceNoBid } from "@/lib/iriss-listing-order-gate";
import { readIrissOfferClientLinksForOrder } from "@/lib/iriss-offer-client-link-store";
import { isIrissPasutijumiStoreEnabled, isSafeIrissPasutijumsId, readIrissListingOrderOv, readIrissPasutijums } from "@/lib/iriss-pasutijumi-store";
import { stripIrissOfferImageDataUrls } from "@/lib/iriss-pasutijums-offer-images";
import { requireAdminPage } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function IrissPasutijumsDetailPage({
  params,
  searchParams,
}: Props & { searchParams?: Promise<{ newOffer?: string; noClientPdf?: string; offer?: string; room?: string }> }) {
  await requireAdminPage();
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
  const [latest, dismissedView, orderOv, offerLinks] = await Promise.all([
    storage.enabled ? readIrissListingsLatestView() : Promise.resolve(null),
    storage.enabled ? readIrissListingsDismissed() : Promise.resolve(emptyIrissListingsDismissed()),
    readIrissListingOrderOv().catch(() => ({})),
    readIrissOfferClientLinksForOrder(id).catch(() => []),
  ]);
  const listable = (latest?.vehicles ?? []).filter((v) => !isEcarstradeNoPriceNoBid(v));
  const match = storage.enabled
    ? await prepareIrissListingMatchWorkspace(listable, []).catch(() => null)
    : null;
  const roomMatch = match ? orderRoomMatchProps(match.state, id, match.duplicatesByListing) : null;
  const roomHits = buildIrissOrderRoomHits(listable, id, orderOv, roomMatch ? new Set(roomMatch.extraListingIds) : undefined, rec.brandModel ?? "");
  const dismissedHitIds = roomHits.filter((hit) => listingIsDismissed(hit, dismissedView.entries)).map((hit) => hit.id);
  return (
    <IrissPasutijumsEditor
      initialRecord={stripIrissOfferImageDataUrls(rec)}
      autoOpenNewOffer={autoOpenNewOffer}
      autoOpenOfferId={autoOpenOfferId}
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
