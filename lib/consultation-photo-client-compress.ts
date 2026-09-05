/**
 * Klienta JPEG kompresija pirms augšupielādes (taupa servera vietu).
 * HEIC: ja pārlūks neatkodē, atgriežam oriģinālu — serveris konvertē.
 */

function isLikelyHeicImageFile(file: File): boolean {
  const type = (file.type ?? "").toLowerCase();
  if (type === "image/heic" || type === "image/heif") return true;
  return /\.hei[cf]$/i.test(file.name);
}

const TARGET_MAX_BYTES = 190_000;
const MAX_DIMENSION = 1680;
const HEIC_PASSTHROUGH_MAX_BYTES = 12 * 1024 * 1024;

function jpegBaseName(originalName: string): string {
  const base = originalName.replace(/\.[^.\\/]+$/i, "").trim() || "photo";
  return `${base}.jpg`;
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

function decodeViaHtmlImage(file: File): Promise<ImageBitmap> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      void createImageBitmap(img)
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
    /* HTMLImageElement bieži atver JPEG/PNG, ko createImageBitmap noraida. */
  }
  return decodeViaHtmlImage(file);
}

export async function compressImageFileToJpegForConsultation(file: File): Promise<File> {
  let bm: ImageBitmap | null = null;
  try {
    bm = await decodeFileToImageBitmap(file);
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
    if (isLikelyHeicImageFile(file) && file.size > 0 && file.size <= HEIC_PASSTHROUGH_MAX_BYTES) {
      return file;
    }
    throw e instanceof Error ? e : new Error("decode_failed");
  }
}
