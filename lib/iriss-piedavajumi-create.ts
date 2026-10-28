import "server-only";

/**
 * j70: jauna piedāvājuma sākuma dati no Autoparka auto vai izsoles saites.
 * Autoparks: tie paši lauki un /STOCK bildes kā pasūtījuma piedāvājuma formā + Autoparka cenas
 * (sadaļa ir tikai adminam, tāpēc summas drīkst rādīt). Saite: Auto1/Openlane caur releju, pārējie - stub.
 */

import { irissAuctionDetailToSeed, mergeListedIntoDetailHit, type IrissAuctionDetailExtras } from "@/lib/iriss-auction-detail";
import { fetchIrissAuctionDetailViaRelay } from "@/lib/iriss-auction-detail-relay";
import { findIrissOrderRoomHitForAuctionLink } from "@/lib/iriss-auction-link-read";
import type { IrissAuctionLink } from "@/lib/iriss-auction-link";
import { loadOfferSeed } from "@/lib/iriss-offer-source";
import type { IrissOrderRoomHit } from "@/lib/iriss-order-room";
import { irissPdAuto1BlocksFromDetail, irissPdAuto1FieldCount, type IrissPdAuto1Blocks } from "@/lib/iriss-piedavajumi-auto1";
import {
  type IrissPdImport,
  irissPdFilledCount,
  irissPdFillFromAutoparks,
  irissPdPhotosFromUrls,
  irissPdPurchaseFromHit,
  irissPdVehicleFromHit,
  irissPdVehicleFromSeed,
} from "@/lib/iriss-piedavajumi-import";
import { detectIrissPdLink, IRISS_PD_ADAPTERS, type IrissPdDetectedLink } from "@/lib/iriss-piedavajumi-sources";
import { emptyIrissPdVehicle, type IrissPdPhoto } from "@/lib/iriss-piedavajumi-types";

export type { IrissPdImport } from "@/lib/iriss-piedavajumi-import";

function eur(n: number | null | undefined): string {
  return n != null && Number.isFinite(n) && n > 0 ? String(Math.round(n)) : "";
}

/**
 * Autoparka vai Loģistikas auto -> importa dati (tie paši lauki un /STOCK bildes kā vecajā formā).
 * Cenas tikai Autoparkam (sadaļa ir tikai adminam, tāpēc summas drīkst rādīt).
 */
export async function importIrissPdFromStock(kind: "autoparks" | "logistics", carId: string): Promise<IrissPdImport | null> {
  const seed = await loadOfferSeed({ kind, id: carId }).catch(() => null);
  if (!seed) return null;
  let price = "";
  let purchase = "";
  let vehicle = irissPdVehicleFromSeed(seed.fields);
  if (kind === "autoparks") {
    try {
      const { readAutoparksV2Car } = await import("@/lib/iriss-autoparks-v2-store");
      const { autoparksV2Basics } = await import("@/lib/iriss-autoparks-v2");
      const both = await readAutoparksV2Car(carId);
      price = eur(both?.v2?.priceSheet?.salePriceEur) || eur(both?.car?.salePriceEur);
      purchase = eur(both?.car?.purchasePriceEur);
      if (both) {
        const b = autoparksV2Basics(both.car, both.v2);
        vehicle = irissPdFillFromAutoparks(vehicle, {
          year: b.year,
          firstRegDate: b.firstRegDate.value,
          mileageKm: b.mileageKm.value,
          fuel: both.car.registry?.fuel ?? "",
          gearbox: b.gearbox.value,
          powerKw: b.powerKw.value,
          displacementCm3: b.displacementCm3.value,
          color: b.color,
        });
      }
    } catch {
      /* cenas un papildu lauki nav obligāti */
    }
  } else {
    vehicle = irissPdFillFromAutoparks(vehicle, {});
  }
  const photos: IrissPdPhoto[] = seed.attachments
    .filter((a) => a.dropboxId)
    .map((a) => ({ kind: "dropbox", ref: seed.sourceRef, id: a.dropboxId! }));
  const fieldCount = irissPdFilledCount(vehicle) + (price ? 1 : 0);
  return {
    source: kind,
    sourceRef: seed.sourceRef,
    sourceUrl: "",
    sourceKey: "",
    vehicle,
    photos,
    price,
    purchasePrice: purchase,
    auto1: null,
    fieldCount,
    historyText: `Izveidots no ${kind === "autoparks" ? "Autoparka" : "Loģistikas"} · ${fieldCount} lauki, ${photos.length} foto`,
    note: seed.photosNote,
  };
}

export function importIrissPdFromAutoparks(carId: string): Promise<IrissPdImport | null> {
  return importIrissPdFromStock("autoparks", carId);
}

export type IrissPdLinkImportResult =
  | { ok: true; data: IrissPdImport }
  | { ok: false; error: string; note: string; link: IrissPdDetectedLink | null };

function relayLink(link: IrissPdDetectedLink): IrissAuctionLink | null {
  if (link.source === "auto1") return { platform: "auto1", key: link.key, url: link.url };
  if (link.source === "openlane") return { platform: "openline", key: link.key, url: link.url };
  return null;
}

function manualImport(link: IrissPdDetectedLink, note: string): IrissPdImport {
  const label = { auto1: "Auto1", openlane: "Openlane", autobid: "Autobid", mobilede: "mobile.de" }[link.source];
  return {
    source: link.source,
    sourceRef: "",
    sourceUrl: link.url,
    sourceKey: link.key,
    vehicle: emptyIrissPdVehicle(),
    photos: [],
    price: "",
    purchasePrice: "",
    auto1: null,
    fieldCount: 0,
    historyText: `Izveidots no ${label} saites (aizpilda ar roku)`,
    note,
  };
}

/**
 * Saite -> importa dati. `manual`: ja nolasīt neizdodas vai avots ir stub, izveido ar saiti un tukšiem laukiem.
 */
export async function importIrissPdFromLink(raw: string, opts: { manual?: boolean } = {}): Promise<IrissPdLinkImportResult> {
  const link = detectIrissPdLink(raw);
  if (!link) return { ok: false, error: "not_auction_link", note: "", link: null };
  const adapter = IRISS_PD_ADAPTERS[link.source];
  if (adapter.mode === "stub") return { ok: true, data: manualImport(link, adapter.stubNote) };
  if (opts.manual) return { ok: true, data: manualImport(link, "") };
  const rl = relayLink(link)!;
  const listed = await findIrissOrderRoomHitForAuctionLink(rl).catch(() => null);
  const relay = await fetchIrissAuctionDetailViaRelay(rl);
  let hit: IrissOrderRoomHit | null = listed;
  let extras: IrissAuctionDetailExtras | null = null;
  let auto1: IrissPdAuto1Blocks | null = null;
  if (relay.ok) {
    const seeded = irissAuctionDetailToSeed(relay.detail, rl);
    hit = listed ? mergeListedIntoDetailHit(seeded.hit, listed) : seeded.hit;
    extras = seeded.extras;
    if (link.source === "auto1") auto1 = irissPdAuto1BlocksFromDetail(relay.detail);
  } else if (!listed) {
    return { ok: false, error: relay.error, note: relay.note, link };
  }
  const vehicle = irissPdVehicleFromHit(hit!, extras);
  const photos = irissPdPhotosFromUrls([hit!.imageUrl, ...hit!.imageUrls].filter(Boolean));
  const label = link.source === "auto1" ? "Auto1" : "Openlane";
  const fieldCount = irissPdFilledCount(vehicle) + irissPdAuto1FieldCount(auto1);
  return {
    ok: true,
    data: {
      source: link.source,
      sourceRef: "",
      sourceUrl: link.url,
      sourceKey: link.key,
      vehicle,
      photos,
      price: "",
      purchasePrice: irissPdPurchaseFromHit(hit!),
      auto1,
      fieldCount,
      historyText: `Izveidots no ${label} saites · ${fieldCount} lauki`,
      note: relay.ok ? "" : `Detaļu lapa netika nolasīta (${relay.note}) - dati no IRISS sarakstiem.`,
    },
  };
}
