/**
 * Klienta JPEG kompresija pirms augšupielādes.
 * Formātu nosaka pēc baitiem (JPEG ar .png vārdu, HEIC ar .jpg u.c.).
 * Ja pārlūks neatkodē, oriģinālu sūta serverim.
 */

import {
  SNIFFED_IMAGE_EXT,
  SNIFFED_IMAGE_MIME,
  sniffImageKind,
  type SniffedImageKind,
} from "@/lib/admin-photo-magic";

const TARGET_MAX_BYTES = 190_000;
const MAX_DIMENSION = 1680;
const PASSTHROUGH_MAX_BYTES = 12 * 1024 * 1024;

function jpegBaseName(originalName: string): string {
  const base = originalName.replace(/\.[^.\\/]+$/i, "").trim() || "photo";
  return `${base}.jpg`;
}

function nameWithKind(originalName: string, kind: SniffedImageKind): string {
  const base = originalName.replace(/\.[^.\\/]+$/i, "").trim() || "photo";
  return `${base}.${SNIFFED_IMAGE_EXT[kind]}`;
}

function canvasToJpegBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) resolve(b);
        else reject(new Error("toBlob_failed"));
      },
      "image/jpeg",
      quality,
    );
  });
}

async function blobUnderMaxBytes(startCanvas: HTMLCanvasElement, maxBytes: number): Promise<Blob> {
  let work: HTMLCanvasElement = startCanvas;
  for (let sizePass = 0; sizePass < 12; sizePass++) {
    let q = 0.9;
    for (let qPass = 0; qPass < 16; qPass++) {
      const blob = await canvasToJpegBlob(work, q);
      if (blob.size <= maxBytes) return blob;
      if (q > 0.38) q -= 0.045;
      else break;
    }
    if (work.width <= 520 && work.height <= 400) {
      return canvasToJpegBlob(work, 0.34);
    }
    const nw = Math.max(480, Math.round(work.width * 0.86));
    const nh = Math.max(360, Math.round(work.height * 0.86));
    const next = document.createElement("canvas");
    next.width = nw;
    next.height = nh;
    const ctx = next.getContext("2d");
    if (!ctx) return canvasToJpegBlob(work, 0.34);
    ctx.drawImage(work, 0, 0, nw, nh);
    work = next;
  }
  return canvasToJpegBlob(work, 0.32);
}

async function fileWithSniffedType(file: File): Promise<{ file: File; kind: SniffedImageKind | null }> {
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const kind = sniffImageKind(head);
  if (!kind) return { file, kind: null };
  const mime = SNIFFED_IMAGE_MIME[kind];
  if (file.type === mime) return { file, kind };
  return {
    file: new File([file], nameWithKind(file.name, kind), { type: mime, lastModified: file.lastModified }),
    kind,
  };
}

function drawImageElementToBitmap(img: HTMLImageElement): Promise<ImageBitmap> {
  const w = Math.max(1, img.naturalWidth || img.width);
  const h = Math.max(1, img.naturalHeight || img.height);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.reject(new Error("no_context"));
  ctx.drawImage(img, 0, 0, w, h);
  return createImageBitmap(canvas);
}

function decodeViaHtmlImage(file: File): Promise<ImageBitmap> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      void createImageBitmap(img)
        .catch(() => drawImageElementToBitmap(img))
        .then((bm) => {
          URL.revokeObjectURL(url);
          resolve(bm);
        })
        .catch((err) => {
          URL.revokeObjectURL(url);
          reject(err);
        });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("decode_failed"));
    };
    img.src = url;
  });
}

async function decodeFileToImageBitmap(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file);
  } catch {
    /* MIME nesakrīt ar baitiem, vai HEIC. */
  }
  return decodeViaHtmlImage(file);
}

function canPassthrough(file: File, kind: SniffedImageKind | null): boolean {
  if (file.size <= 0 || file.size > PASSTHROUGH_MAX_BYTES) return false;
  if (kind) return true;
  const type = (file.type ?? "").toLowerCase();
  if (type.startsWith("image/")) return true;
  return /\.(jpe?g|png|webp|gif|heic|heif|avif|bmp|tiff?)$/i.test(file.name);
}

export async function compressImageFileToJpegForConsultation(file: File): Promise<File> {
  const sniffed = await fileWithSniffedType(file);
  let bm: ImageBitmap | null = null;
  try {
    bm = await decodeFileToImageBitmap(sniffed.file);
    const w0 = bm.width;
    const h0 = bm.height;
    if (w0 < 1 || h0 < 1) throw new Error("empty_image");
    const ratio = Math.min(1, MAX_DIMENSION / Math.max(w0, h0));
    const tw = Math.max(1, Math.round(w0 * ratio));
    const th = Math.max(1, Math.round(h0 * ratio));
    const canvas = document.createElement("canvas");
    canvas.width = tw;
    canvas.height = th;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no_context");
    ctx.drawImage(bm, 0, 0, tw, th);
    bm.close();
    bm = null;

    const blob = await blobUnderMaxBytes(canvas, TARGET_MAX_BYTES);
    return new File([blob], jpegBaseName(file.name), {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  } catch (e) {
    if (bm) {
      try {
        bm.close();
      } catch {
        /* ignore */
      }
    }
    if (canPassthrough(sniffed.file, sniffed.kind)) {
      return sniffed.file;
    }
    throw e instanceof Error ? e : new Error("decode_failed");
  }
}
