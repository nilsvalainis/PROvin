import "server-only";

import type { AutoparksCar, AutoparksFile, AutoparksStage } from "@/lib/iriss-autoparks";
import {
  autoparksDropboxFileName,
  autoparksDropboxRoot,
  autoparksStockFolderName,
  joinDropboxPath,
  matchStockFolderByVin,
} from "@/lib/iriss-autoparks-dropbox-path";
import { getDropboxClient, type DropboxClient } from "@/lib/dropbox-client";
import { getLogisticsBinaryFile, getLogisticsOrder, putLogisticsBinaryFile } from "@/lib/iriss-logistics-store";

/** `AUTOPARKS_DROPBOX=off` atslēdz Dropbox un atgriežas pie Blob (avārijas slēdzis). */
export function autoparksDropboxEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const flag = (env.AUTOPARKS_DROPBOX ?? "").trim().toLowerCase();
  if (["0", "off", "false", "no"].includes(flag)) return false;
  return getDropboxClient() !== null;
}

export type AutoparksFolderRef = { id: string; path: string };

export class AutoparksFolderError extends Error {
  constructor(readonly code: "root_missing" | "ambiguous" | "no_vin_and_no_name") {
    super(`autoparks_folder_${code}`);
    this.name = "AutoparksFolderError";
  }
}

/**
 * Auto mape Dropbox: 1) saglabātais id, 2) esoša /STOCK mape pēc VIN pēdējiem 6, 3) jauna mape pēc parauga.
 * Saknes mapi nekad neveido - ja tās nav (piem. Dropbox app ir "App folder" tipa), metam kļūdu un paliekam pie Blob.
 */
export async function resolveAutoparksCarFolder(
  client: DropboxClient,
  car: Pick<AutoparksCar, "make" | "model" | "year" | "color" | "vin" | "orderId" | "dropboxFolderId"> & { owner?: "IRISS" | "DZA" },
  opts: { create?: boolean; auction?: string | null } = {},
): Promise<AutoparksFolderRef | null> {
  if (car.dropboxFolderId) {
    const meta = await client.getMetadata(car.dropboxFolderId);
    if (meta?.tag === "folder") return { id: meta.id, path: meta.pathDisplay };
  }
  const root = autoparksDropboxRoot(car.owner ?? "IRISS");
  const rootMeta = await client.getMetadata(root);
  if (!rootMeta || rootMeta.tag !== "folder") throw new AutoparksFolderError("root_missing");
  const { entries } = await client.listAll(root, { recursive: false });
  const folders = entries.filter((e) => e.tag === "folder");
  const match = matchStockFolderByVin(
    folders.map((f) => f.name),
    car.vin,
  );
  if (match.kind === "found") {
    const f = folders[match.index]!;
    return { id: f.id, path: f.pathDisplay };
  }
  if (match.kind === "ambiguous") throw new AutoparksFolderError("ambiguous");
  if (opts.create === false) return null;
  if (!car.vin.trim() && !car.make.trim() && !car.model.trim()) throw new AutoparksFolderError("no_vin_and_no_name");
  let auction = opts.auction ?? null;
  if (auction == null && car.orderId) auction = (await getLogisticsOrder(car.orderId).catch(() => null))?.auction ?? null;
  const created = await client.ensureFolder(joinDropboxPath(rootMeta.pathDisplay || root, autoparksStockFolderName(car, auction)));
  return { id: created.id, path: created.pathDisplay };
}

/** ~30 KB JPEG sīktēls (garākā mala 480 px). Kļūdas gadījumā `null` - sīktēls nav obligāts. */
export async function makeAutoparksThumbnail(bytes: Buffer, contentType: string): Promise<Buffer | null> {
  if (!contentType.startsWith("image/")) return null;
  try {
    const sharp = (await import("sharp")).default;
    return await sharp(bytes, { failOn: "none" }).rotate().resize(480, 480, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 68, mozjpeg: true }).toBuffer();
  } catch {
    return null;
  }
}

export type AutoparksStoredRef = {
  blobPath: string;
  dropboxId: string;
  dropboxPath: string;
  thumbBlobPath: string;
  /** Mape, kurā fails nonāca (lai saglabātu pie auto, ja vēl nav). */
  folder: AutoparksFolderRef | null;
};

/**
 * Faila saturs: Dropbox auto mapē (ja konfigurēts), citādi Blob kā līdz šim.
 * Dropbox kļūda neaptur augšupielādi - fails paliek Blob, migrācija to pārcels vēlāk.
 */
export async function storeAutoparksFileBytes(input: {
  car: AutoparksCar & { owner?: "IRISS" | "DZA" };
  stage: AutoparksStage;
  title: string;
  fileName: string;
  contentType: string;
  bytes: Buffer;
  sha256: string;
}): Promise<AutoparksStoredRef> {
  const client = autoparksDropboxEnabled() ? getDropboxClient() : null;
  if (client) {
    try {
      const folder = await resolveAutoparksCarFolder(client, input.car);
      if (folder) {
        const name = autoparksDropboxFileName(input.stage, input.title, input.fileName, input.contentType);
        const up = await client.upload(joinDropboxPath(folder.path, name), input.bytes, "add");
        let thumbBlobPath = "";
        const thumb = await makeAutoparksThumbnail(input.bytes, input.contentType);
        if (thumb) {
          thumbBlobPath = (await putLogisticsBinaryFile(`autoparks/${input.car.id}/thumbs/${input.sha256}.jpg`, thumb, "image/jpeg").catch(() => null))?.pathname ?? "";
        }
        return { blobPath: "", dropboxId: up.id, dropboxPath: up.pathDisplay, thumbBlobPath, folder };
      }
    } catch (err) {
      console.warn("[autoparks dropbox upload -> blob]", err instanceof Error ? err.message : err);
    }
  }
  const ext = (input.fileName.match(/\.[a-z0-9]{2,5}$/i)?.[0] ?? (input.contentType.includes("pdf") ? ".pdf" : "")).toLowerCase();
  const stored = await putLogisticsBinaryFile(`autoparks/${input.car.id}/${input.sha256}${ext}`, input.bytes, input.contentType || "application/octet-stream");
  return { blobPath: stored.pathname, dropboxId: "", dropboxPath: "", thumbBlobPath: "", folder: null };
}

/** Lasa saturu: Dropbox (pēc id, tad pēc ceļa) vai Blob (vecie faili). */
export async function readAutoparksStoredBytes(file: Pick<AutoparksFile, "blobPath" | "dropboxId" | "dropboxPath">): Promise<{ bytes: Buffer; contentType: string } | null> {
  if (file.dropboxId || file.dropboxPath) {
    const client = getDropboxClient();
    if (client) {
      for (const ref of [file.dropboxId, file.dropboxPath].filter((r): r is string => Boolean(r))) {
        try {
          const got = await client.download(ref);
          return { bytes: got.bytes, contentType: "application/octet-stream" };
        } catch (err) {
          console.warn("[autoparks dropbox download]", err instanceof Error ? err.message : err);
        }
      }
    }
  }
  if (file.blobPath) return getLogisticsBinaryFile(file.blobPath);
  return null;
}

/** Īslaicīga saite (4 h) lieliem Dropbox failiem, kas neiet cauri Vercel atbildes limitam. */
export async function autoparksTemporaryLink(file: Pick<AutoparksFile, "dropboxId" | "dropboxPath">): Promise<string | null> {
  const client = getDropboxClient();
  const ref = file.dropboxId || file.dropboxPath;
  if (!client || !ref) return null;
  try {
    return await client.temporaryLink(ref);
  } catch {
    return null;
  }
}

export async function readAutoparksThumbnail(file: Pick<AutoparksFile, "thumbBlobPath">): Promise<Buffer | null> {
  if (!file.thumbBlobPath) return null;
  return (await getLogisticsBinaryFile(file.thumbBlobPath))?.bytes ?? null;
}
