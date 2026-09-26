import "server-only";

import fs from "fs/promises";
import path from "path";
import { del, get, put } from "@vercel/blob";
import { isSafeListingPeekId } from "@/lib/listing-peek-photos";

const RELATIVE_DIR = ".data/listing-peeks/photos";

function blobToken(): string | null {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim() ?? "";
  return token || null;
}

function blobPathname(entryId: string, photoId: string): string {
  return `listing-peeks/photos/${entryId}/${photoId}.jpg`;
}

function filesystemPath(entryId: string, photoId: string): string | null {
  if (!isSafeListingPeekId(entryId) || !isSafeListingPeekId(photoId)) return null;
  const root = path.resolve(process.cwd(), RELATIVE_DIR);
  const file = path.resolve(root, entryId.toLowerCase(), `${photoId.toLowerCase()}.jpg`);
  if (file !== root && !file.startsWith(`${root}${path.sep}`)) return null;
  return file;
}

export async function readListingPeekPhotoJpeg(entryId: string, photoId: string): Promise<Buffer | null> {
  const entry = entryId.trim().toLowerCase();
  const photo = photoId.trim().toLowerCase();
  if (!isSafeListingPeekId(entry) || !isSafeListingPeekId(photo)) return null;

  const token = blobToken();
  if (token) {
    try {
      const res = await get(blobPathname(entry, photo), {
        access: "private",
        token,
        useCache: false,
      });
      if (res && res.statusCode === 200 && res.stream) {
        const buf = Buffer.from(await new Response(res.stream).arrayBuffer());
        if (buf.length > 0) return buf;
      }
    } catch {
      /* fallback uz disku */
    }
  }

  const fp = filesystemPath(entry, photo);
  if (!fp) return null;
  try {
    return await fs.readFile(fp);
  } catch {
    return null;
  }
}

export async function writeListingPeekPhotoJpeg(
  entryId: string,
  photoId: string,
  jpeg: Buffer,
): Promise<void> {
  const entry = entryId.trim().toLowerCase();
  const photo = photoId.trim().toLowerCase();
  if (!isSafeListingPeekId(entry) || !isSafeListingPeekId(photo)) {
    throw new Error("invalid_photo_id");
  }

  const token = blobToken();
  if (token) {
    await put(blobPathname(entry, photo), jpeg, {
      access: "private",
      token,
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "image/jpeg",
    });
  }

  const fp = filesystemPath(entry, photo);
  if (!fp) return;
  try {
    await fs.mkdir(path.dirname(fp), { recursive: true });
    await fs.writeFile(fp, jpeg);
  } catch {
    if (!token) throw new Error("photo_store_failed");
  }
}

export async function deleteListingPeekPhotoJpeg(entryId: string, photoId: string): Promise<void> {
  const entry = entryId.trim().toLowerCase();
  const photo = photoId.trim().toLowerCase();
  if (!isSafeListingPeekId(entry) || !isSafeListingPeekId(photo)) return;

  const token = blobToken();
  if (token) {
    try {
      await del(blobPathname(entry, photo), { token });
    } catch {
      /* metadati jau noņemti */
    }
  }

  const fp = filesystemPath(entry, photo);
  if (!fp) return;
  try {
    await fs.unlink(fp);
  } catch {
    /* jau nav */
  }
}
