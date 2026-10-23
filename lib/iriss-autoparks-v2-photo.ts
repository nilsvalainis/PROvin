import "server-only";

import { getDropboxClient } from "@/lib/dropbox-client";
import type { AutoparksCar } from "@/lib/iriss-autoparks";
import { isStockPhoto } from "@/lib/iriss-autoparks-dropbox-sync";
import { makeAutoparksThumbnail } from "@/lib/iriss-autoparks-files";
import type { AutoparksCarV2 } from "@/lib/iriss-autoparks-v2";
import { pickStockMainPhoto } from "@/lib/iriss-autoparks-v2-photo-pick";
import { updateCarV2 } from "@/lib/iriss-autoparks-v2-store";
import { getLogisticsBinaryFile, putLogisticsBinaryFile } from "@/lib/iriss-logistics-store";

const RECHECK_MS = 24 * 60 * 60 * 1000;

/**
 * Galvenā bilde: TIKAI no auto /STOCK mapes pirmā līmeņa (izsoles foto apakšmapēs un Loģistikā netiek ņemti).
 * Pirmā bilde pēc nosaukuma (IETEIKUMI 7.6 - līdz zvaigznei). Sīktēls Blob; skatās ne biežāk kā 1x dienā.
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
  let thumb: Buffer | null = null;
  let picked: { id: string } | null = null;
  try {
    const folder = await client.getMetadata(car.dropboxFolderId);
    if (folder?.tag === "folder") {
      const { entries } = await client.listAll(folder.pathDisplay, { recursive: false });
      picked = pickStockMainPhoto(entries.filter((e) => e.tag === "file" && isStockPhoto(e.name)));
      if (picked) thumb = await makeAutoparksThumbnail((await client.download(picked.id)).bytes, "image/jpeg");
    }
  } catch (err) {
    console.warn("[autoparks v2 foto]", err instanceof Error ? err.message : err);
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
