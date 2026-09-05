import "server-only";

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
  flattenIncidentPhotoGroups,
  isIncidentPhotoId,
  normalizeIncidentPhotoGroups,
} from "@/lib/incident-photo-types";

/** JPEG pēc klienta kompresijas. */
export const INCIDENT_PHOTO_MAX_BYTES = 320 * 1024;

export function makeIncidentPhotoId(): string {
  return `inc_ph_${crypto.randomBytes(12).toString("hex")}`;
}

export function isSafeIncidentPhotoId(id: string): boolean {
  return isIncidentPhotoId(id);
}

export function isJpegMagicBuffer(buf: Buffer): boolean {
  return buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
}

function listingPhotoBlobPathname(prefix: string, sessionId: string, photoId: string): string {
  const p = prefix.endsWith("/") ? prefix : `${prefix}/`;
  return `${p}incident-photos/${sessionId}/${photoId}.jpg`;
}

function listingPhotoFsPath(draftDir: string, sessionId: string, photoId: string): string {
  return path.join(draftDir, "incident-photos", sessionId, `${photoId}.jpg`);
}

/** Vercel: tikai Blob ir ilgtermiņa; /tmp fails pazūd starp pieprasījumiem. */
function isListingPhotoBlobPrimary(): boolean {
  return Boolean(getOrderDraftBlobConfig()) && process.env.VERCEL === "1";
}

function shouldSkipEphemeralListingPhotoFs(): boolean {
  const blob = getOrderDraftBlobConfig();
  const draftDir = getOrderDraftStorageDir();
  if (!blob || !draftDir) return false;
  const normalized = path.resolve(draftDir);
  const tmp = path.resolve(os.tmpdir());
  return process.env.VERCEL === "1" && (normalized === tmp || normalized.startsWith(`${tmp}${path.sep}`));
}

export function collectIncidentPhotoIdsFromWorkspace(
  workspace: { incidentPhotoGroups?: unknown; incidentPhotos?: unknown } | null | undefined,
): Set<string> {
  const keep = new Set<string>();
  const groups = normalizeIncidentPhotoGroups(workspace?.incidentPhotoGroups, workspace?.incidentPhotos);
  for (const ph of flattenIncidentPhotoGroups(groups)) keep.add(ph.id);
  return keep;
}

export async function writeIncidentPhotoJpeg(
  sessionId: string,
  photoId: string,
  jpegBody: Buffer,
): Promise<void> {
  if (!isSafeOrderDraftSessionId(sessionId) || !isSafeIncidentPhotoId(photoId)) {
    throw new Error("invalid_ids");
  }

  let blobOk = false;
  let fsOk = false;

  const blob = getOrderDraftBlobConfig();
  if (blob) {
    try {
      await put(listingPhotoBlobPathname(blob.prefix, sessionId, photoId), jpegBody, {
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
  const skipFs = shouldSkipEphemeralListingPhotoFs();
  if (draftDir && !skipFs) {
    try {
      const fp = listingPhotoFsPath(draftDir, sessionId, photoId);
      await fs.mkdir(path.dirname(fp), { recursive: true });
      const tmp = `${fp}.tmp`;
      await fs.writeFile(tmp, jpegBody);
      await fs.rename(tmp, fp);
      fsOk = true;
    } catch {
      fsOk = false;
    }
  }

  if (isListingPhotoBlobPrimary()) {
    if (!blobOk) throw new Error("blob_write_failed");
    const verify = await readIncidentPhotoJpeg(sessionId, photoId);
    if (!verify) throw new Error("write_verify_failed");
    return;
  }

  if (!blobOk && !fsOk) {
    if (blob && !blobOk) throw new Error("blob_write_failed");
    throw new Error("write_failed");
  }

  const verify = await readIncidentPhotoJpeg(sessionId, photoId);
  if (!verify) throw new Error("write_verify_failed");
}

export async function readIncidentPhotoJpeg(
  sessionId: string,
  photoId: string,
): Promise<Buffer | null> {
  if (!isSafeOrderDraftSessionId(sessionId) || !isSafeIncidentPhotoId(photoId)) return null;

  const blob = getOrderDraftBlobConfig();
  if (blob) {
    try {
      const res = await get(listingPhotoBlobPathname(blob.prefix, sessionId, photoId), {
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

  if (isListingPhotoBlobPrimary()) return null;

  const draftDir = getOrderDraftStorageDir();
  if (!draftDir || shouldSkipEphemeralListingPhotoFs()) return null;
  try {
    const buf = await fs.readFile(listingPhotoFsPath(draftDir, sessionId, photoId));
    if (!isJpegMagicBuffer(buf)) return null;
    return jpegWithCheckcarWatermarkCovered(buf);
  } catch {
    return null;
  }
}

export async function deleteIncidentPhoto(sessionId: string, photoId: string): Promise<void> {
  if (!isSafeOrderDraftSessionId(sessionId) || !isSafeIncidentPhotoId(photoId)) return;

  const blob = getOrderDraftBlobConfig();
  if (blob) {
    try {
      await del(listingPhotoBlobPathname(blob.prefix, sessionId, photoId), { token: blob.token });
    } catch {
      /* ignore */
    }
  }

  const draftDir = getOrderDraftStorageDir();
  if (draftDir) {
    await fs.rm(listingPhotoFsPath(draftDir, sessionId, photoId), { force: true });
  }
}

export async function pruneOrphanIncidentPhotos(
  sessionId: string,
  keepPhotoIds: Set<string>,
): Promise<void> {
  if (!isSafeOrderDraftSessionId(sessionId)) return;

  const blob = getOrderDraftBlobConfig();
  if (blob) {
    try {
      const prefix = listingPhotoBlobPathname(blob.prefix, sessionId, "").replace(/\/$/, "");
      const { blobs } = await list({ prefix: `${prefix}/`, token: blob.token });
      await Promise.all(
        blobs.map(async (b) => {
          const name = b.pathname.split("/").pop() ?? "";
          if (!name.endsWith(".jpg")) return;
          const id = name.slice(0, -".jpg".length);
          if (!isSafeIncidentPhotoId(id)) return;
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
  const dir = path.join(draftDir, "incident-photos", sessionId);
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
      if (!isSafeIncidentPhotoId(id)) return;
      if (keepPhotoIds.has(id)) return;
      await fs.rm(path.join(dir, name), { force: true });
    }),
  );
}

/** Visi JPEG faili glabātuvē sesijai (Blob + lokālais disks). */
export async function listStoredIncidentPhotoIds(sessionId: string): Promise<string[]> {
  if (!isSafeOrderDraftSessionId(sessionId)) return [];
  const ids = new Set<string>();

  const blob = getOrderDraftBlobConfig();
  if (blob) {
    try {
      const prefix = listingPhotoBlobPathname(blob.prefix, sessionId, "").replace(/\/$/, "");
      const { blobs } = await list({ prefix: `${prefix}/`, token: blob.token });
      for (const b of blobs) {
        const name = b.pathname.split("/").pop() ?? "";
        if (!name.endsWith(".jpg")) continue;
        const id = name.slice(0, -".jpg".length);
        if (isSafeIncidentPhotoId(id)) ids.add(id);
      }
    } catch {
      /* ignore */
    }
  }

  const draftDir = getOrderDraftStorageDir();
  if (draftDir && !shouldSkipEphemeralListingPhotoFs()) {
    try {
      const names = await fs.readdir(path.join(draftDir, "incident-photos", sessionId));
      for (const name of names) {
        if (!name.endsWith(".jpg")) continue;
        const id = name.slice(0, -".jpg".length);
        if (isSafeIncidentPhotoId(id)) ids.add(id);
      }
    } catch {
      /* ignore */
    }
  }

  return [...ids];
}

/** PDF ģenerēšanai — base64 data URL no ilgtermiņa glabātuves. */
export async function readIncidentPhotosForPdf(
  sessionId: string,
  preferredOrder: string[],
): Promise<{ dataUrls: Record<string, string>; missing: string[] }> {
  const stored = await listStoredIncidentPhotoIds(sessionId);
  const storedSet = new Set(stored);
  const ordered: string[] = [];
  for (const id of preferredOrder) {
    if (isSafeIncidentPhotoId(id) && !ordered.includes(id)) ordered.push(id);
  }
  for (const id of stored) {
    if (!ordered.includes(id)) ordered.push(id);
  }

  const dataUrls: Record<string, string> = {};
  const missing: string[] = [];
  for (const id of ordered) {
    const buf = await readIncidentPhotoJpeg(sessionId, id);
    if (!buf) {
      if (preferredOrder.includes(id) || storedSet.has(id)) missing.push(id);
      continue;
    }
    dataUrls[id] = `data:image/jpeg;base64,${buf.toString("base64")}`;
  }
  return { dataUrls, missing };
}
