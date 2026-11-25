import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";

import { del } from "@vercel/blob";

import { sendAdminPush } from "@/lib/admin-push";
import { listAdminOrders } from "@/lib/admin-orders";
import { getOrderDraftBlobConfig, patchOrderDraft, readOrderDraft } from "@/lib/admin-order-draft-store";
import {
  createDefaultSourceBlocks,
  mergeSourceBlocksWithDefaults,
  type CarfaxBlockState,
  type CsddFormFields,
} from "@/lib/admin-source-blocks";
import {
  CARFAX_INBOX_MAX_BYTES,
  CARFAX_INBOX_ORDER_WINDOW_MS,
  carfaxVinFromFileName,
  isPdfBytes,
  matchCarfaxPdfOrder,
  parseCarfaxUnmatchedList,
  type CarfaxInboxChunk,
  type CarfaxOrderCandidate,
  type CarfaxUnmatchedPdf,
} from "@/lib/carfax-inbox-logic";
import { saveCarfaxOriginalPdf } from "@/lib/carfax-pdf-store";
import { applyCarfaxReportObject } from "@/lib/carfax-report";
import { looksLikeCarfaxReport, parseCarfaxReportText, type CarfaxReport } from "@/lib/carfax-report-parse";
import { readVendorAutoRaw, writeVendorAutoRaw } from "@/lib/carvertical-auto-store";
import { extractBearerToken } from "@/lib/iriss-aivars-api-token";
import { isValidVin, normalizeVin } from "@/lib/order-field-validation";
import { extractPdfTextDetailed } from "@/lib/pdf-text-extract-server";

/**
 * CARFAX PDF no info@provin.lv pasta (Apps Script `processCarfaxPdfInbox` -> `/api/carfax/pdf-inbox`).
 * Krātuve (tā pati, kur pasūtījumu melnraksti, privāts Blob):
 *   carfax_inbox/chunks/{md5}/{i}.bin - PDF daļas (Vercel ķermeņa limits ~4,5 MB), pēc salikšanas dzēš
 *   carfax_inbox/seen/{md5}.json      - idempotence: kur PDF jau ielikts
 *   carfax_inbox/unmatched/{md5}.pdf  - PDF bez pasūtījuma (neko nemet; adminā CARFAX blokā «Pievienot»)
 *   carfax_inbox/_unmatched.json      - nepiesaistīto saraksts
 */

const DIR = "carfax_inbox";
const LOG = "[carfax-inbox]";

const chunkPath = (md5: string, i: number) => `${DIR}/chunks/${md5}/${i}.bin`;
const seenPath = (md5: string) => `${DIR}/seen/${md5}.json`;
const unmatchedPdfPath = (md5: string) => `${DIR}/unmatched/${md5}.pdf`;
const UNMATCHED_INDEX = `${DIR}/_unmatched.json`;

export function md5Hex(bytes: Uint8Array): string {
  return createHash("md5").update(bytes).digest("hex");
}

/** Tas pats tokens kā CSDD PDF pastam (`CSDD_PDF_INBOX_TOKEN`, ≥ 24 zīmes; bez tā - izslēgts). */
export function verifyPdfInboxToken(header: string | null, env: Record<string, string | undefined> = process.env): boolean {
  const secret = (env.CSDD_PDF_INBOX_TOKEN ?? "").trim();
  if (secret.length < 24) return false;
  const given = extractBearerToken(header);
  if (!given) return false;
  const a = Buffer.from(given, "utf8");
  const b = Buffer.from(secret, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

function json(bytes: Uint8Array | null): unknown {
  if (!bytes) return null;
  try {
    return JSON.parse(Buffer.from(bytes).toString("utf8"));
  } catch {
    return null;
  }
}

type Seen = { orderId?: string; unmatched?: boolean; at: string };

async function readSeen(md5: string): Promise<Seen | null> {
  const o = json(await readVendorAutoRaw(seenPath(md5)));
  if (!o || typeof o !== "object") return null;
  const r = o as Record<string, unknown>;
  return {
    ...(typeof r.orderId === "string" && r.orderId ? { orderId: r.orderId } : {}),
    ...(r.unmatched === true ? { unmatched: true } : {}),
    at: typeof r.at === "string" ? r.at : "",
  };
}

async function writeSeen(md5: string, seen: Omit<Seen, "at">): Promise<void> {
  await writeVendorAutoRaw(seenPath(md5), JSON.stringify({ ...seen, at: new Date().toISOString() }), "application/json").catch(() => undefined);
}

export async function listCarfaxUnmatched(): Promise<CarfaxUnmatchedPdf[]> {
  return parseCarfaxUnmatchedList(json(await readVendorAutoRaw(UNMATCHED_INDEX)));
}

async function writeUnmatched(list: CarfaxUnmatchedPdf[]): Promise<void> {
  await writeVendorAutoRaw(UNMATCHED_INDEX, JSON.stringify(list.slice(0, 200)), "application/json").catch(() => undefined);
}

async function removeUnmatched(md5: string): Promise<void> {
  const list = await listCarfaxUnmatched();
  if (list.some((x) => x.md5 === md5)) await writeUnmatched(list.filter((x) => x.md5 !== md5));
}

async function deleteChunks(md5: string, count: number): Promise<void> {
  const blob = getOrderDraftBlobConfig();
  if (!blob) return;
  const urls = Array.from({ length: count }, (_, i) => `${blob.prefix}${chunkPath(md5, i)}`);
  await del(urls, { token: blob.token }).catch(() => undefined);
}

/* ------------------------------------------------------------------ */

export type CarfaxInboxResult =
  | { status: "chunk_saved"; index: number }
  | { status: "chunk_missing" }
  | { status: "md5_mismatch" }
  | { status: "not_carfax"; reason: string }
  | { status: "attached"; orderId: string; reason: "purchase_click" | "newest" }
  | { status: "duplicate"; orderId: string }
  | { status: "unmatched"; vin: string }
  | { status: "error"; error: string };

/** Viena PDF daļa no Apps Script. Pēdējā daļa saliek PDF un to apstrādā. */
export async function receiveCarfaxInboxChunk(chunk: CarfaxInboxChunk): Promise<CarfaxInboxResult> {
  if (chunk.count === 1) return ingestCarfaxInboxPdf({ bytes: chunk.bytes, md5: chunk.md5, fileName: chunk.fileName, receivedAt: chunk.receivedAt });
  const w = await writeVendorAutoRaw(chunkPath(chunk.md5, chunk.index), chunk.bytes, "application/octet-stream");
  if (!w.ok) return { status: "error", error: w.error };
  if (chunk.index < chunk.count - 1) return { status: "chunk_saved", index: chunk.index };
  const parts: Uint8Array[] = [];
  for (let i = 0; i < chunk.count; i++) {
    const p = i === chunk.index ? chunk.bytes : await readVendorAutoRaw(chunkPath(chunk.md5, i));
    if (!p) return { status: "chunk_missing" };
    parts.push(p);
  }
  const total = parts.reduce((n, p) => n + p.byteLength, 0);
  if (total > CARFAX_INBOX_MAX_BYTES) return { status: "not_carfax", reason: "too_large" };
  const bytes = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    bytes.set(p, off);
    off += p.byteLength;
  }
  if (md5Hex(bytes) !== chunk.md5) return { status: "md5_mismatch" };
  await deleteChunks(chunk.md5, chunk.count);
  return ingestCarfaxInboxPdf({ bytes, md5: chunk.md5, fileName: chunk.fileName, receivedAt: chunk.receivedAt });
}

async function orderCandidates(vin: string, nowMs: number): Promise<CarfaxOrderCandidate[]> {
  const { rows } = await listAdminOrders();
  const live = rows.filter(
    (r) =>
      !r.isDemo &&
      (r.isManual || r.paymentStatus === "paid") &&
      r.checkoutLine !== "provin_select" &&
      nowMs - r.created * 1000 <= CARFAX_INBOX_ORDER_WINDOW_MS,
  );
  // Melnrakstus lasām tikai pasūtījumiem ar šo VIN un pēdējo 14 dienu pasūtījumiem (VIN var būt labots / klikšķis).
  const recentMs = 14 * 24 * 60 * 60_000;
  const toRead = live
    .filter((r) => normalizeVin(r.vin ?? "") === vin || nowMs - r.created * 1000 <= recentMs)
    .slice(0, 150);
  return Promise.all(
    toRead.map(async (r) => {
      const draft = await readOrderDraft(r.id).catch(() => null);
      const blocks = mergeSourceBlocksWithDefaults(draft?.workspace?.sourceBlocks ?? {});
      return {
        id: r.id,
        createdMs: r.created * 1000,
        vins: [r.vin, draft?.orderEdits?.vin, blocks.csdd.vin, blocks.csdd.registry?.data?.vin],
        purchase: blocks.carfax.purchase ?? null,
      };
    }),
  );
}

type ParsedPdf = { report: CarfaxReport; text: string };

async function parsePdf(bytes: Uint8Array, fileName: string): Promise<ParsedPdf | { error: string }> {
  if (!isPdfBytes(bytes)) return { error: "not_pdf" };
  let text = "";
  try {
    const extracted = await extractPdfTextDetailed(bytes.slice().buffer, { fileName: fileName || "CARFAX.pdf" });
    text = extracted.text ?? "";
  } catch (e) {
    console.error(`${LOG} parse failed`, e instanceof Error ? e.message.slice(0, 120) : "unknown");
    return { error: "unreadable" };
  }
  if (!looksLikeCarfaxReport(text)) return { error: "not_carfax_text" };
  const report = parseCarfaxReportText(text);
  if (!report) return { error: "not_carfax_text" };
  return { report, text };
}

/** Pilns PDF -> pasūtījums pēc VIN (vai nepiesaistīto saraksts). Idempotents pēc md5. */
export async function ingestCarfaxInboxPdf(args: {
  bytes: Uint8Array;
  md5: string;
  fileName: string;
  receivedAt?: string;
  nowMs?: number;
}): Promise<CarfaxInboxResult> {
  const { bytes, md5 } = args;
  if (bytes.byteLength > CARFAX_INBOX_MAX_BYTES) return { status: "not_carfax", reason: "too_large" };
  if (md5Hex(bytes) !== md5) return { status: "md5_mismatch" };
  const seen = await readSeen(md5);
  if (seen?.orderId) return { status: "duplicate", orderId: seen.orderId };

  const parsed = await parsePdf(bytes, args.fileName);
  if ("error" in parsed) return { status: "not_carfax", reason: parsed.error };
  const vin = normalizeVin(parsed.report.vin) || carfaxVinFromFileName(args.fileName);
  if (!isValidVin(vin)) return { status: "not_carfax", reason: "no_vin" };

  const now = args.nowMs ?? Date.now();
  const match = matchCarfaxPdfOrder(await orderCandidates(vin, now), vin, now);
  if (!match) {
    if (!seen?.unmatched) {
      const saved = await writeVendorAutoRaw(unmatchedPdfPath(md5), bytes, "application/pdf");
      if (!saved.ok) return { status: "error", error: saved.error };
      const list = await listCarfaxUnmatched();
      if (!list.some((x) => x.md5 === md5)) {
        await writeUnmatched([
          {
            md5,
            vin,
            fileName: args.fileName.slice(0, 160) || `CARFAX - ${vin}.pdf`,
            size: bytes.byteLength,
            receivedAt: args.receivedAt || new Date(now).toISOString(),
            savedAt: new Date(now).toISOString(),
          },
          ...list,
        ]);
      }
      await writeSeen(md5, { unmatched: true });
      await Promise.resolve()
        .then(() =>
          sendAdminPush({
            title: "CARFAX PDF bez pasūtījuma",
            body: `Saņemta CARFAX atskaite (${vin}), bet pasūtījums ar šo VIN nav atrasts. PDF saglabāts - pievieno to CARFAX blokā.`,
            url: "/admin",
            tag: "carfax-pdf-inbox",
            audience: "pro",
          }),
        )
        .catch(() => undefined);
    }
    return { status: "unmatched", vin };
  }

  const applied = await applyCarfaxPdfToOrderDraft(match.orderId, { bytes, md5, report: parsed.report });
  if (!applied.ok) return { status: "error", error: applied.error };
  await writeSeen(md5, { orderId: match.orderId });
  if (seen?.unmatched) await removeUnmatched(md5);
  console.info(`${LOG} attached`, { orderId: match.orderId.slice(-8), reason: match.reason, duplicate: applied.duplicate });
  return applied.duplicate ? { status: "duplicate", orderId: match.orderId } : { status: "attached", orderId: match.orderId, reason: match.reason };
}

function emptyWorkspace() {
  return {
    sourceBlocks: createDefaultSourceBlocks(),
    iriss: "",
    apskatesPlāns: "",
    tehniskoRiskuAnalize: "",
    cenasAtbilstiba: "",
    previewConfirmed: false,
  };
}

/** CARFAX bloks ar jauno atskaiti + PDF meta (citi bloka lauki un rindas paliek). */
export function carfaxBlockWithPdf(
  prev: CarfaxBlockState,
  report: CarfaxReport,
  pdf: NonNullable<CarfaxReport["pdf"]>,
): CarfaxBlockState {
  const { block } = applyCarfaxReportObject(prev, report);
  return { ...block, report: { ...block.report!, pdf } };
}

/**
 * Servera puses ielikšana pasūtījuma darba vietā: maina TIKAI `sourceBlocks.carfax`, ar revīzijas pārbaudi
 * (`expectedWorkspaceRevision`; konflikts -> nolasa no jauna, līdz 3 reizēm). Tas pats PDF (md5) -> duplicate.
 */
export async function applyCarfaxPdfToOrderDraft(
  sessionId: string,
  args: { bytes: Uint8Array; md5: string; report: CarfaxReport },
): Promise<{ ok: true; duplicate: boolean } | { ok: false; error: string }> {
  const first = await readOrderDraft(sessionId).catch(() => null);
  const firstBlocks = mergeSourceBlocksWithDefaults(first?.workspace?.sourceBlocks ?? {});
  if (firstBlocks.carfax.report?.pdf?.md5 === args.md5) return { ok: true, duplicate: true };

  const saved = await saveCarfaxOriginalPdf({
    sessionId,
    bytes: args.bytes,
    vin: args.report.vin,
    csdd: firstBlocks.csdd as CsddFormFields,
  });
  const pdf = {
    ...(saved.meta ?? { name: `CARFAX - ${normalizeVin(args.report.vin)}.pdf`, size: args.bytes.byteLength, savedAt: new Date().toISOString() }),
    md5: args.md5,
    via: "email" as const,
  };

  for (let attempt = 0; attempt < 3; attempt++) {
    const draft = attempt === 0 ? first : await readOrderDraft(sessionId).catch(() => null);
    const baseline = draft?.workspace ?? emptyWorkspace();
    const blocks = mergeSourceBlocksWithDefaults(baseline.sourceBlocks);
    if (blocks.carfax.report?.pdf?.md5 === args.md5) return { ok: true, duplicate: true };
    const carfax = carfaxBlockWithPdf(blocks.carfax, args.report, pdf);
    const res = await patchOrderDraft(
      sessionId,
      { workspace: { ...baseline, sourceBlocks: { ...blocks, carfax } } },
      draft?.workspaceRevision ? { expectedWorkspaceRevision: draft.workspaceRevision } : {},
    );
    if (res.ok) return { ok: true, duplicate: false };
    if (res.error !== "stale_revision") {
      console.error(`${LOG} apply failed`, { sessionId: sessionId.slice(-8), error: res.error });
      return { ok: false, error: res.error };
    }
  }
  return { ok: false, error: "stale_revision" };
}

/**
 * Admin «Pievienot» nepiesaistītam PDF: bloku atgriež klientam (tas to ieliek savā darba vietā un saglabā pats -
 * nav revīzijas konflikta ar atvērto cilni). PDF saglabā pasūtījuma Blob + Dropbox.
 */
export async function attachUnmatchedCarfaxPdf(args: {
  sessionId: string;
  md5: string;
  prevBlock: CarfaxBlockState;
  csdd: CsddFormFields;
}): Promise<{ ok: true; block: CarfaxBlockState; summary: string } | { ok: false; error: string }> {
  const { sessionId, md5 } = args;
  const entry = (await listCarfaxUnmatched()).find((x) => x.md5 === md5);
  if (!entry) return { ok: false, error: "not_found" };
  const bytes = await readVendorAutoRaw(unmatchedPdfPath(md5));
  if (!bytes || md5Hex(bytes) !== md5) return { ok: false, error: "pdf_missing" };
  const parsed = await parsePdf(bytes, entry.fileName);
  if ("error" in parsed) return { ok: false, error: parsed.error };
  if (args.prevBlock.report?.pdf?.md5 === md5) return { ok: false, error: "duplicate" };
  const saved = await saveCarfaxOriginalPdf({ sessionId, bytes, vin: parsed.report.vin || entry.vin, csdd: args.csdd });
  const pdf = {
    ...(saved.meta ?? { name: entry.fileName, size: bytes.byteLength, savedAt: new Date().toISOString() }),
    md5,
    via: "email" as const,
  };
  const { summary } = applyCarfaxReportObject(args.prevBlock, parsed.report);
  const block = carfaxBlockWithPdf(args.prevBlock, parsed.report, pdf);
  await writeSeen(md5, { orderId: sessionId });
  await removeUnmatched(md5);
  return { ok: true, block, summary };
}

/** Servera melnraksta CARFAX PDF meta (admin bloks redz, ka PDF ienācis no pasta). */
export async function readServerCarfaxPdfMeta(sessionId: string): Promise<CarfaxReport["pdf"] | null> {
  const draft = await readOrderDraft(sessionId).catch(() => null);
  const blocks = mergeSourceBlocksWithDefaults(draft?.workspace?.sourceBlocks ?? {});
  return blocks.carfax.report?.pdf ?? null;
}
