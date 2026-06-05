import "server-only";

import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { del, get, list, put } from "@vercel/blob";

import {
  getOrderDraftBlobConfig,
  getOrderDraftStorageDir,
  isSafeOrderDraftSessionId,
} from "@/lib/admin-order-draft-store";
import {
  isListingAnalysisPhotoId,
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

export function collectListingAnalysisPhotoIdsFromWorkspace(
  workspace: { sourceBlocks?: unknown } | null | undefined,
): Set<string> {
  const keep = new Set<string>();
  const raw = workspace?.sourceBlocks;
  if (!raw || typeof raw !== "object") return keep;
  const la = (raw as { listing_analysis?: { photos?: unknown } }).listing_analysis;
  const photos = normalizeListingAnalysisPhotos(la?.photos);
  for (const ph of photos) keep.add(ph.id);
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
  if (draftDir) {
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

  if (!blobOk && !fsOk) throw new Error("write_failed");
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

  const draftDir = getOrderDraftStorageDir();
  if (!draftDir) return null;
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
