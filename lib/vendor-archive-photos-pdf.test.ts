import { describe, expect, it } from "vitest";
import { PDFDocument, StandardFonts, type PDFPage, type PDFFont } from "pdf-lib";
import sharp, { type OverlayOptions } from "sharp";

import { dhashImage } from "@/lib/photo-dhash";
import { dhashDistance } from "@/lib/vendor-archive-photo-group";
import {
  extractVendorArchivePhotos,
  normArchiveText,
  parseArchiveGroupDate,
  splitCollageTiles,
} from "@/lib/vendor-archive-photos-pdf";

/** Mākslīga «fotogrāfija»: krāsains troksnis + figūra (katram seed cita). */
async function fakePhoto(seed: number, w = 400, h = 220): Promise<Buffer> {
  const bg = { r: (seed * 53) % 255, g: (seed * 97) % 255, b: (seed * 151) % 255 };
  const svg = `<svg width="${w}" height="${h}"><rect x="${(seed * 37) % (w - 80)}" y="${(seed * 23) % (h - 60)}" width="80" height="60" fill="rgb(${255 - bg.r},${bg.b},${bg.g})"/><circle cx="${w - 40 - ((seed * 31) % 100)}" cy="${h / 2}" r="${30 + (seed % 20)}" fill="#203040"/></svg>`;
  return sharp({ create: { width: w, height: h, channels: 3, background: bg } })
    .composite([{ input: Buffer.from(svg) }])
    .jpeg({ quality: 85 })
    .toBuffer();
}

/** Melnbalts «QR» - jāizmet. */
async function fakeQr(): Promise<Buffer> {
  const cells: string[] = [];
  for (let i = 0; i < 12; i++) for (let j = 0; j < 12; j++) if ((i * 7 + j * 3) % 5 < 2) cells.push(`<rect x="${i * 15}" y="${j * 15}" width="15" height="15" fill="#000"/>`);
  return sharp({ create: { width: 180, height: 180, channels: 3, background: "#ffffff" } })
    .composite([{ input: Buffer.from(`<svg width="180" height="180">${cells.join("")}</svg>`) }])
    .jpeg()
    .toBuffer();
}

async function drawJpeg(doc: PDFDocument, page: PDFPage, jpeg: Buffer, x: number, top: number, w: number, h: number) {
  const img = await doc.embedJpg(jpeg);
  page.drawImage(img, { x, y: page.getHeight() - top - h, width: w, height: h });
}

function text(page: PDFPage, font: PDFFont, s: string, x: number, top: number, size: number) {
  page.drawText(s, { x, y: page.getHeight() - top, size, font });
}

async function carverticalPdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const p1 = doc.addPage([595, 842]);
  await drawJpeg(doc, p1, await fakePhoto(1), 30, 30, 120, 66); // vāks - virs sadaļas
  text(p1, font, "Fotografijas", 30, 200, 18);
  text(p1, font, "Mes atradam 38 fotografijas. Noskene QR kodu", 30, 225, 9);
  await drawJpeg(doc, p1, await fakeQr(), 450, 210, 60, 60);
  text(p1, font, "07.2020.", 30, 290, 10);
  await drawJpeg(doc, p1, await fakePhoto(1), 30, 300, 160, 88);
  await drawJpeg(doc, p1, await fakePhoto(2), 200, 300, 160, 88);
  await drawJpeg(doc, p1, await fakePhoto(3), 370, 300, 160, 88);
  text(p1, font, "+9 foto", 30, 400, 9);
  text(p1, font, "07.2020.", 30, 440, 10);
  // Tā pati bilde ar citu kompresiju un izmēru -> dublikāts importā (te vēl paliek).
  await drawJpeg(doc, p1, await sharp(await fakePhoto(2)).resize(380).jpeg({ quality: 60 }).toBuffer(), 30, 450, 160, 88);
  const p2 = doc.addPage([595, 842]);
  await drawJpeg(doc, p2, await fakePhoto(4), 30, 60, 160, 88);
  text(p2, font, "Nobraukums", 30, 300, 18);
  await drawJpeg(doc, p2, await fakePhoto(9), 30, 320, 160, 88);
  return doc.save();
}

/** AutoDNA kolāža: 3 kolonnas pa 215 px, baltas spraugas, flīzes dažādos augstumos. */
async function collage(tileSeeds: number[][]): Promise<Buffer> {
  const colW = 215;
  const gap = 12;
  const heights = [132, 225, 287];
  const W = colW * 3 + gap * 4;
  const composites: OverlayOptions[] = [];
  let H = 0;
  for (let c = 0; c < tileSeeds.length; c++) {
    let y = gap;
    for (let i = 0; i < tileSeeds[c]!.length; i++) {
      const h = heights[(c + i) % 3]!;
      composites.push({ input: await fakePhoto(tileSeeds[c]![i]!, colW, h), left: gap + c * (colW + gap), top: y });
      y += h + gap;
    }
    H = Math.max(H, y);
  }
  return sharp({ create: { width: W, height: H, channels: 3, background: "#ffffff" } }).composite(composites).jpeg({ quality: 92 }).toBuffer();
}

async function autodnaPdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const p1 = doc.addPage([595, 842]);
  text(p1, font, "Transportlidzekla arhiva fotografijas", 30, 60, 16);
  text(p1, font, "12.11.2024", 30, 90, 10);
  text(p1, font, "Fotografijas 5", 30, 105, 9);
  const c1 = await collage([[11, 12], [13, 14], [15]]);
  const m1 = await sharp(c1).metadata();
  await drawJpeg(doc, p1, c1, 30, 120, 520, (520 * m1.height!) / m1.width!);
  const p2 = doc.addPage([595, 842]);
  text(p2, font, "03.01.2022", 30, 60, 10);
  text(p2, font, "Fotografijas", 30, 75, 9);
  text(p2, font, "2", 110, 75, 9);
  const c2 = await collage([[21], [22]]);
  const m2 = await sharp(c2).metadata();
  await drawJpeg(doc, p2, c2, 30, 90, 520, (520 * m2.height!) / m2.width!);
  text(p2, font, "Lietosanas noteikumi", 30, 700, 16);
  return doc.save();
}

describe("vendor-archive-photos-pdf", () => {
  it("datumu un teksta normalizācija", () => {
    expect(parseArchiveGroupDate("07.2020.")).toBe("07.2020");
    expect(parseArchiveGroupDate("12.11.2024")).toBe("12.11.2024");
    expect(parseArchiveGroupDate("12.11.2024 mobile.de")).toBe("12.11.2024");
    expect(parseArchiveGroupDate("13.2020")).toBeNull();
    expect(parseArchiveGroupDate("Nobraukums 07.2020")).toBeNull();
    expect(normArchiveText("Transportlīdzekļa arhīva Fotogrāfijas")).toBe("transportlidzekla arhiva fotografijas");
  });

  it("CarVertical: grupas pēc datuma, bez vāka / QR / nākamās sadaļas", async () => {
    const res = await extractVendorArchivePhotos("carvertical", await carverticalPdf());
    expect(res.groups.map((g) => [g.date, g.photos.length])).toEqual([
      ["07.2020", 3],
      ["07.2020", 2],
    ]);
    expect(res.totalExpected).toBe(38);
    expect(res.notes.join(" ")).toContain("38");
    for (const g of res.groups) for (const p of g.photos) expect(p.jpeg.subarray(0, 2).toString("hex")).toBe("ffd8");
    // Otrās grupas pirmā = pirmās grupas otrā bilde (cita kompresija) -> dHash tuvu.
    const a = await dhashImage(res.groups[0]!.photos[1]!.jpeg);
    const b = await dhashImage(res.groups[1]!.photos[0]!.jpeg);
    expect(dhashDistance(a!, b!)).toBeLessThanOrEqual(10);
    const c = await dhashImage(res.groups[0]!.photos[0]!.jpeg);
    expect(dhashDistance(a!, c!)).toBeGreaterThan(10);
  });

  it("AutoDNA: kolāžu sadala flīzēs, skaits sakrīt ar «Fotogrāfijas N»", async () => {
    const res = await extractVendorArchivePhotos("autodna", await autodnaPdf());
    expect(res.groups.map((g) => [g.date, g.expected, g.photos.length])).toEqual([
      ["12.11.2024", 5, 5],
      ["03.01.2022", 2, 2],
    ]);
    expect(res.notes).toEqual([]);
    for (const p of res.groups[0]!.photos) expect(p.width).toBeGreaterThanOrEqual(200);
  });

  it("kolāžas sadalīšana", async () => {
    const tiles = await splitCollageTiles(await collage([[1, 2, 3], [4, 5], [6]]));
    expect(tiles).toHaveLength(6);
  });

  it("PDF bez arhīva sadaļas - tukšs ar piezīmi", async () => {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const p = doc.addPage([595, 842]);
    text(p, font, "Nobraukums", 30, 60, 16);
    await drawJpeg(doc, p, await fakePhoto(5), 30, 100, 160, 88);
    const res = await extractVendorArchivePhotos("carvertical", await doc.save());
    expect(res.groups).toEqual([]);
    expect(res.notes[0]).toMatch(/nav atrasta/);
  });
});
