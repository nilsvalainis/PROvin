import "server-only";

import { getDropboxClient } from "@/lib/dropbox-client";
import type { AutoparksCar } from "@/lib/iriss-autoparks";
import { isStockPhoto } from "@/lib/iriss-autoparks-dropbox-sync";
import { makeAutoparksThumbnail } from "@/lib/iriss-autoparks-files";
import { readAutoparksState } from "@/lib/iriss-autoparks-store";
import type { AutoparksCarV2 } from "@/lib/iriss-autoparks-v2";
import { pickStockMainPhoto } from "@/lib/iriss-autoparks-v2-photo-pick";
import { readAutoparksV2Car, updateCarV2, type AutoparksV2Actor } from "@/lib/iriss-autoparks-v2-store";
import { getLogisticsBinaryFile, putLogisticsBinaryFile } from "@/lib/iriss-logistics-store";

const RECHECK_MS = 24 * 60 * 60 * 1000;

export type StockPhotoCandidate = { id: string; name: string };

/** Auto /STOCK mapes pirmā līmeņa bildes (izsoles foto apakšmapēs un Loģistikā netiek ņemti). */
export async function autoparksV2StockPhotoCandidates(car: Pick<AutoparksCar, "dropboxFolderId">): Promise<StockPhotoCandidate[]> {
  const client = getDropboxClient();
  if (!client || !car.dropboxFolderId) return [];
  try {
    const folder = await client.getMetadata(car.dropboxFolderId);
    if (folder?.tag !== "folder") return [];
    const { entries } = await client.listAll(folder.pathDisplay, { recursive: false });
    return entries.filter((e) => e.tag === "file" && e.id && isStockPhoto(e.name)).map((e) => ({ id: e.id, name: e.name }));
  } catch (err) {
    console.warn("[autoparks v2 foto kandidāti]", err instanceof Error ? err.message : err);
    return [];
  }
}

/**
 * Galvenā bilde: TIKAI no auto /STOCK mapes pirmā līmeņa (izsoles foto apakšmapēs un Loģistikā netiek ņemti).
 * Izvēle pēc heuristikas (`pickStockMainPhoto`, J29 A - priekšas 3/4 leņķa ārskata foto, ja atšķirams pēc
 * nosaukuma; citādi pirmā pēc nosaukuma). Sīktēls Blob; skatās ne biežāk kā 1x dienā.
 */
export async function autoparksV2MainPhoto(car: AutoparksCar, v2: AutoparksCarV2): Promise<Buffer | null> {
  if (v2.mainPhoto?.thumbBlobPath) {
    const got = await getLogisticsBinaryFile(v2.mainPhoto.thumbBlobPath).catch(() => null);
    if (got) return got.bytes;
  }
  const checked = Date.parse(v2.photoCheckedAt);
  if (Number.isFinite(checked) && Date.now() - checked < RECHECK_MS) return null;
  const client = getDropboxClient();
  if (!client || !car.dropboxFolderId) return null;
  const picked = pickStockMainPhoto(await autoparksV2StockPhotoCandidates(car));
  let thumb: Buffer | null = null;
  if (picked) {
    try {
      thumb = await makeAutoparksThumbnail((await client.download(picked.id)).bytes, "image/jpeg");
    } catch (err) {
      console.warn("[autoparks v2 foto]", err instanceof Error ? err.message : err);
    }
  }
  let thumbBlobPath = "";
  if (thumb && picked) {
    thumbBlobPath = (await putLogisticsBinaryFile(`autoparks/${car.id}/v2-main.jpg`, thumb, "image/jpeg").catch(() => null))?.pathname ?? "";
  }
  await updateCarV2(
    car.id,
    (c) => {
      c.photoCheckedAt = new Date().toISOString();
      if (picked && thumbBlobPath) c.mainPhoto = { dropboxId: picked.id, thumbBlobPath };
      return { result: null, write: true };
    },
    { id: "dropbox", name: "Dropbox" },
  ).catch(() => null);
  return thumbBlobPath ? thumb : null;
}

/**
 * Ar roku izvēlēta galvenā bilde no STOCK kandidātiem (J29 B API; UI gaida Nila apstiprinātu maketu).
 * `dropboxId` jābūt starp šī auto STOCK bildēm - citādi `not_found` (nekāda cita Dropbox faila id nevar uzspiest).
 */
export async function setAutoparksV2MainPhoto(
  car: AutoparksCar,
  dropboxId: string,
  actor: AutoparksV2Actor,
): Promise<{ ok: true } | { ok: false; reason: "not_found" | "dropbox_error" }> {
  const client = getDropboxClient();
  if (!client) return { ok: false, reason: "dropbox_error" };
  const candidates = await autoparksV2StockPhotoCandidates(car);
  const picked = candidates.find((c) => c.id === dropboxId);
  if (!picked) return { ok: false, reason: "not_found" };
  let thumb: Buffer | null = null;
  try {
    thumb = await makeAutoparksThumbnail((await client.download(picked.id)).bytes, "image/jpeg");
  } catch (err) {
    console.warn("[autoparks v2 foto - ar roku]", err instanceof Error ? err.message : err);
  }
  if (!thumb) return { ok: false, reason: "dropbox_error" };
  const stored = await putLogisticsBinaryFile(`autoparks/${car.id}/v2-main.jpg`, thumb, "image/jpeg").catch(() => null);
  if (!stored) return { ok: false, reason: "dropbox_error" };
  await updateCarV2(
    car.id,
    (c) => {
      const from = c.mainPhoto?.dropboxId ?? "";
      c.mainPhoto = { dropboxId: picked.id, thumbBlobPath: stored.pathname };
      c.photoCheckedAt = new Date().toISOString();
      return { result: null, history: [{ field: "mainPhoto", from, to: picked.id }], write: true };
    },
    actor,
  );
  return { ok: true };
}

/**
 * Vienreizējs esošās galvenās bildes atiestatīšana (J29 A): vecā sīktēla baiti tiek saglabāti dublējumā
 * Blob (atgriežami - nekas netiek dzēsts), tad `mainPhoto`/`photoCheckedAt` tiek notīrīti, lai nākamajā
 * kabineta/saraksta atvērumā `autoparksV2MainPhoto` izvēlētos no jauna pēc jaunās heuristikas.
 */
export async function resetAutoparksV2MainPhoto(carId: string, actor: AutoparksV2Actor): Promise<{ hadPhoto: boolean; backedUpTo: string } | null> {
  const found = await readAutoparksV2Car(carId);
  if (!found) return null;
  const old = found.v2.mainPhoto;
  if (!old) return { hadPhoto: false, backedUpTo: "" };
  let backedUpTo = "";
  const got = await getLogisticsBinaryFile(old.thumbBlobPath).catch(() => null);
  if (got) {
    const stamp = new Date().toISOString().replace(/[^0-9]/g, "");
    const stored = await putLogisticsBinaryFile(`autoparks/${carId}/v2-main-backup-${stamp}.jpg`, got.bytes, got.contentType).catch(() => null);
    backedUpTo = stored?.pathname ?? "";
  }
  await updateCarV2(
    carId,
    (c) => {
      const from = c.mainPhoto ? `${c.mainPhoto.dropboxId}${backedUpTo ? ` (dublējums: ${backedUpTo})` : ""}` : "";
      c.mainPhoto = null;
      c.photoCheckedAt = "";
      return { result: null, history: [{ field: "mainPhoto", from, to: "" }], write: true };
    },
    actor,
  );
  return { hadPhoto: true, backedUpTo };
}

export type ResetAllMainPhotosSummary = { totalCars: number; hadPhoto: number; backedUp: number; failed: number };

/** Vienreizējs pārrēķins visiem auto (J29 A) - tikai tiem, kam jau bija galvenā bilde (vecā heuristika). */
export async function resetAllAutoparksV2MainPhotos(actor: AutoparksV2Actor): Promise<ResetAllMainPhotosSummary> {
  const v1 = await readAutoparksState();
  const out: ResetAllMainPhotosSummary = { totalCars: v1.cars.length, hadPhoto: 0, backedUp: 0, failed: 0 };
  for (const car of v1.cars) {
    const res = await resetAutoparksV2MainPhoto(car.id, actor).catch(() => null);
    if (!res) {
      out.failed += 1;
      continue;
    }
    if (res.hadPhoto) {
      out.hadPhoto += 1;
      if (res.backedUpTo) out.backedUp += 1;
    }
  }
  return out;
}
