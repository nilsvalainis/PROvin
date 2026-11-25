import "server-only";

/**
 * AutoDNA PDF -> «Iepriekšējie meklējumi» rindas + kartes sīktēli (pdfjs teksts ar pozīcijām + attēli).
 * Nekad nemet: kļūdas gadījumā mēģina tikai teksta parsētāju, citādi tukšs saraksts.
 */

import { existsSync } from "fs";
import { join } from "path";
import { pathToFileURL } from "url";
import sharp from "sharp";

import {
  AUTODNA_SEARCH_MAP_MAX_CHARS,
  isAutodnaPreviousSearchesHeading,
  parseAutodnaPreviousSearchesFromItems,
  parseAutodnaPreviousSearchesFromText,
  type AutodnaPreviousSearch,
  type PositionedImage,
  type PositionedText,
} from "@/lib/autodna-previous-searches";

type PdfJsModule = typeof import("pdfjs-dist/legacy/build/pdf.mjs");
type DecodedImage = { width: number; height: number; kind?: number; data?: Uint8Array | Uint8ClampedArray };

async function loadPdfJs(): Promise<PdfJsModule> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const workerPath = join(process.cwd(), "node_modules", "pdfjs-dist", "legacy", "build", "pdf.worker.mjs");
  if (existsSync(workerPath) && !pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).href;
  }
  return pdfjs;
}

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

async function mapToDataUrl(img: DecodedImage | undefined): Promise<string> {
  if (!img?.data || !img.width || !img.height) return "";
  const px = img.width * img.height;
  const channels = img.data.length >= px * 4 ? 4 : img.data.length >= px * 3 ? 3 : img.data.length >= px ? 1 : 0;
  if (!channels) return "";
  try {
    const jpeg = await sharp(Buffer.from(img.data), { raw: { width: img.width, height: img.height, channels: channels as 1 | 3 | 4 } })
      .flatten({ background: "#ffffff" })
      .resize({ width: Math.min(img.width * 2, 360), withoutEnlargement: false })
      .jpeg({ quality: 82 })
      .toBuffer();
    const url = `data:image/jpeg;base64,${jpeg.toString("base64")}`;
    return url.length <= AUTODNA_SEARCH_MAP_MAX_CHARS ? url : "";
  } catch {
    return "";
  }
}

export async function extractAutodnaPreviousSearches(pdfBytes: Uint8Array, fallbackText = ""): Promise<AutodnaPreviousSearch[]> {
  try {
    const pdfjs = await loadPdfJs();
    const pdf = await pdfjs.getDocument({ data: new Uint8Array(pdfBytes), verbosity: 0, useSystemFonts: true }).promise;
    const texts: PositionedText[] = [];
    const images: PositionedImage[] = [];
    const decoded = new Map<string, DecodedImage>();
    let headPage = 0;
    try {
      for (let p = 1; p <= pdf.numPages; p++) {
        if (headPage && p > headPage + 1) break;
        const page = await pdf.getPage(p);
        const H = page.getViewport({ scale: 1 }).height;
        const tc = await page.getTextContent();
        const pageTexts: PositionedText[] = [];
        for (const it of tc.items) {
          if (!("str" in it) || !it.str.trim()) continue;
          const tr = it.transform as number[];
          pageTexts.push({ page: p, x: tr[4] ?? 0, y: H - (tr[5] ?? 0), str: it.str.trim(), size: Math.hypot(tr[2] ?? 0, tr[3] ?? 0) });
        }
        // Īstā sadaļa, ne «Pārskata navigācija» (tur aiz virsraksta seko «Ierakstu skaits: N»).
        pageTexts.sort((a, b) => a.y - b.y || a.x - b.x);
        const hasHead = pageTexts.some(
          (t, i) => isAutodnaPreviousSearchesHeading(t.str) && !/^(ierakstu skaits|number of records|liczba)/i.test(pageTexts[i + 1]?.str ?? ""),
        );
        if (!headPage && !hasHead) {
          page.cleanup();
          continue;
        }
        if (!headPage) headPage = p;
        texts.push(...pageTexts);
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
            const w = Math.abs(ctm[0]!);
            const h = Math.abs(ctm[3]!);
            // Kartes sīktēls: plats, zems (~88×21 pt); logo / ikonas atmet.
            if (w < 40 || w < h * 1.6 || h < 8) continue;
            const id = `${p}:${objId}`;
            images.push({ page: p, x: ctm[4]!, y: H - (ctm[5]! + ctm[3]!), w, h, id });
            if (!decoded.has(id)) {
              const obj = await new Promise<DecodedImage | null>((resolve) => {
                try {
                  (objId.startsWith("g_") ? page.commonObjs : page.objs).get(objId, (o: unknown) => resolve((o as DecodedImage) ?? null));
                } catch {
                  resolve(null);
                }
              });
              if (obj) decoded.set(id, obj);
            }
          }
        }
        page.cleanup();
      }
    } finally {
      await pdf.destroy().catch(() => undefined);
    }
    const { rows, mapIds } = parseAutodnaPreviousSearchesFromItems(texts, images);
    if (!rows.length) return fallbackText ? parseAutodnaPreviousSearchesFromText(fallbackText) : [];
    const out: AutodnaPreviousSearch[] = [];
    for (let i = 0; i < rows.length; i++) {
      const map = mapIds[i] ? await mapToDataUrl(decoded.get(mapIds[i]!)) : "";
      out.push({ ...rows[i]!, ...(map ? { map } : {}) });
    }
    return out;
  } catch (e) {
    console.warn("[autodna-previous-searches] pdf parse failed", e instanceof Error ? e.message.slice(0, 120) : "unknown");
    return fallbackText ? parseAutodnaPreviousSearchesFromText(fallbackText) : [];
  }
}
