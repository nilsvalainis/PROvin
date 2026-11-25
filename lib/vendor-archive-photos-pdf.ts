import "server-only";

/**
 * Arhīva foto izvilkšana no AutoDNA / CarVertical PDF (1. fāze, 25.11).
 *
 * - CarVertical: sadaļā «Fotogrāfijas» - datums «07.2020.» (MM.GGGG), zem tā sīktēli (īsti JPEG ~400 px),
 *   «+9 foto». Bildes ņem bez pārkodēšanas, ja tās ir DCT plūsmas.
 * - AutoDNA: sadaļā «Transportlīdzekļa arhīva fotogrāfijas» - datums DD.MM.GGGG, «Fotogrāfijas N»,
 *   zem tā lapas ar vienu rasterizētu kolāžu (3 kolonnas, baltas spraugas) -> sadala flīzēs; skaitam jāsakrīt ar N.
 *
 * Grupēšana pēc pozīcijām (pdfjs teksts + bilžu CTM): bilde pieder pēdējam datumam virs tās; grupa beidzas
 * pie nākamā datuma vai pie virsraksta izmēra teksta (nākamā sadaļa). Logo / QR / ikonas atmet pēc izmēra un krāsām.
 */

import { existsSync } from "fs";
import { join } from "path";
import { pathToFileURL } from "url";
import { PDFDocument, PDFName, PDFRawStream, PDFRef } from "pdf-lib";
import sharp, { type ChannelStats } from "sharp";

import type { VendorArchiveSource } from "@/lib/vendor-archive-photo-group";

export const ARCHIVE_PHOTO_MAX_BYTES = 320 * 1024;
const ARCHIVE_PHOTO_MAX_SIDE = 1600;
const MAX_PHOTOS_PER_PDF = 150;
const MIN_PHOTO_W = 150;
const MIN_PHOTO_H = 90;

export type ExtractedArchivePhoto = { jpeg: Buffer; width: number; height: number };
export type ExtractedArchiveGroup = { date: string; expected?: number; photos: ExtractedArchivePhoto[] };
export type ArchivePhotoExtractResult = {
  source: VendorArchiveSource;
  groups: ExtractedArchiveGroup[];
  /** CarVertical «atradām 38 fotogrāfijas» - kopā tiešsaistes atskaitē. */
  totalExpected?: number;
  /** Admin piezīmes (skaita nesakritība, nav sadaļas u.c.). */
  notes: string[];
};

/** Bez diakritiķiem, mazie burti, viena atstarpe - «Fotogrāfijas» = «fotografijas». */
export function normArchiveText(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

const MONTH_DATE_RE = /^(0[1-9]|1[0-2])\.((?:19|20)\d{2})\.?$/;
const DAY_DATE_RE = /^(0[1-9]|[12]\d|3[01])\.(0[1-9]|1[0-2])\.((?:19|20)\d{2})\.?$/;

/** «07.2020.» -> «07.2020», «12.11.2024» -> «12.11.2024»; cits - null. */
export function parseArchiveGroupDate(raw: string): string | null {
  const t = raw.trim();
  if (MONTH_DATE_RE.test(t) || DAY_DATE_RE.test(t)) return t.replace(/\.$/, "");
  // «12.11.2024 · mobile.de» - datums rindas sākumā, īss paraksts aiz tā.
  if (t.length <= 40) {
    const head = /^(\d{2}\.\d{2}\.\d{4}|\d{2}\.\d{4})\.?(?=\s|$)/.exec(t)?.[1];
    if (head && (MONTH_DATE_RE.test(head) || DAY_DATE_RE.test(head))) return head;
  }
  return null;
}

function isSectionStart(source: VendorArchiveSource, norm: string): boolean {
  if (source === "autodna") return /arhiva fotografij|archiv\w* photo|zdjecia archiwalne/.test(norm);
  return /^fotografijas$|^photos$|^nuotraukos$|^fotod$/.test(norm);
}

/** «Fotogrāfijas 35» / «Fotogrāfijas: 35» / «35 fotogrāfijas». */
function parseCountText(norm: string): number | null {
  const m = /^(?:fotografijas|photos|zdjecia)\s*:?\s*(\d{1,3})$/.exec(norm) ?? /^(\d{1,3})\s+(?:fotografijas|photos)$/.exec(norm);
  return m ? Number(m[1]) : null;
}

function isIgnorableText(norm: string): boolean {
  return (
    norm === "" ||
    /^\+?\s*\d+\s*(foto|photos?)\.?$/.test(norm) ||
    /fotograf|photo/.test(norm) ||
    /^\d+(\s*\/\s*\d+)?$/.test(norm)
  );
}

type TextEv = { kind: "text"; page: number; y: number; x: number; raw: string; norm: string; size: number; margin: boolean };
type ImgEv = { kind: "image"; page: number; y: number; x: number; objId: string };
type Ev = TextEv | ImgEv;

type PdfJsModule = typeof import("pdfjs-dist/legacy/build/pdf.mjs");
let pdfjsPromise: Promise<PdfJsModule> | null = null;

async function loadPdfJs(): Promise<PdfJsModule> {
  if (!pdfjsPromise) {
    pdfjsPromise = import("pdfjs-dist/legacy/build/pdf.mjs").then((pdfjs) => {
      const workerPath = join(process.cwd(), "node_modules", "pdfjs-dist", "legacy", "build", "pdf.worker.mjs");
      if (existsSync(workerPath) && !pdfjs.GlobalWorkerOptions.workerSrc) {
        pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).href;
      }
      return pdfjs;
    });
  }
  return pdfjsPromise;
}

type DecodedImage = { width: number; height: number; kind?: number; data?: Uint8Array | Uint8ClampedArray; ref?: string | null };

function mul(a: number[], b: number[]): number[] {
  return [
    a[0]! * b[0]! + a[2]! * b[1]!,
    a[1]! * b[0]! + a[3]! * b[1]!,
    a[0]! * b[2]! + a[2]! * b[3]!,
    a[1]! * b[2]! + a[3]! * b[3]!,
    a[0]! * b[4]! + a[2]! * b[5]! + a[4]!,
    a[1]! * b[4]! + a[3]! * b[5]! + a[5]!,
  ];
}

/** Bez pārkodēšanas: DCT plūsma no PDF (ja bez maskas un ne CMYK). */
function rawJpegFromRef(doc: PDFDocument | null, refStr: string | null | undefined): Buffer | null {
  if (!doc || !refStr) return null;
  const m = /^(\d+)R(\d*)$/.exec(refStr);
  if (!m) return null;
  try {
    const obj = doc.context.lookup(PDFRef.of(Number(m[1]), m[2] ? Number(m[2]) : 0));
    if (!(obj instanceof PDFRawStream)) return null;
    const filter = obj.dict.lookup(PDFName.of("Filter"))?.toString() ?? "";
    if (filter !== "/DCTDecode" && filter !== "[ /DCTDecode ]" && filter !== "[/DCTDecode]") return null;
    if (obj.dict.get(PDFName.of("SMask")) || obj.dict.get(PDFName.of("Mask"))) return null;
    const cs = obj.dict.lookup(PDFName.of("ColorSpace"))?.toString() ?? "";
    if (/CMYK/i.test(cs)) return null;
    const buf = Buffer.from(obj.contents);
    return buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 ? buf : null;
  } catch {
    return null;
  }
}

async function decodedToJpeg(img: DecodedImage): Promise<Buffer | null> {
  const { width, height, data, kind } = img;
  if (!data || !width || !height) return null;
  const channels = kind === 3 ? 4 : kind === 2 ? 3 : 0;
  if (!channels || data.length < width * height * channels) return null;
  try {
    return await sharp(Buffer.from(data.buffer, data.byteOffset, width * height * channels), {
      raw: { width, height, channels },
    })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 90 })
      .toBuffer();
  } catch {
    return null;
  }
}

/** Fotogrāfija, nevis logo / QR / vienkrāsaina ikona. */
export async function looksLikePhoto(jpeg: Buffer): Promise<boolean> {
  try {
    const meta = await sharp(jpeg).metadata();
    const w = meta.width ?? 0;
    const h = meta.height ?? 0;
    if (w < MIN_PHOTO_W || h < MIN_PHOTO_H) return false;
    const ratio = w / h;
    if (ratio > 4 || ratio < 0.25) return false;
    const st = await sharp(jpeg).stats();
    const ch = st.channels;
    if (ch.length < 3) return false;
    const maxStdev = Math.max(...ch.slice(0, 3).map((c) => c.stdev));
    if (maxStdev < 8) return false;
    const [r, g, b] = ch as [ChannelStats, ChannelStats, ChannelStats];
    const gray =
      Math.abs(r.mean - g.mean) < 2 && Math.abs(g.mean - b.mean) < 2 && Math.abs(r.stdev - g.stdev) < 2 && Math.abs(g.stdev - b.stdev) < 2;
    return !gray;
  } catch {
    return false;
  }
}

/** ≤1600 px, ≤320 KB JPEG; jau derīgu JPEG nepārkodē. */
export async function normalizeArchiveJpeg(jpeg: Buffer): Promise<ExtractedArchivePhoto | null> {
  try {
    const meta = await sharp(jpeg).metadata();
    const w = meta.width ?? 0;
    const h = meta.height ?? 0;
    if (!w || !h) return null;
    if (meta.format === "jpeg" && jpeg.length <= ARCHIVE_PHOTO_MAX_BYTES && Math.max(w, h) <= ARCHIVE_PHOTO_MAX_SIDE && (meta.orientation ?? 1) === 1) {
      return { jpeg, width: w, height: h };
    }
    for (const quality of [88, 80, 72, 64]) {
      const { data, info } = await sharp(jpeg)
        .rotate()
        .resize({ width: ARCHIVE_PHOTO_MAX_SIDE, height: ARCHIVE_PHOTO_MAX_SIDE, fit: "inside", withoutEnlargement: true })
        .jpeg({ quality })
        .toBuffer({ resolveWithObject: true });
      if (data.length <= ARCHIVE_PHOTO_MAX_BYTES || quality === 64) return { jpeg: data, width: info.width, height: info.height };
    }
    return null;
  } catch {
    return null;
  }
}

type Tile = { left: number; top: number; width: number; height: number };

function blankRuns(n: number, isBlank: (i: number) => boolean, minLen: number): [number, number][] {
  const out: [number, number][] = [];
  let s = -1;
  for (let i = 0; i <= n; i++) {
    const blank = i === n || isBlank(i);
    if (!blank && s < 0) s = i;
    if (blank && s >= 0) {
      if (i - s >= minLen) out.push([s, i]);
      s = -1;
    }
  }
  return out;
}

/**
 * AutoDNA «masonry» kolāža: kolonnas atdala baltas vertikālas spraugas, flīzes kolonnā - horizontālas.
 * Atgriež flīzes secībā kolonna pēc kolonnas (kā AutoDNA lapā), ja tādas nav - visu bildi.
 */
export async function splitCollageTiles(jpeg: Buffer): Promise<Tile[]> {
  const { data, info } = await sharp(jpeg).greyscale().raw().toBuffer({ resolveWithObject: true });
  const W = info.width;
  const H = info.height;
  const white = (x: number, y: number) => data[y * W + x]! >= 245;
  const colBlank = (x: number) => {
    let c = 0;
    for (let y = 0; y < H; y++) if (!white(x, y)) c++;
    return c < H * 0.01;
  };
  const tiles: Tile[] = [];
  for (const [x0, x1] of blankRuns(W, colBlank, 40)) {
    const rowBlank = (y: number) => {
      let c = 0;
      for (let x = x0; x < x1; x++) if (!white(x, y)) c++;
      return c < (x1 - x0) * 0.02;
    };
    for (const [y0, y1] of blankRuns(H, rowBlank, 40)) tiles.push({ left: x0, top: y0, width: x1 - x0, height: y1 - y0 });
  }
  return tiles.length > 0 ? tiles : [{ left: 0, top: 0, width: W, height: H }];
}

async function collectEvents(
  pdfjs: PdfJsModule,
  bytes: Uint8Array,
  source: VendorArchiveSource,
): Promise<{ events: Ev[]; images: Map<string, DecodedImage>; startSize: number }> {
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(bytes), verbosity: 0, useSystemFonts: true }).promise;
  const events: Ev[] = [];
  const images = new Map<string, DecodedImage>();
  let started = false;
  let startSize = 0;
  let startPage = 0;
  try {
    for (let p = 1; p <= pdf.numPages; p++) {
      if (started && p - startPage > 8) break;
      const page = await pdf.getPage(p);
      const vp = page.getViewport({ scale: 1 });
      const H = vp.height;
      const tc = await page.getTextContent();
      const texts: TextEv[] = [];
      for (const it of tc.items) {
        if (!("str" in it) || !it.str.trim()) continue;
        const tr = it.transform as number[];
        const size = Math.hypot(tr[2] ?? 0, tr[3] ?? 0) || (it as { height?: number }).height || 0;
        const y = H - (tr[5] ?? 0);
        texts.push({ kind: "text", page: p, y, x: tr[4] ?? 0, raw: it.str.trim(), norm: normArchiveText(it.str), size, margin: y < H * 0.05 || y > H * 0.95 });
      }
      const startHere = !started ? texts.find((t) => isSectionStart(source, t.norm)) : undefined;
      if (!started && !startHere) {
        page.cleanup();
        continue;
      }
      if (startHere) {
        started = true;
        startSize = startHere.size;
        startPage = p;
      }
      const ops = await page.getOperatorList();
      let ctm = [1, 0, 0, 1, 0, 0];
      const stack: number[][] = [];
      for (let i = 0; i < ops.fnArray.length; i++) {
        const fn = ops.fnArray[i];
        const args = ops.argsArray[i] as unknown[];
        if (fn === pdfjs.OPS.save) stack.push(ctm);
        else if (fn === pdfjs.OPS.restore) ctm = stack.pop() ?? ctm;
        else if (fn === pdfjs.OPS.transform) ctm = mul(ctm, args as number[]);
        else if (fn === pdfjs.OPS.paintImageXObject) {
          const objId = String(args[0]);
          const top = H - (ctm[5]! + Math.max(ctm[3]!, 0));
          events.push({ kind: "image", page: p, y: top, x: ctm[4]!, objId: `${p}:${objId}` });
          if (!images.has(`${p}:${objId}`)) {
            const obj = await new Promise<DecodedImage | null>((resolve) => {
              try {
                const store = objId.startsWith("g_") ? page.commonObjs : page.objs;
                store.get(objId, (o: unknown) => resolve((o as DecodedImage) ?? null));
              } catch {
                resolve(null);
              }
            });
            if (obj) images.set(`${p}:${objId}`, { width: obj.width, height: obj.height, kind: obj.kind, data: obj.data, ref: obj.ref ?? null });
          }
        }
      }
      events.push(...texts);
      page.cleanup();
    }
  } finally {
    await pdf.destroy().catch(() => undefined);
  }
  events.sort((a, b) => a.page - b.page || a.y - b.y || a.x - b.x);
  return { events, images, startSize };
}

/** Pēc pozīcijām: datums -> bildes zem tā; beidzas pie nākamā datuma vai nākamās sadaļas virsraksta. */
function groupEvents(
  events: Ev[],
  source: VendorArchiveSource,
  startSize: number,
): { groups: { date: string; expected?: number; images: string[] }[]; totalExpected?: number } {
  const groups: { date: string; expected?: number; images: string[] }[] = [];
  let totalExpected: number | undefined;
  let started = false;
  let cur: (typeof groups)[number] | null = null;
  let pendingCountLabel = false;
  for (const ev of events) {
    if (ev.kind === "text") {
      if (!started) {
        if (isSectionStart(source, ev.norm)) started = true;
        continue;
      }
      if (ev.margin) continue;
      const date = parseArchiveGroupDate(ev.raw);
      if (date) {
        cur = { date, images: [] };
        groups.push(cur);
        pendingCountLabel = false;
        continue;
      }
      const count = parseCountText(ev.norm);
      if (count != null) {
        if (cur && !cur.expected) cur.expected = count;
        continue;
      }
      if (pendingCountLabel && /^\d{1,3}$/.test(ev.norm)) {
        if (cur && !cur.expected) cur.expected = Number(ev.norm);
        pendingCountLabel = false;
        continue;
      }
      pendingCountLabel = /^(fotografijas|photos)\s*:?$/.test(ev.norm);
      const total = /(\d{1,3})\s+(?:fotografij|photos)/.exec(ev.norm);
      if (total && groups.length === 0 && totalExpected == null) totalExpected = Number(total[1]);
      if (isSectionStart(source, ev.norm) || isIgnorableText(ev.norm)) continue;
      // Nākamās sadaļas virsraksts -> foto sadaļa beigusies.
      if (startSize > 0 && ev.size >= startSize * 0.85 && groups.length > 0) break;
      continue;
    }
    if (started && cur) cur.images.push(ev.objId);
  }
  return { groups: groups.filter((g) => g.images.length > 0), totalExpected };
}

export async function extractVendorArchivePhotos(
  source: VendorArchiveSource,
  bytes: Uint8Array,
): Promise<ArchivePhotoExtractResult> {
  const notes: string[] = [];
  const pdfjs = await loadPdfJs();
  const { events, images, startSize } = await collectEvents(pdfjs, bytes, source);
  const { groups: raw, totalExpected } = groupEvents(events, source, startSize);
  if (raw.length === 0) {
    return { source, groups: [], ...(totalExpected ? { totalExpected } : {}), notes: ["Arhīva foto sadaļa PDF nav atrasta vai tajā nav bilžu."] };
  }
  let libDoc: PDFDocument | null = null;
  try {
    libDoc = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
  } catch {
    libDoc = null;
  }
  const out: ExtractedArchiveGroup[] = [];
  let total = 0;
  for (const g of raw) {
    const photos: ExtractedArchivePhoto[] = [];
    for (const objId of g.images) {
      if (total >= MAX_PHOTOS_PER_PDF) break;
      const img = images.get(objId);
      if (!img) continue;
      const base = rawJpegFromRef(libDoc, img.ref) ?? (await decodedToJpeg(img));
      if (!base) continue;
      const pieces: Buffer[] = [];
      if (source === "autodna") {
        const tiles = await splitCollageTiles(base);
        for (const t of tiles) {
          if (tiles.length === 1) pieces.push(base);
          else pieces.push(await sharp(base).extract(t).jpeg({ quality: 90 }).toBuffer());
        }
      } else {
        pieces.push(base);
      }
      for (const piece of pieces) {
        if (total >= MAX_PHOTOS_PER_PDF) break;
        if (!(await looksLikePhoto(piece))) continue;
        const norm = await normalizeArchiveJpeg(piece);
        if (!norm) continue;
        photos.push(norm);
        total++;
      }
    }
    if (photos.length === 0) continue;
    if (g.expected && g.expected !== photos.length) {
      notes.push(`${g.date}: atskaitē ${g.expected} foto, nolasīti ${photos.length}.`);
    }
    out.push({ date: g.date, ...(g.expected ? { expected: g.expected } : {}), photos });
  }
  if (source === "carvertical" && totalExpected && totalExpected > total) {
    notes.push(`Atskaitē ${totalExpected} foto, PDF ir ${total} - pārējās tikai tiešsaistes atskaitē.`);
  }
  if (out.length === 0) notes.push("Arhīva foto sadaļā nav nolasāmu fotogrāfiju.");
  return { source, groups: out, ...(totalExpected ? { totalExpected } : {}), notes };
}
