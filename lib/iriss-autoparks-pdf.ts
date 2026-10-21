import "server-only";

import { PDFDocument } from "pdf-lib";
import sharp from "sharp";

/** A4 platums punktos; skenētā lapa tiek ielikta A4 ar nelielu malu. */
const A4_W = 595.28;
const A4_H = 841.89;
const MARGIN = 18;

/** Telefona foto (JPEG/PNG/WebP/HEIC, ja sharp to atbalsta) -> viena lapa A4 PDF. Pagriež pēc EXIF. */
export async function imagesToPdf(images: readonly Buffer[]): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  for (const raw of images) {
    const jpeg = await sharp(raw).rotate().resize({ width: 2200, height: 2200, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer();
    const img = await pdf.embedJpg(jpeg);
    const landscape = img.width > img.height;
    const pageW = landscape ? A4_H : A4_W;
    const pageH = landscape ? A4_W : A4_H;
    const scale = Math.min((pageW - MARGIN * 2) / img.width, (pageH - MARGIN * 2) / img.height);
    const w = img.width * scale;
    const h = img.height * scale;
    const page = pdf.addPage([pageW, pageH]);
    page.drawImage(img, { x: (pageW - w) / 2, y: (pageH - h) / 2, width: w, height: h });
  }
  return Buffer.from(await pdf.save());
}

/** Vairāki PDF vienā failā (secība saglabāta). Bojātu failu izlaiž, nevis aptur visu. */
export async function mergePdfs(files: readonly Buffer[]): Promise<{ bytes: Buffer; skipped: number }> {
  const out = await PDFDocument.create();
  let skipped = 0;
  for (const bytes of files) {
    try {
      const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const pages = await out.copyPages(src, src.getPageIndices());
      for (const p of pages) out.addPage(p);
    } catch {
      skipped += 1;
    }
  }
  return { bytes: Buffer.from(await out.save()), skipped };
}
