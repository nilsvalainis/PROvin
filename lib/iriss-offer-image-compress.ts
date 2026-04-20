import type { IrissOfferAttachment } from "@/lib/iriss-pasutijumi-types";

/**
 * PDF šūna ir maza; serveris (`shrink-image-for-iriss-pdf`) tāpat samazina līdz ~800 px.
 * Šeit saspiežam pirms JSON, lai roaming/ārzemēs augšupielāde būtu pēc iespējas lēta (simti KB, ne MB).
 */
const MAX_LONG_EDGE = 800;
const TARGET_DECODED_BYTES = 250 * 1024;
const HARD_MAX_DECODED_BYTES = 720 * 1024;
const MAX_READ_BYTES = 12 * 1024 * 1024;

const JPEG_QUALITIES_DESC = [0.76, 0.68, 0.6, 0.54, 0.48, 0.44, 0.4, 0.36] as const;

function decodedApproxFromDataUrl(dataUrl: string): number {
  const i = dataUrl.indexOf(",");
  if (i < 0) return 0;
  return Math.floor(((dataUrl.length - i - 1) * 3) / 4);
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => {
      const s = typeof fr.result === "string" ? fr.result : "";
      if (!s) reject(new Error("empty_read"));
      else resolve(s);
    };
    fr.onerror = () => reject(new Error("read_error"));
    fr.readAsDataURL(file);
  });
}

/** Augstākā kvalitāte, kas vēl ietilpst TARGET; citādi zemākā, kas ietilpst HARD. */
function encodeCanvasToJpegDataUrl(canvas: HTMLCanvasElement): string {
  for (const q of JPEG_QUALITIES_DESC) {
    const url = canvas.toDataURL("image/jpeg", q);
    if (decodedApproxFromDataUrl(url) <= TARGET_DECODED_BYTES) return url;
  }
  for (let i = JPEG_QUALITIES_DESC.length - 1; i >= 0; i--) {
    const q = JPEG_QUALITIES_DESC[i]!;
    const url = canvas.toDataURL("image/jpeg", q);
    if (decodedApproxFromDataUrl(url) <= HARD_MAX_DECODED_BYTES) return url;
  }
  return canvas.toDataURL("image/jpeg", 0.32);
}

function shrinkAndEncodeUntilHardMax(initial: HTMLCanvasElement): string {
  let canvas = initial;
  for (let round = 0; round < 8; round++) {
    const url = encodeCanvasToJpegDataUrl(canvas);
    if (decodedApproxFromDataUrl(url) <= HARD_MAX_DECODED_BYTES) return url;
    const w = canvas.width;
    const h = canvas.height;
    const nw = Math.max(400, Math.floor(w * 0.85));
    const nh = Math.max(400, Math.floor(h * 0.85));
    if (nw >= w && nh >= h) return url;
    const next = document.createElement("canvas");
    next.width = nw;
    next.height = nh;
    const nctx = next.getContext("2d");
    if (!nctx) return url;
    nctx.drawImage(canvas, 0, 0, nw, nh);
    canvas = next;
  }
  return encodeCanvasToJpegDataUrl(canvas);
}

/**
 * Samazina rasterattēlus līdz tipiski ~200–450 KB (JPEG), saglabājot pietiekamu kvalitāti PDF šūnai.
 */
export async function fileToCompressedOfferAttachment(file: File): Promise<IrissOfferAttachment | null> {
  if (file.size > MAX_READ_BYTES) return null;

  const isRaster =
    file.type === "image/jpeg" ||
    file.type === "image/png" ||
    file.type === "image/webp" ||
    file.type === "image/gif" ||
    file.type === "image/heic" ||
    file.type === "image/heif" ||
    /^image\//i.test(file.type);

  if (!isRaster) {
    try {
      const dataUrl = await readFileAsDataUrl(file);
      return {
        id: crypto.randomUUID(),
        name: file.name,
        mimeType: file.type || "application/octet-stream",
        size: file.size,
        dataUrl,
      };
    } catch {
      return null;
    }
  }

  try {
    const bmp = await createImageBitmap(file).catch(() => null);
    if (!bmp) {
      const dataUrl = await readFileAsDataUrl(file);
      return {
        id: crypto.randomUUID(),
        name: file.name,
        mimeType: file.type || "image/jpeg",
        size: file.size,
        dataUrl,
      };
    }

    const w0 = bmp.width;
    const h0 = bmp.height;
    const scale = Math.min(1, MAX_LONG_EDGE / Math.max(w0, h0));
    const w = Math.max(1, Math.round(w0 * scale));
    const h = Math.max(1, Math.round(h0 * scale));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bmp.close();
      const dataUrl = await readFileAsDataUrl(file);
      return {
        id: crypto.randomUUID(),
        name: file.name,
        mimeType: file.type || "image/jpeg",
        size: file.size,
        dataUrl,
      };
    }
    ctx.drawImage(bmp, 0, 0, w, h);
    bmp.close();

    const dataUrl = shrinkAndEncodeUntilHardMax(canvas);
    const approxSize = decodedApproxFromDataUrl(dataUrl);
    const baseName = file.name.replace(/\.[^.]+$/, "") || "image";
    return {
      id: crypto.randomUUID(),
      name: `${baseName}.jpg`,
      mimeType: "image/jpeg",
      size: approxSize,
      dataUrl,
    };
  } catch {
    try {
      const dataUrl = await readFileAsDataUrl(file);
      return {
        id: crypto.randomUUID(),
        name: file.name,
        mimeType: file.type || "image/jpeg",
        size: file.size,
        dataUrl,
      };
    } catch {
      return null;
    }
  }
}
