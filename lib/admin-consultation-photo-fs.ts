import "server-only";

import crypto from "crypto";
import fs from "fs/promises";
import path from "path";

import { isConsultationSlotPhotoId } from "@/lib/admin-consultation-draft-types";

/** JPEG fails — pēc klienta kompresijas. */
export const CONSULTATION_PHOTO_MAX_BYTES = 320 * 1024;

export function isSafeConsultationPhotoId(id: string): boolean {
  return isConsultationSlotPhotoId(id);
}

export function makeConsultationPhotoId(): string {
  return `ph_${crypto.randomBytes(12).toString("hex")}`;
}

export function consultationAttachmentSessionDir(draftDir: string, sessionId: string): string {
  return path.join(draftDir, "attachments", sessionId);
}

export function consultationPhotoFilePath(draftDir: string, sessionId: string, photoId: string): string {
  return path.join(consultationAttachmentSessionDir(draftDir, sessionId), `${photoId}.jpg`);
}

export function isJpegMagicBuffer(buf: Buffer): boolean {
  return buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
}

export async function writeConsultationSlotPhotoJpeg(
  draftDir: string,
  sessionId: string,
  photoId: string,
  jpegBody: Buffer,
): Promise<void> {
  const dir = consultationAttachmentSessionDir(draftDir, sessionId);
  await fs.mkdir(dir, { recursive: true });
  const fp = consultationPhotoFilePath(draftDir, sessionId, photoId);
  const tmp = `${fp}.tmp`;
  await fs.writeFile(tmp, jpegBody);
  await fs.rename(tmp, fp);
}

export async function readConsultationSlotPhotoJpeg(
  draftDir: string,
  sessionId: string,
  photoId: string,
): Promise<Buffer | null> {
  const fp = consultationPhotoFilePath(draftDir, sessionId, photoId);
  try {
    const buf = await fs.readFile(fp);
    if (!isJpegMagicBuffer(buf)) return null;
    return buf;
  } catch {
    return null;
  }
}

export async function deleteConsultationSlotPhoto(
  draftDir: string,
  sessionId: string,
  photoId: string,
): Promise<void> {
  const fp = consultationPhotoFilePath(draftDir, sessionId, photoId);
  await fs.rm(fp, { force: true });
}

export async function pruneOrphanConsultationSlotPhotos(
  draftDir: string,
  sessionId: string,
  keepPhotoIds: Set<string>,
): Promise<void> {
  const dir = consultationAttachmentSessionDir(draftDir, sessionId);
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
      if (!isSafeConsultationPhotoId(id)) return;
      if (keepPhotoIds.has(id)) return;
      await fs.rm(path.join(dir, name), { force: true });
    }),
  );
}
