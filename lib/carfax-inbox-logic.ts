import { isValidVin, normalizeVin } from "@/lib/order-field-validation";

/**
 * CARFAX pirkums caur Nila pārlūku + PDF automātiski no info@provin.lv pasta (tīrā loģika, bez servera).
 *
 * Plūsma: admin poga «Pirkt CARFAX» (apstiprinājums) -> atver carfax.eu priekšskatījumu ar VIN, kredītu izlieto Nils ->
 * CARFAX ~2 min vēlāk sūta vēstuli ar pielikumu «CARFAX - <VIN>.pdf» -> Apps Script (`processCarfaxPdfInbox`)
 * -> `/api/carfax/pdf-inbox` -> pasūtījums pēc VIN -> CARFAX bloks.
 */

/** carfax.eu bezmaksas priekšskatījums ar VIN (no turienes Nils izlieto kredītu). */
export const CARFAX_PREVIEW_URL = "https://www.carfax.eu/preview-page";
export const CARFAX_PURCHASE_CONFIRM_LV = "Tiks izlietots 1 CARFAX kredīts. Turpināt?";

/** Gaidīšanas stāvoklis blokā: cik ilgi pēc klikšķa rāda «Gaida CARFAX PDF no pasta…». */
export const CARFAX_PURCHASE_PENDING_MS = 24 * 60 * 60_000;
/** Pasūtījumu meklēšanas logs pēc VIN (CARFAX var pirkt arī vecākam pasūtījumam). */
export const CARFAX_INBOX_ORDER_WINDOW_MS = 120 * 24 * 60 * 60_000;
/** Klikšķis «Pirkt CARFAX» šajā logā dod pasūtījumam priekšroku. */
export const CARFAX_INBOX_REQUEST_WINDOW_MS = 3 * 24 * 60 * 60_000;
/** CARFAX PDF ir 0,9-3,9 MB; rezerve līdz 20 MB. */
export const CARFAX_INBOX_MAX_BYTES = 20 * 1024 * 1024;
/** Vercel pieprasījuma ķermenis ~4,5 MB -> Apps Script sūta PDF daļās pa ≤ 2,5 MB (base64 ~3,4 MB). */
export const CARFAX_INBOX_CHUNK_MAX_BYTES = 2.5 * 1024 * 1024;
export const CARFAX_INBOX_MAX_CHUNKS = 10;

export type CarfaxPurchaseRequest = {
  /** ISO laiks, kad nospiests «Pirkt CARFAX». */
  requestedAt: string;
  vin: string;
};

export function carfaxPreviewUrl(vin: string): string | null {
  const v = normalizeVin(vin);
  return isValidVin(v) ? `${CARFAX_PREVIEW_URL}?vin=${encodeURIComponent(v)}` : null;
}

export function normalizeCarfaxPurchaseRequest(raw: unknown): CarfaxPurchaseRequest | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const at = typeof o.requestedAt === "string" ? o.requestedAt.trim().slice(0, 40) : "";
  const vin = normalizeVin(typeof o.vin === "string" ? o.vin : "");
  if (!at || !Number.isFinite(Date.parse(at)) || !isValidVin(vin)) return undefined;
  return { requestedAt: at, vin };
}

/**
 * «Gaida CARFAX PDF no pasta…»: klikšķis bijis pēdējās 24 h un pēc tā vēl nav saņemts PDF.
 */
export function carfaxPurchasePending(
  block: { purchase?: CarfaxPurchaseRequest; report?: { pdf?: { savedAt?: string } } } | null | undefined,
  nowMs: number,
): boolean {
  const req = block?.purchase;
  if (!req) return false;
  const at = Date.parse(req.requestedAt);
  if (!Number.isFinite(at) || nowMs - at > CARFAX_PURCHASE_PENDING_MS) return false;
  const saved = Date.parse(block?.report?.pdf?.savedAt ?? "");
  return !(Number.isFinite(saved) && saved >= at);
}

/** VIN no pielikuma nosaukuma «CARFAX - <VIN>.pdf» (arī «CARFAX-<VIN>.pdf»). */
export function carfaxVinFromFileName(name: string): string {
  const m = String(name ?? "").trim().match(/^CARFAX\s*-\s*([A-HJ-NPR-Z0-9]{17})(?:\s*\(\d+\))?\.pdf$/i);
  return m ? normalizeVin(m[1]) : "";
}

export type CarfaxOrderCandidate = {
  id: string;
  createdMs: number;
  /** Pasūtījuma VIN (jebkurā formā; pasūtījuma, labotais, CSDD bloka). */
  vins: Array<string | null | undefined>;
  /** CARFAX bloka «Pirkt CARFAX» klikšķis. */
  purchase?: CarfaxPurchaseRequest | null;
};

export type CarfaxOrderMatch = { orderId: string; reason: "purchase_click" | "newest" } | null;

/**
 * Pasūtījums ar šo VIN. Priekšroka: pēdējās 3 dienās nospiests «Pirkt CARFAX» ar šo VIN (jaunākais klikšķis);
 * citādi jaunākais pasūtījums (120 dienu logā). null - nav.
 */
export function matchCarfaxPdfOrder(candidates: CarfaxOrderCandidate[], vinRaw: string, nowMs: number): CarfaxOrderMatch {
  const vin = normalizeVin(vinRaw);
  if (!isValidVin(vin)) return null;
  const withVin = candidates.filter(
    (c) =>
      c.createdMs <= nowMs + 60_000 &&
      nowMs - c.createdMs <= CARFAX_INBOX_ORDER_WINDOW_MS &&
      c.vins.some((k) => normalizeVin(String(k ?? "")) === vin),
  );
  const clicked = candidates
    .map((c) => ({ c, at: c.purchase && normalizeVin(c.purchase.vin) === vin ? Date.parse(c.purchase.requestedAt) : NaN }))
    .filter(({ at }) => Number.isFinite(at) && nowMs - at <= CARFAX_INBOX_REQUEST_WINDOW_MS && at <= nowMs + 60_000)
    .sort((a, b) => b.at - a.at);
  if (clicked[0]) return { orderId: clicked[0].c.id, reason: "purchase_click" };
  const newest = [...withVin].sort((a, b) => b.createdMs - a.createdMs)[0];
  return newest ? { orderId: newest.id, reason: "newest" } : null;
}

export type CarfaxInboxChunk = {
  /** Visa PDF md5 (hex) - augšupielādes ID un idempotences atslēga. */
  md5: string;
  fileName: string;
  index: number;
  count: number;
  bytes: Uint8Array;
  receivedAt: string;
  messageId: string;
};

/** Apps Script pieprasījuma ķermenis -> daļa vai kļūdas kods. */
export function parseCarfaxInboxChunk(body: Record<string, unknown>): CarfaxInboxChunk | { error: string } {
  const md5 = typeof body.md5 === "string" ? body.md5.trim().toLowerCase() : "";
  if (!/^[a-f0-9]{32}$/.test(md5)) return { error: "invalid_md5" };
  const fileName = typeof body.fileName === "string" ? body.fileName.trim().slice(0, 160) : "";
  const count = typeof body.chunkCount === "number" ? body.chunkCount : 1;
  const index = typeof body.chunkIndex === "number" ? body.chunkIndex : 0;
  if (!Number.isInteger(count) || count < 1 || count > CARFAX_INBOX_MAX_CHUNKS) return { error: "invalid_chunk" };
  if (!Number.isInteger(index) || index < 0 || index >= count) return { error: "invalid_chunk" };
  const b64 = typeof body.chunkBase64 === "string" ? body.chunkBase64 : typeof body.pdfBase64 === "string" ? body.pdfBase64 : "";
  const bytes = new Uint8Array(Buffer.from(b64, "base64"));
  if (bytes.byteLength === 0 || bytes.byteLength > CARFAX_INBOX_CHUNK_MAX_BYTES) return { error: "invalid_chunk_size" };
  const receivedAt =
    typeof body.receivedAt === "string" && Number.isFinite(Date.parse(body.receivedAt)) ? body.receivedAt.slice(0, 40) : "";
  const messageId = typeof body.messageId === "string" ? body.messageId.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 64) : "";
  return { md5, fileName, index, count, bytes, receivedAt, messageId };
}

export function isPdfBytes(bytes: Uint8Array): boolean {
  return bytes.byteLength >= 100 && String.fromCharCode(...bytes.slice(0, 5)) === "%PDF-";
}

export type CarfaxUnmatchedPdf = {
  md5: string;
  vin: string;
  fileName: string;
  size: number;
  receivedAt: string;
  savedAt: string;
};

export function parseCarfaxUnmatchedList(raw: unknown): CarfaxUnmatchedPdf[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((x): x is Record<string, unknown> => Boolean(x) && typeof x === "object")
    .map((x) => ({
      md5: typeof x.md5 === "string" ? x.md5 : "",
      vin: normalizeVin(typeof x.vin === "string" ? x.vin : ""),
      fileName: typeof x.fileName === "string" ? x.fileName.slice(0, 160) : "",
      size: typeof x.size === "number" && Number.isFinite(x.size) ? x.size : 0,
      receivedAt: typeof x.receivedAt === "string" ? x.receivedAt.slice(0, 40) : "",
      savedAt: typeof x.savedAt === "string" ? x.savedAt.slice(0, 40) : "",
    }))
    .filter((x) => /^[a-f0-9]{32}$/.test(x.md5) && isValidVin(x.vin));
}
