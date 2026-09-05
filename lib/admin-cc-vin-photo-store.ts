import "server-only";

/**
 * Starptautiskās vēstures avota fotogrāfijas (JPEG — Blob + lokālais disks).
 * Atsevišķa glabātuve no dīlera foto: „dzēst visas” un orfānu tīrīšana strādā tikai savā mapē.
 */

import crypto from "crypto";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { del, get, list, put } from "@vercel/blob";

import {
  getOrderDraftBlobConfig,
  getOrderDraftStorageDir,
  isSafeOrderDraftSessionId,
} from "@/lib/admin-order-draft-store";
import { jpegWithCheckcarWatermarkCovered } from "@/lib/checkcar-watermark-cover";
import {
  flattenCcVinPhotoGroups,
  isCcVinPhotoId,
  normalizeCcVinPhotoGroups,
} from "@/lib/cc-vin-photo-types";

/** JPEG pēc klienta kompresijas. */
export const CC_VIN_PHOTO_MAX_BYTES = 320 * 1024;

const PHOTO_DIR = "cc-vin-photos";

export function makeCcVinPhotoId(): string {
  return `ih_ph_${crypto.randomBytes(12).toString("hex")}`;
}

export function isSafeCcVinPhotoId(id: string): boolean {
  return isCcVinPhotoId(id);
}

export function isJpegMagicBuffer(buf: Buffer): boolean {
  return buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
}

function photoBlobPathname(prefix: string, sessionId: string, photoId: string): string {
  const p = prefix.endsWith("/") ? prefix : `${prefix}/`;
  return `${p}${PHOTO_DIR}/${sessionId}/${photoId}.jpg`;
}

function photoFsPath(draftDir: string, sessionId: string, photoId: string): string {
  return path.join(draftDir, PHOTO_DIR, sessionId, `${photoId}.jpg`);
}

/** Vercel: tikai Blob ir ilgtermiņa; /tmp fails pazūd starp pieprasījumiem. */
function isBlobPrimary(): boolean {
  return Boolean(getOrderDraftBlobConfig()) && process.env.VERCEL === "1";
}

function shouldSkipEphemeralFs(): boolean {
  const blob = getOrderDraftBlobConfig();
  const draftDir = getOrderDraftStorageDir();
  if (!blob || !draftDir) return false;
  const normalized = path.resolve(draftDir);
  const tmp = path.resolve(os.tmpdir());
  return process.env.VERCEL === "1" && (normalized === tmp || normalized.startsWith(`${tmp}${path.sep}`));
}

export function collectCcVinPhotoIdsFromWorkspace(
  workspace: { sourceBlocks?: unknown } | null | undefined,
): Set<string> {
  const keep = new Set<string>();
  const raw = workspace?.sourceBlocks;
  if (!raw || typeof raw !== "object") return keep;
  const block = (raw as { cc_vin?: { photos?: unknown; photoGroups?: unknown } }).cc_vin;
  const groups = normalizeCcVinPhotoGroups(block?.photoGroups, block?.photos);
  for (const ph of flattenCcVinPhotoGroups(groups)) keep.add(ph.id);
  return keep;
}

export async function writeCcVinPhotoJpeg(
  sessionId: string,
  photoId: string,
  jpegBody: Buffer,
): Promise<void> {
  if (!isSafeOrderDraftSessionId(sessionId) || !isSafeCcVinPhotoId(photoId)) {
    throw new Error("invalid_ids");
  }

  let blobOk = false;
  let fsOk = false;

  const blob = getOrderDraftBlobConfig();
  if (blob) {
    try {
      await put(photoBlobPathname(blob.prefix, sessionId, photoId), jpegBody, {
        access: "private",
        token: blob.token,
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: "image/jpeg",
      });
      blobOk = true;
    } catch {
      blobOk = false;
    }
  }

  const draftDir = getOrderDraftStorageDir();
  const skipFs = shouldSkipEphemeralFs();
  if (draftDir && !skipFs) {
    try {
      const fp = photoFsPath(draftDir, sessionId, photoId);
      await fs.mkdir(path.dirname(fp), { recursive: true });
      const tmp = `${fp}.tmp`;
      await fs.writeFile(tmp, jpegBody);
      await fs.rename(tmp, fp);
      fsOk = true;
    } catch {
      fsOk = false;
    }
  }

  if (isBlobPrimary()) {
    if (!blobOk) throw new Error("blob_write_failed");
    const verify = await readCcVinPhotoJpeg(sessionId, photoId);
    if (!verify) throw new Error("write_verify_failed");
    return;
  }

  if (!blobOk && !fsOk) {
    if (blob && !blobOk) throw new Error("blob_write_failed");
    throw new Error("write_failed");
  }

  const verify = await readCcVinPhotoJpeg(sessionId, photoId);
  if (!verify) throw new Error("write_verify_failed");
}

export async function readCcVinPhotoJpeg(sessionId: string, photoId: string): Promise<Buffer | null> {
  if (!isSafeOrderDraftSessionId(sessionId) || !isSafeCcVinPhotoId(photoId)) return null;

  const blob = getOrderDraftBlobConfig();
  if (blob) {
    try {
      const res = await get(photoBlobPathname(blob.prefix, sessionId, photoId), {
        access: "private",
        token: blob.token,
        useCache: false,
      });
      if (res && res.statusCode === 200 && res.stream) {
        const buf = Buffer.from(await new Response(res.stream).arrayBuffer());
        if (isJpegMagicBuffer(buf)) return jpegWithCheckcarWatermarkCovered(buf);
      }
    } catch {
      /* fall through */
    }
  }

  if (isBlobPrimary()) return null;

  const draftDir = getOrderDraftStorageDir();
  if (!draftDir || shouldSkipEphemeralFs()) return null;
  try {
    const buf = await fs.readFile(photoFsPath(draftDir, sessionId, photoId));
    if (!isJpegMagicBuffer(buf)) return null;
    return jpegWithCheckcarWatermarkCovered(buf);
  } catch {
    return null;
  }
}

export async function deleteCcVinPhoto(sessionId: string, photoId: string): Promise<void> {
  if (!isSafeOrderDraftSessionId(sessionId) || !isSafeCcVinPhotoId(photoId)) return;

  const blob = getOrderDraftBlobConfig();
  if (blob) {
    try {
      await del(photoBlobPathname(blob.prefix, sessionId, photoId), { token: blob.token });
    } catch {
      /* ignore */
    }
  }

  const draftDir = getOrderDraftStorageDir();
  if (draftDir) {
    await fs.rm(photoFsPath(draftDir, sessionId, photoId), { force: true });
  }
}

export async function pruneOrphanCcVinPhotos(sessionId: string, keepPhotoIds: Set<string>): Promise<void> {
  if (!isSafeOrderDraftSessionId(sessionId)) return;

  const blob = getOrderDraftBlobConfig();
  if (blob) {
    try {
      const prefix = photoBlobPathname(blob.prefix, sessionId, "").replace(/\/$/, "");
      const { blobs } = await list({ prefix: `${prefix}/`, token: blob.token });
      await Promise.all(
        blobs.map(async (b) => {
          const name = b.pathname.split("/").pop() ?? "";
          if (!name.endsWith(".jpg")) return;
          const id = name.slice(0, -".jpg".length);
          if (!isSafeCcVinPhotoId(id)) return;
          if (keepPhotoIds.has(id)) return;
          await del(b.pathname, { token: blob.token }).catch(() => undefined);
        }),
      );
    } catch {
      /* ignore blob cleanup */
    }
  }

  const draftDir = getOrderDraftStorageDir();
  if (!draftDir) return;
  const dir = path.join(draftDir, PHOTO_DIR, sessionId);
  let names: string[];
  try {
    names = await fs.readdir(dir);
  } catch {
    return;
  }
  await Promise.all(
    names.map(async (name) => {
      if (!name.endsWith(".jpg")) return;
      const id = name.slice(0, -".jpg".length);
      if (!isSafeCcVinPhotoId(id)) return;
      if (keepPhotoIds.has(id)) return;
      await fs.rm(path.join(dir, name), { force: true });
    }),
  );
}

/** Visi JPEG faili glabātuvē sesijai (Blob + lokālais disks). */
export async function listStoredCcVinPhotoIds(sessionId: string): Promise<string[]> {
  if (!isSafeOrderDraftSessionId(sessionId)) return [];
  const ids = new Set<string>();

  const blob = getOrderDraftBlobConfig();
  if (blob) {
    try {
      const prefix = photoBlobPathname(blob.prefix, sessionId, "").replace(/\/$/, "");
      const { blobs } = await list({ prefix: `${prefix}/`, token: blob.token });
      for (const b of blobs) {
        const name = b.pathname.split("/").pop() ?? "";
        if (!name.endsWith(".jpg")) continue;
        const id = name.slice(0, -".jpg".length);
        if (isSafeCcVinPhotoId(id)) ids.add(id);
      }
    } catch {
      /* ignore */
    }
  }

  const draftDir = getOrderDraftStorageDir();
  if (draftDir && !shouldSkipEphemeralFs()) {
    try {
      const names = await fs.readdir(path.join(draftDir, PHOTO_DIR, sessionId));
      for (const name of names) {
        if (!name.endsWith(".jpg")) continue;
        const id = name.slice(0, -".jpg".length);
        if (isSafeCcVinPhotoId(id)) ids.add(id);
      }
    } catch {
      /* ignore */
    }
  }

  return [...ids];
}

/** PDF ģenerēšanai — base64 data URL no ilgtermiņa glabātuves. */
export async function readCcVinPhotosForPdf(
  sessionId: string,
  preferredOrder: string[],
): Promise<{ dataUrls: Record<string, string>; missing: string[] }> {
  const stored = await listStoredCcVinPhotoIds(sessionId);
  const storedSet = new Set(stored);
  const ordered: string[] = [];
  for (const id of preferredOrder) {
    if (isSafeCcVinPhotoId(id) && !ordered.includes(id)) ordered.push(id);
  }
  for (const id of stored) {
    if (!ordered.includes(id)) ordered.push(id);
  }

  const dataUrls: Record<string, string> = {};
  const missing: string[] = [];
  for (const id of ordered) {
    const buf = await readCcVinPhotoJpeg(sessionId, id);
    if (!buf) {
      if (preferredOrder.includes(id) || storedSet.has(id)) missing.push(id);
      continue;
    }
    dataUrls[id] = `data:image/jpeg;base64,${buf.toString("base64")}`;
  }
  return { dataUrls, missing };
}
