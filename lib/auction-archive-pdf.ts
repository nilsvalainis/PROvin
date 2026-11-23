import "server-only";

import { adminGenerateJsonText } from "@/lib/admin-ai-dispatch";
import { readAuctionArchiveOffer, readAuctionArchivePhoto, writeAuctionArchivePdf } from "@/lib/auction-archive-offer-store";
import { loadAuctionArchiveOrderContext } from "@/lib/auction-archive-offer-service";
import {
  auctionArchiveDescriptions,
  auctionArchivePdfFilename,
  buildAuctionArchivePdfHtml,
} from "@/lib/auction-archive-pdf-html";
import { isUsefulThecarapiRecord } from "@/lib/auction-archive-offer";
import { shrinkAuctionArchivePdfPhoto } from "@/lib/auction-archive-offer-photos";
import { renderReportHtmlToPdf } from "@/lib/report-pdf-server";

const TRANSLATE_SYSTEM = `You translate used-car auction descriptions into Latvian for a vehicle history report.
Return ONLY a JSON object with the same keys and the Latvian translation as values.
Translate faithfully, keep numbers, units, model names and codes unchanged, do not add or remove facts,
no advice, no notes. Use a short dash "-" (never long dashes). If a value is already Latvian, return it unchanged.`;

/** Apraksti → latviski vienā AI izsaukumā (Gemini Flash). Kļūda - PDF ar oriģinālu bez tulkojuma. */
export async function translateAuctionArchiveTexts(texts: readonly string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const unique = [...new Set(texts.map((t) => t.trim()).filter(Boolean))].slice(0, 30);
  if (unique.length === 0) return out;
  const source = Object.fromEntries(unique.map((t, i) => [`t${i}`, t]));
  try {
    const raw = await adminGenerateJsonText({
      modelTier: "gemini-flash",
      systemInstruction: TRANSLATE_SYSTEM,
      userPrompt: JSON.stringify(source),
      temperature: 0.1,
    });
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    const parsed = JSON.parse(start >= 0 && end > start ? raw.slice(start, end + 1) : raw) as Record<string, unknown>;
    unique.forEach((t, i) => {
      const v = parsed[`t${i}`];
      if (typeof v === "string" && v.trim()) out.set(t, v.replace(/[–—]/g, "-").trim().slice(0, 2400));
    });
  } catch (e) {
    console.warn("[auction-archive-pdf] tulkojums izlaists", e instanceof Error ? e.message.slice(0, 120) : "error");
  }
  return out;
}

export type AuctionArchivePdfResult = {
  pdf: Buffer;
  filename: string;
  photos: number;
  missingPhotos: number;
  /** Laiks ms: bildes (lasīšana + samazināšana) un Chromium renderis - Vercel budžeta uzraudzībai. */
  timings: { photosMs: number; renderMs: number; htmlBytes: number };
};

/** Bilžu apstrāde paralēli - sharp ir CPU smags, 4 vienlaikus pietiek (3008 MB funkcija). */
const PHOTO_PARALLEL = 4;

/**
 * Servera PDF (Chromium + Inter, kā dīlera atskaite): visas pasūtījuma mapē saglabātās bildes kā data: URI.
 * Saglabā `auction_archive_offers/<sessionId>/izsolu-arhivs.pdf` (tas pats fails, kas aiziet klientam).
 */
export async function buildAuctionArchivePdf(
  sessionId: string,
  opts: { preparedFor?: string; showPrices?: boolean } = {},
): Promise<AuctionArchivePdfResult> {
  const t0 = Date.now();
  const [doc, ctx] = await Promise.all([readAuctionArchiveOffer(sessionId), loadAuctionArchiveOrderContext(sessionId)]);
  if (!doc) throw new Error("no_offer");
  const records = (ctx?.block?.thecarapiRecords ?? []).filter(isUsefulThecarapiRecord);
  const dataUrls = new Map<string, string>();
  let next = 0;
  const work = async () => {
    while (next < doc.photos.length) {
      const p = doc.photos[next]!;
      next += 1;
      const raw = await readAuctionArchivePhoto(sessionId, p.id).catch(() => null);
      // Samazina pirms base64 (oriģināli 2-4 MB × 84 = simtiem MB HTML Chromium atmiņā).
      const buf = raw ? await shrinkAuctionArchivePdfPhoto(raw) : null;
      if (buf) dataUrls.set(p.id, `data:image/jpeg;base64,${buf.toString("base64")}`);
    }
  };
  await Promise.all(Array.from({ length: Math.min(PHOTO_PARALLEL, doc.photos.length) }, work));
  const photosMs = Date.now() - t0;
  const translations = await translateAuctionArchiveTexts(records.flatMap(auctionArchiveDescriptions));
  const html = buildAuctionArchivePdfHtml({
    summary: doc.summary,
    records,
    photos: doc.photos,
    dataUrls,
    translations,
    marks: doc.marks,
    preparedFor: opts.preparedFor,
    showPrices: opts.showPrices ?? doc.showPrices === true,
  });
  const photoCount = dataUrls.size;
  dataUrls.clear();
  const r = await renderReportHtmlToPdf(html);
  const pdf = Buffer.from(r.pdf);
  await writeAuctionArchivePdf(sessionId, pdf);
  return {
    pdf,
    filename: auctionArchivePdfFilename(doc.summary.vin),
    photos: photoCount,
    missingPhotos: doc.photos.length - photoCount,
    timings: { photosMs, renderMs: r.ms, htmlBytes: html.length },
  };
}
