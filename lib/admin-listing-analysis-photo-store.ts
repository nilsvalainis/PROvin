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
import {
  flattenListingAnalysisPhotoGroups,
  isListingAnalysisPhotoId,
  normalizeListingAnalysisPhotoGroups,
  normalizeListingAnalysisPhotos,
  type ListingAnalysisPhotoMeta,
} from "@/lib/listing-analysis-photo-types";

/** JPEG pēc klienta kompresijas. */
export const LISTING_ANALYSIS_PHOTO_MAX_BYTES = 320 * 1024;

export function makeListingAnalysisPhotoId(): string {
  return `la_ph_${crypto.randomBytes(12).toString("hex")}`;
}

export function isSafeListingAnalysisPhotoId(id: string): boolean {
  return isListingAnalysisPhotoId(id);
}

export function isJpegMagicBuffer(buf: Buffer): boolean {
  return buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
}

function listingPhotoBlobPathname(prefix: string, sessionId: string, photoId: string): string {
  const p = prefix.endsWith("/") ? prefix : `${prefix}/`;
  return `${p}listing-analysis-photos/${sessionId}/${photoId}.jpg`;
}

function listingPhotoFsPath(draftDir: string, sessionId: string, photoId: string): string {
  return path.join(draftDir, "listing-analysis-photos", sessionId, `${photoId}.jpg`);
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

export function collectListingAnalysisPhotoIdsFromWorkspace(
  workspace: { sourceBlocks?: unknown } | null | undefined,
): Set<string> {
  const keep = new Set<string>();
  const raw = workspace?.sourceBlocks;
  if (!raw || typeof raw !== "object") return keep;
  const la = (raw as { listing_analysis?: { photos?: unknown; photoGroups?: unknown } }).listing_analysis;
  const groups = normalizeListingAnalysisPhotoGroups(la?.photoGroups, la?.photos);
  for (const ph of flattenListingAnalysisPhotoGroups(groups)) keep.add(ph.id);
  return keep;
}

export async function writeListingAnalysisPhotoJpeg(
  sessionId: string,
  photoId: string,
  jpegBody: Buffer,
): Promise<void> {
  if (!isSafeOrderDraftSessionId(sessionId) || !isSafeListingAnalysisPhotoId(photoId)) {
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
    const verify = await readListingAnalysisPhotoJpeg(sessionId, photoId);
    if (!verify) throw new Error("write_verify_failed");
    return;
  }

  if (!blobOk && !fsOk) {
    if (blob && !blobOk) throw new Error("blob_write_failed");
    throw new Error("write_failed");
  }

  const verify = await readListingAnalysisPhotoJpeg(sessionId, photoId);
  if (!verify) throw new Error("write_verify_failed");
}

export async function readListingAnalysisPhotoJpeg(
  sessionId: string,
  photoId: string,
): Promise<Buffer | null> {
  if (!isSafeOrderDraftSessionId(sessionId) || !isSafeListingAnalysisPhotoId(photoId)) return null;

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
        if (isJpegMagicBuffer(buf)) return buf;
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
    return buf;
  } catch {
    return null;
  }
}

export async function deleteListingAnalysisPhoto(sessionId: string, photoId: string): Promise<void> {
  if (!isSafeOrderDraftSessionId(sessionId) || !isSafeListingAnalysisPhotoId(photoId)) return;

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

export async function pruneOrphanListingAnalysisPhotos(
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
          if (!isSafeListingAnalysisPhotoId(id)) return;
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
  const dir = path.join(draftDir, "listing-analysis-photos", sessionId);
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
      if (!isSafeListingAnalysisPhotoId(id)) return;
      if (keepPhotoIds.has(id)) return;
      await fs.rm(path.join(dir, name), { force: true });
    }),
  );
}

/** Visi JPEG faili glabātuvē sesijai (Blob + lokālais disks). */
export async function listStoredListingAnalysisPhotoIds(sessionId: string): Promise<string[]> {
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
        if (isSafeListingAnalysisPhotoId(id)) ids.add(id);
      }
    } catch {
      /* ignore */
    }
  }

  const draftDir = getOrderDraftStorageDir();
  if (draftDir && !shouldSkipEphemeralListingPhotoFs()) {
    try {
      const names = await fs.readdir(path.join(draftDir, "listing-analysis-photos", sessionId));
      for (const name of names) {
        if (!name.endsWith(".jpg")) continue;
        const id = name.slice(0, -".jpg".length);
        if (isSafeListingAnalysisPhotoId(id)) ids.add(id);
      }
    } catch {
      /* ignore */
    }
  }

  return [...ids];
}

/** PDF ģenerēšanai — base64 data URL no ilgtermiņa glabātuves. */
export async function readListingAnalysisPhotosForPdf(
  sessionId: string,
  preferredOrder: string[],
): Promise<{ dataUrls: Record<string, string>; missing: string[] }> {
  const stored = await listStoredListingAnalysisPhotoIds(sessionId);
  const storedSet = new Set(stored);
  const ordered: string[] = [];
  for (const id of preferredOrder) {
    if (isSafeListingAnalysisPhotoId(id) && !ordered.includes(id)) ordered.push(id);
  }
  for (const id of stored) {
    if (!ordered.includes(id)) ordered.push(id);
  }

  const dataUrls: Record<string, string> = {};
  const missing: string[] = [];
  for (const id of ordered) {
    const buf = await readListingAnalysisPhotoJpeg(sessionId, id);
    if (!buf) {
      if (preferredOrder.includes(id) || storedSet.has(id)) missing.push(id);
      continue;
    }
    dataUrls[id] = `data:image/jpeg;base64,${buf.toString("base64")}`;
  }
  return { dataUrls, missing };
}
