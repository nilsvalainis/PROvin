import "server-only";

/**
 * Piedāvājuma avots (Autoparks / Loģistika) -> auto Dropbox /STOCK mape -> bildes.
 * Tikai lasīšana: Dropbox mapē nekas netiek mainīts vai dzēsts.
 * Bildi var nolasīt tikai, ja tās id ir šī auto mapē (svešus Dropbox failus nevar).
 */

import { getDropboxClient, type DropboxClient } from "@/lib/dropbox-client";
import type { AutoparksCar } from "@/lib/iriss-autoparks";
import { isStockPhoto } from "@/lib/iriss-autoparks-dropbox-sync";
import { resolveAutoparksCarFolder } from "@/lib/iriss-autoparks-files";
import { readAutoparksState } from "@/lib/iriss-autoparks-store";
import { getLogisticsOrder } from "@/lib/iriss-logistics-store";
import { offerSeedFromAutoparks, offerSeedFromLogistics, offerSeedTaggedKeys, type OfferSeedFields } from "@/lib/iriss-offer-seed";
import type { IrissOfferAttachment } from "@/lib/iriss-pasutijumi-types";
import {
  offerSourceRefString,
  orderStockPhotos,
  stockPhotoAttachment,
  type OfferSourceRef,
  type StockPhoto,
} from "@/lib/iriss-stock-photos";

const LIST_TTL_MS = 10 * 60 * 1000;
const THUMB_TTL_MS = 60 * 60 * 1000;
const THUMB_CACHE_MAX = 800;

type Listing = { at: number; photos: StockPhoto[]; folderId: string };
const listings = new Map<string, Listing>();
const thumbs = new Map<string, { at: number; bytes: Buffer }>();

export type OfferSourceCar = {
  car: AutoparksCar | null;
  /** Autoparka v2 galvenā bilde (vāks), ja ir. */
  mainPhotoId: string;
};

async function autoparksMainPhotoId(carId: string): Promise<string> {
  try {
    const { readAutoparksV2Car } = await import("@/lib/iriss-autoparks-v2-store");
    return (await readAutoparksV2Car(carId))?.v2.mainPhoto?.dropboxId ?? "";
  } catch {
    return "";
  }
}

async function findFolder(
  client: DropboxClient,
  ref: OfferSourceRef,
): Promise<{ id: string; path: string; mainPhotoId: string } | null> {
  const state = await readAutoparksState();
  if (ref.kind === "autoparks") {
    const car = state.cars.find((c) => c.id === ref.id);
    if (!car) return null;
    const folder = await resolveAutoparksCarFolder(client, car, { create: false }).catch(() => null);
    return folder ? { ...folder, mainPhotoId: await autoparksMainPhotoId(car.id) } : null;
  }
  const order = await getLogisticsOrder(ref.id);
  if (!order) return null;
  const linked = state.cars.find((c) => c.orderId === order.id);
  if (linked) {
    const folder = await resolveAutoparksCarFolder(client, linked, { create: false }).catch(() => null);
    if (folder) return { ...folder, mainPhotoId: await autoparksMainPhotoId(linked.id) };
  }
  // Nav Autoparkā: meklē /STOCK mapi pēc VIN (abās saknēs). Nav mapes - forma bez bildēm (Nila atbilde 3).
  if (!order.vin.trim()) return null;
  for (const owner of ["IRISS", "DZA"] as const) {
    const folder = await resolveAutoparksCarFolder(
      client,
      { make: order.make, model: order.model, year: "", color: "", vin: order.vin, orderId: order.id, dropboxFolderId: "", owner },
      { create: false },
    ).catch(() => null);
    if (folder) return { ...folder, mainPhotoId: "" };
  }
  return null;
}

/** Bilžu saraksts (pirmās 60, secība kā PRO). Kešs 10 min vienā servera instancē. */
export async function listOfferSourcePhotos(ref: OfferSourceRef, opts: { fresh?: boolean } = {}): Promise<StockPhoto[]> {
  const key = offerSourceRefString(ref);
  const hit = listings.get(key);
  if (hit && !opts.fresh && Date.now() - hit.at < LIST_TTL_MS) return hit.photos;
  const client = getDropboxClient();
  if (!client) return [];
  const folder = await findFolder(client, ref);
  if (!folder) {
    listings.set(key, { at: Date.now(), photos: [], folderId: "" });
    return [];
  }
  const { entries } = await client.listAll(folder.path, { recursive: false });
  const photos = orderStockPhotos(
    entries.filter((e) => e.tag === "file" && isStockPhoto(e.name)),
    { mainPhotoId: folder.mainPhotoId },
  );
  listings.set(key, { at: Date.now(), photos, folderId: folder.id });
  return photos;
}

function rememberThumb(id: string, bytes: Buffer): void {
  thumbs.set(id, { at: Date.now(), bytes });
  while (thumbs.size > THUMB_CACHE_MAX) {
    const oldest = thumbs.keys().next().value;
    if (oldest === undefined) break;
    thumbs.delete(oldest);
  }
}

/**
 * Bilde formai. thumb: sīktēls (25 vienā Dropbox pieprasījumā, kešs 1 h); full: 2048 px JPEG.
 * null - id nav šī auto mapē vai Dropbox nav pieejams.
 */
export async function readOfferSourcePhoto(
  ref: OfferSourceRef,
  dropboxId: string,
  size: "thumb" | "full",
): Promise<Buffer | null> {
  const photos = await listOfferSourcePhotos(ref);
  const index = photos.findIndex((p) => p.dropboxId === dropboxId);
  if (index < 0) return null;
  const client = getDropboxClient();
  if (!client) return null;
  if (size === "full") return client.getThumbnail(dropboxId, "w2048h1536").catch(() => null);
  const cached = thumbs.get(dropboxId);
  if (cached && Date.now() - cached.at < THUMB_TTL_MS) return cached.bytes;
  const batch = [dropboxId];
  for (const p of photos.slice(index + 1)) {
    if (batch.length >= 25) break;
    const c = thumbs.get(p.dropboxId);
    if (!c || Date.now() - c.at >= THUMB_TTL_MS) batch.push(p.dropboxId);
  }
  const got = await client.getThumbnailBatch(batch, "w256h256").catch(() => new Map<string, Buffer>());
  for (const [id, bytes] of got) rememberThumb(id, bytes);
  return got.get(dropboxId) ?? null;
}

/**
 * Saglabājot: 2048 px JPEG katrai bildei, kas ir avota mapē (6 paralēli).
 * Neizdevušās paliek ar dropboxId - nākamā saglabāšana mēģina vēlreiz.
 */
export async function fetchOfferSourcePhotosForSave(
  ref: OfferSourceRef,
  dropboxIds: readonly string[],
): Promise<Map<string, Buffer>> {
  const out = new Map<string, Buffer>();
  const client = getDropboxClient();
  if (!client || dropboxIds.length === 0) return out;
  const allowed = new Set((await listOfferSourcePhotos(ref).catch(() => [])).map((p) => p.dropboxId));
  const queue = dropboxIds.filter((id) => allowed.has(id));
  let next = 0;
  const worker = async () => {
    while (next < queue.length) {
      const id = queue[next++]!;
      const bytes = await client.getThumbnail(id, "w2048h1536").catch(() => null);
      if (bytes && bytes.length > 0) out.set(id, bytes);
    }
  };
  await Promise.all(Array.from({ length: Math.min(6, queue.length) }, worker));
  return out;
}

export type OfferSeed = {
  sourceRef: string;
  fields: OfferSeedFields;
  autoFields: string[];
  attachments: IrissOfferAttachment[];
  /** Dropbox nav pieejams / mapes nav - forma atveras bez bildēm. */
  photosNote: string;
};

/** Sākuma dati formai. null - auto nav atrasts. */
export async function loadOfferSeed(ref: OfferSourceRef): Promise<OfferSeed | null> {
  let fields: OfferSeedFields;
  if (ref.kind === "autoparks") {
    const { readAutoparksV2Car } = await import("@/lib/iriss-autoparks-v2-store");
    const both = await readAutoparksV2Car(ref.id).catch(() => null);
    const car = both?.car ?? (await readAutoparksState()).cars.find((c) => c.id === ref.id);
    if (!car) return null;
    const v2 = both?.v2;
    fields = offerSeedFromAutoparks(car, {
      tech: v2?.tech ?? null,
      location: v2?.fields?.location ?? "",
      displayName: v2?.priceSheet?.displayName ?? "",
      equipmentLine: v2?.priceSheet?.equipmentLine ?? "",
    });
  } else {
    const order = await getLogisticsOrder(ref.id);
    if (!order) return null;
    fields = offerSeedFromLogistics(order);
  }
  let photos: StockPhoto[] = [];
  let photosNote = "";
  try {
    if (!getDropboxClient()) throw new Error("dropbox_not_configured");
    photos = await listOfferSourcePhotos(ref, { fresh: true });
    if (photos.length === 0) photosNote = "Auto /STOCK mapē bilžu nav - pievieno ar roku.";
  } catch {
    photosNote = "Dropbox nav pieejams - bildes pievieno ar roku.";
  }
  return {
    sourceRef: offerSourceRefString(ref),
    fields,
    autoFields: offerSeedTaggedKeys(fields),
    attachments: photos.map((p) => stockPhotoAttachment(ref, p)),
    photosNote,
  };
}

/** Testiem. */
export function resetOfferSourceCachesForTest(): void {
  listings.clear();
  thumbs.clear();
}
