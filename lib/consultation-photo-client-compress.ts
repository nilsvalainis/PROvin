/**
 * Klienta JPEG kompresija pirms augšupielādes (taupa servera vietu).
 * HEIC/EXIF: atkarīgs no `createImageBitmap` — Safari/iOS parasti atvērs; citādi `decode_failed`.
 */

const TARGET_MAX_BYTES = 190_000;
const MAX_DIMENSION = 1680;

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

export async function compressImageFileToJpegForConsultation(file: File): Promise<File> {
  let bm: ImageBitmap;
  try {
    bm = await createImageBitmap(file);
  } catch {
    throw new Error("decode_failed");
  }
  try {
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

    const blob = await blobUnderMaxBytes(canvas, TARGET_MAX_BYTES);
    return new File([blob], jpegBaseName(file.name), {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  } catch (e) {
    try {
      bm.close();
    } catch {
      /* ignore */
    }
    throw e;
  }
}
