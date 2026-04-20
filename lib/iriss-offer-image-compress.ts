import type { IrissOfferAttachment } from "@/lib/iriss-pasutijumi-types";

const MAX_EDGE = 1920;
const JPEG_QUALITY = 0.82;
const MAX_READ_BYTES = 14 * 1024 * 1024;

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

/**
 * Samazina lielus rasterattēlus pirms saglabāšanas (ātrāka augšupielāde, mazāks JSON).
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
    const scale = Math.min(1, MAX_EDGE / Math.max(w0, h0));
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

    const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
    const approxSize = Math.round((dataUrl.length * 3) / 4);
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
