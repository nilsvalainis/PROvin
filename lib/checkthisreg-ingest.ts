import "server-only";

import { createHash } from "node:crypto";

import { del } from "@vercel/blob";

import { ensureDealerServiceWorksLatvian } from "@/lib/admin-ai-oneauto-translate";
import { sendAdminPush } from "@/lib/admin-push";
import { listAdminOrders } from "@/lib/admin-orders";
import {
  getOrderDraftBlobConfig,
  isSafeOrderDraftSessionId,
  patchOrderDraft,
  readOrderDraft,
} from "@/lib/admin-order-draft-store";
import { createDefaultSourceBlocks, mergeSourceBlocksWithDefaults, type CsddFormFields } from "@/lib/admin-source-blocks";
import { parseB2bWalletOrderMarks } from "@/lib/b2b-wallet";
import { readVendorAutoRaw, writeVendorAutoRaw } from "@/lib/carvertical-auto-store";
import {
  appendCtrStats,
  applyCtrToAutoRecords,
  CTR_INGEST_MAX_DOC_BYTES,
  ctrModelFromVehicleLine,
  decideCtrResult,
  matchCtrOrder,
  nextCtrOrderRecord,
  normalizeCtrOrderRecord,
  ctrPendingDue,
  normalizeCtrPending,
  normalizeCtrStats,
  type CtrDocumentChunk,
  type CtrFinalize,
  type CtrOrderCandidate,
  type CtrOrderRecord,
  type CtrResult,
} from "@/lib/checkthisreg-ingest-logic";
import { extractCtrPdfItems } from "@/lib/checkthisreg-pdf-items";
import {
  combineCtrDocs,
  ctrAiContext,
  ctrDealerLocation,
  ctrRawText,
  ctrServiceHistoryRows,
  ctrServiceWorkRows,
  parseCtrPdfItems,
  type ParsedCtrDoc,
} from "@/lib/checkthisreg-pdf-parse";
import { generateDealerNotesForExternalData } from "@/lib/dealer-data-job";
import { readDealerDataJob } from "@/lib/dealer-data-job-store";
import { syncDealerJobWithDraftData } from "@/lib/dealer-manual-data-sync";
import { getDropboxClient } from "@/lib/dropbox-client";
import { orderCarFromCsdd } from "@/lib/ltab-auto";
import { saveFileToProvOrderFolder } from "@/lib/ltab-dropbox";
import { readOrderClientMarks } from "@/lib/order-client-marks-store";
import { saveFileToOrderFolderOrLegacy } from "@/lib/order-dropbox";
import { normalizeVin } from "@/lib/order-field-validation";

/**
 * CheckThisReg -> PROVIN pasūtījums (Nila «jā» 27.11.2026, A). Nils pats pērk CheckThisReg; šeit tikai ievade.
 * Krātuve (tā pati, kur pasūtījumu melnraksti, privāts Blob):
 *   ctr_inbox/chunks/{md5}/{i}.bin           - PDF daļas (> 2,5 MB), pēc salikšanas dzēš
 *   ctr_inbox/docs/{ctrOrderId}/{md5}.pdf    - saņemtie PDF līdz «finalize»
 *   ctr_inbox/seen/{ctrOrderId}.json         - idempotence: kur ievadīts
 *   ctr_inbox/_pending.json                  - pasūtījums vēl nav atrasts (atkārto darbinieka katrā gājienā)
 *   ctr_inbox/_stats.json                    - marka / modelis / gads / rezultāts (nākamajai prognozei)
 *   ctr_inbox/orders/{sessionId}.json        - admin čips «CheckThisReg: dati ievadīti DD.MM» / «nav datu»
 *   ctr/{sessionId}/{fails}.pdf              - PDF pasūtījuma pielikums (+ Dropbox pasūtījuma mapē)
 * Klienta tekstos (dīlera bloks, RAW, AI konteksts) avota nosaukums netiek rakstīts - tikai «<Marka> dīleris».
 */

const DIR = "ctr_inbox";
const LOG = "[ctr-ingest]";

const chunkPath = (md5: string, i: number) => `${DIR}/chunks/${md5}/${i}.bin`;
const docPath = (ctrOrderId: string, md5: string) => `${DIR}/docs/${ctrOrderId}/${md5}.pdf`;
const seenPath = (ctrOrderId: string) => `${DIR}/seen/${ctrOrderId}.json`;
const orderRecordPath = (sessionId: string) => `${DIR}/orders/${sessionId}.json`;
const PENDING = `${DIR}/_pending.json`;
const STATS = `${DIR}/_stats.json`;

function md5Hex(bytes: Uint8Array): string {
  return createHash("md5").update(bytes).digest("hex");
}

function json(bytes: Uint8Array | null): unknown {
  if (!bytes) return null;
  try {
    return JSON.parse(Buffer.from(bytes).toString("utf8"));
  } catch {
    return null;
  }
}

async function writeJson(rel: string, value: unknown): Promise<boolean> {
  const r = await writeVendorAutoRaw(rel, JSON.stringify(value), "application/json").catch(() => ({ ok: false as const }));
  return r.ok;
}

function isPdfBytes(bytes: Uint8Array): boolean {
  return bytes.byteLength >= 100 && String.fromCharCode(...bytes.slice(0, 5)) === "%PDF-";
}

/* ------------------------------------------------------------------ */
/* PDF saņemšana                                                       */

export type CtrDocumentResult =
  | { status: "chunk_saved"; index: number }
  | { status: "document_saved"; md5: string }
  | { status: "chunk_missing" }
  | { status: "md5_mismatch" }
  | { status: "not_pdf" }
  | { status: "error"; error: string };

export async function receiveCtrDocumentChunk(chunk: CtrDocumentChunk): Promise<CtrDocumentResult> {
  let bytes = chunk.bytes;
  if (chunk.count > 1) {
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
    if (total > CTR_INGEST_MAX_DOC_BYTES) return { status: "error", error: "too_large" };
    bytes = new Uint8Array(total);
    let off = 0;
    for (const p of parts) {
      bytes.set(p, off);
      off += p.byteLength;
    }
    const blob = getOrderDraftBlobConfig();
    if (blob) {
      const urls = Array.from({ length: chunk.count }, (_, i) => `${blob.prefix}${chunkPath(chunk.md5, i)}`);
      await del(urls, { token: blob.token }).catch(() => undefined);
    }
  }
  if (md5Hex(bytes) !== chunk.md5) return { status: "md5_mismatch" };
  if (!isPdfBytes(bytes)) return { status: "not_pdf" };
  const w = await writeVendorAutoRaw(docPath(chunk.ctrOrderId, chunk.md5), bytes, "application/pdf");
  if (!w.ok) return { status: "error", error: w.error };
  return { status: "document_saved", md5: chunk.md5 };
}

/* ------------------------------------------------------------------ */
/* Ieraksti                                                            */

export async function readCtrOrderRecord(sessionId: string): Promise<CtrOrderRecord | null> {
  if (!isSafeOrderDraftSessionId(sessionId)) return null;
  return normalizeCtrOrderRecord(json(await readVendorAutoRaw(orderRecordPath(sessionId))));
}

async function recordForOrder(sessionId: string, add: Parameters<typeof nextCtrOrderRecord>[1]): Promise<void> {
  const prev = await readCtrOrderRecord(sessionId);
  await writeJson(orderRecordPath(sessionId), nextCtrOrderRecord(prev, add));
}

type Seen = { sessionId?: string; status: CtrResult | "pending"; at: string };

async function readSeen(ctrOrderId: string): Promise<Seen | null> {
  const o = json(await readVendorAutoRaw(seenPath(ctrOrderId)));
  if (!o || typeof o !== "object") return null;
  const r = o as Record<string, unknown>;
  const status = ["data", "no_data", "manual_needed", "pending"].includes(String(r.status)) ? (r.status as Seen["status"]) : null;
  if (!status) return null;
  return { ...(typeof r.sessionId === "string" ? { sessionId: r.sessionId } : {}), status, at: typeof r.at === "string" ? r.at : "" };
}

async function addStats(entry: Parameters<typeof appendCtrStats>[1]): Promise<void> {
  const list = normalizeCtrStats(json(await readVendorAutoRaw(STATS)));
  await writeJson(STATS, appendCtrStats(list, entry));
}

async function readPending(): Promise<ReturnType<typeof normalizeCtrPending>> {
  return normalizeCtrPending(json(await readVendorAutoRaw(PENDING)));
}

async function push(title: string, body: string, url: string, tag: string): Promise<void> {
  await sendAdminPush({ title, body, url, tag, audience: "pro" }).catch(() => undefined);
}

/* ------------------------------------------------------------------ */
/* Pasūtījuma atrašana                                                 */

async function orderCandidates(vin: string, nowMs: number): Promise<CtrOrderCandidate[]> {
  const { rows } = await listAdminOrders();
  const live = rows.filter((r) => !r.isDemo && (r.isManual || r.paymentStatus === "paid") && r.fulfillment !== "b2b_pack");
  // Melnrakstus lasām tikai pasūtījumiem ar šo VIN un pēdējo 14 dienu pasūtījumiem (VIN var būt ievadīts melnrakstā).
  const recentMs = 14 * 24 * 60 * 60_000;
  const toRead = live.filter((r) => normalizeVin(r.vin ?? "") === vin || nowMs - r.created * 1000 <= recentMs).slice(0, 150);
  const out = await Promise.all(
    toRead.map(async (r) => {
      const draft = await readOrderDraft(r.id).catch(() => null);
      const blocks = mergeSourceBlocksWithDefaults(draft?.workspace?.sourceBlocks ?? {});
      const vins = [r.vin, draft?.orderEdits?.vin, blocks.csdd.vin, blocks.csdd.registry?.data?.vin];
      const sameVin = vins.some((v) => normalizeVin(String(v ?? "")) === vin);
      let reportSent = Boolean(draft?.clientReportReadyAt?.trim());
      if (sameVin && !reportSent) {
        const marks = await readOrderClientMarks(r.id).catch(() => null);
        reportSent = (marks?.dealerSends?.length ?? 0) > 0;
      }
      return { id: r.id, createdMs: r.created * 1000, vins, checkoutLine: r.checkoutLine ?? null, isManual: r.isManual, reportSent };
    }),
  );
  return out;
}

/* ------------------------------------------------------------------ */
/* Ievade pasūtījumā                                                   */

function safeDocName(name: string): string {
  const base = name.replace(/\.pdf$/i, "").replace(/[^\p{L}\p{N} ()._-]/gu, "").replace(/\s+/g, " ").trim().slice(0, 80);
  return base || "dokuments";
}

async function saveOrderPdf(args: { sessionId: string; vin: string; csdd: CsddFormFields; fileName: string; bytes: Uint8Array }): Promise<boolean> {
  const name = `Dīlera dati - ${normalizeVin(args.vin)} - ${safeDocName(args.fileName)}.pdf`;
  const blob = await writeVendorAutoRaw(`ctr/${args.sessionId}/${safeDocName(args.fileName)}.pdf`, args.bytes, "application/pdf").catch(() => ({ ok: false as const }));
  const client = getDropboxClient();
  if (!client) return blob.ok;
  try {
    const car = orderCarFromCsdd(args.csdd, "", args.vin);
    await saveFileToOrderFolderOrLegacy(args.sessionId, name, args.bytes, () =>
      saveFileToProvOrderFolder(client, { ...car, vin: normalizeVin(args.vin) || car.vin }, name, args.bytes),
    );
    return true;
  } catch (e) {
    console.warn(`${LOG} dropbox save failed`, e instanceof Error ? e.message.slice(0, 160) : "unknown");
    return blob.ok;
  }
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

function dmyRiga(iso: string): string {
  const d = new Date(iso);
  const p = new Intl.DateTimeFormat("lv-LV", { timeZone: "Europe/Riga", day: "2-digit", month: "2-digit", year: "numeric" }).formatToParts(
    Number.isFinite(d.getTime()) ? d : new Date(),
  );
  const g = (t: string) => p.find((x) => x.type === t)?.value ?? "";
  return `${g("day")}.${g("month")}.${g("year")}`;
}

function yearFrom(raw: string | undefined): number | null {
  const m = (raw ?? "").match(/(19|20)\d{2}/);
  return m ? Number(m[0]) : null;
}

export type CtrFinalizeResult =
  | { status: "attached"; sessionId: string; result: CtrResult; serviceRows: number; mileageRows: number; ai: boolean }
  | { status: "no_data"; sessionId: string | null }
  | { status: "pending"; vin: string }
  | { status: "duplicate"; sessionId: string | null }
  | { status: "missing_documents"; missing: string[] }
  | { status: "error"; error: string };

async function parseDocs(fin: CtrFinalize): Promise<{ docs: ParsedCtrDoc[]; bytes: Map<string, Uint8Array> } | { missing: string[] }> {
  const bytes = new Map<string, Uint8Array>();
  const missing: string[] = [];
  for (const d of fin.documents) {
    const b = await readVendorAutoRaw(docPath(fin.ctrOrderId, d.md5));
    if (!b || md5Hex(b) !== d.md5) missing.push(d.md5);
    else bytes.set(d.md5, b);
  }
  if (missing.length) return { missing };
  const docs: ParsedCtrDoc[] = [];
  for (const d of fin.documents) {
    try {
      docs.push(parseCtrPdfItems(d.fileName, await extractCtrPdfItems(bytes.get(d.md5)!)));
    } catch (e) {
      console.warn(`${LOG} pdf parse failed`, { file: d.fileName.slice(0, 60), error: e instanceof Error ? e.message.slice(0, 120) : "unknown" });
      docs.push(parseCtrPdfItems(d.fileName, []));
    }
  }
  return { docs, bytes };
}

/**
 * Viens CheckThisReg pasūtījums -> PROVIN pasūtījums. Idempotents pēc CheckThisReg pasūtījuma id.
 * Nav pasūtījuma -> gaidošo sarakstā + push (atkārto `retryCtrPending`).
 */
export async function finalizeCtrIngest(fin: CtrFinalize, opts: { nowMs?: number; fromPending?: boolean } = {}): Promise<CtrFinalizeResult> {
  const nowMs = opts.nowMs ?? Date.now();
  const seen = await readSeen(fin.ctrOrderId);
  if (seen && seen.status !== "pending") return { status: "duplicate", sessionId: seen.sessionId ?? null };

  const parsed = await parseDocs(fin);
  if ("missing" in parsed) return { status: "missing_documents", missing: parsed.missing };
  const combined = combineCtrDocs(parsed.docs);
  const location = ctrDealerLocation(fin.manufacturer);
  const workRows = ctrServiceWorkRows(combined, location);
  const historyRows = ctrServiceHistoryRows(combined);
  const result = decideCtrResult({
    docCount: fin.documents.length,
    hasStructuredData: combined.hasStructuredData,
    serviceRows: workRows.length,
    mileageRows: historyRows.length,
    unknownDocs: combined.unknownDocs.length,
  });
  const statsBase = {
    at: new Date(nowMs).toISOString(),
    make: fin.manufacturer,
    model: ctrModelFromVehicleLine(combined.vehicleLine),
    docs: fin.documents.length,
    serviceRows: workRows.length,
    emailKind: fin.emailKind,
  };
  const bmwFirstReg = combined.docs.flatMap((d) => d.vehicleInfo).find((i) => /FIRST REGISTRATION/i.test(i.label))?.value;

  const sessionId = matchCtrOrder(await orderCandidates(fin.vin, nowMs), fin.vin, nowMs);
  const adminPath = sessionId ? `/admin/orders/${encodeURIComponent(sessionId)}` : "/admin";

  if (!sessionId) {
    if (!opts.fromPending) {
      const list = await readPending();
      if (!list.some((x) => x.ctrOrderId === fin.ctrOrderId)) {
        await writeJson(PENDING, [...list, { ctrOrderId: fin.ctrOrderId, vin: fin.vin, at: new Date(nowMs).toISOString(), triedAt: new Date(nowMs).toISOString(), finalize: fin }]);
      }
      await writeJson(seenPath(fin.ctrOrderId), { status: "pending", at: new Date(nowMs).toISOString() });
      await addStats({ ...statsBase, year: yearFrom(bmwFirstReg), result: "pending" });
      await push(
        "CheckThisReg bez pasūtījuma",
        `${fin.vin}: ${result === "no_data" ? "datu nav" : `${fin.documents.length} PDF`}, bet nenosūtīts dīlera/AUDITS pasūtījums ar šo VIN nav atrasts. Gaida - pievienosies pats, kad pasūtījums būs.`,
        "/admin",
        `ctr-pending-${fin.ctrOrderId}`,
      );
    }
    return { status: "pending", vin: fin.vin };
  }

  const draft = await readOrderDraft(sessionId).catch(() => null);
  const blocks0 = mergeSourceBlocksWithDefaults(draft?.workspace?.sourceBlocks ?? {});
  const year = yearFrom(blocks0.csdd.firstRegistration) ?? yearFrom(bmwFirstReg);
  const finishPending = async () => {
    const list = await readPending();
    if (list.some((x) => x.ctrOrderId === fin.ctrOrderId)) await writeJson(PENDING, list.filter((x) => x.ctrOrderId !== fin.ctrOrderId));
  };

  if (result === "no_data") {
    await recordForOrder(sessionId, {
      status: "no_data",
      at: new Date(nowMs).toISOString(),
      ctrOrderId: fin.ctrOrderId,
      orderNumber: fin.orderNumber,
      docCount: 0,
      serviceRows: 0,
      mileageRows: 0,
      formats: [],
    });
    await writeJson(seenPath(fin.ctrOrderId), { sessionId, status: "no_data", at: new Date(nowMs).toISOString() });
    await finishPending();
    await addStats({ ...statsBase, year, result: "no_data" });
    await push("CheckThisReg: nav datu", `${fin.vin}: dīlera datu nav (${fin.manufacturer || "marka nav zināma"}).`, adminPath, `ctr-${sessionId}`);
    return { status: "no_data", sessionId };
  }

  // PDF pasūtījuma pielikumos (Blob + Dropbox) - arī «jāapstrādā ar roku».
  for (const d of fin.documents) {
    const b = parsed.bytes.get(d.md5);
    if (b) await saveOrderPdf({ sessionId, vin: fin.vin, csdd: blocks0.csdd as CsddFormFields, fileName: d.fileName, bytes: b });
  }

  // Darbu tulkojums latviski (RAW produkts - oriģinālvalodā).
  const marks = parseB2bWalletOrderMarks(draft?.orderEdits?.notes ?? "");
  const job = await readDealerDataJob(sessionId).catch(() => null);
  const keepSource = job?.skipTranslate ?? marks?.product === "dealer_raw";
  let serviceWorks = workRows;
  if (!keepSource && workRows.length) {
    const tr = await ensureDealerServiceWorksLatvian({ serviceWorks: workRows }).catch(() => null);
    if (tr?.serviceWorks?.length) serviceWorks = tr.serviceWorks.map((r) => ({ ...r }));
  }

  const receivedDmy = dmyRiga(fin.receivedAt);
  const patch = {
    serviceWorks,
    serviceHistory: historyRows,
    rawText: ctrRawText(combined, { make: fin.manufacturer, receivedDmy }),
    aiContext: ctrAiContext(combined, { make: fin.manufacturer, receivedDmy }),
    oilInterval: combined.oilInterval,
  };

  let wrote = false;
  for (let attempt = 0; attempt < 3 && !wrote; attempt++) {
    const cur = attempt === 0 ? draft : await readOrderDraft(sessionId).catch(() => null);
    const baseline = cur?.workspace ?? emptyWorkspace();
    const blocks = mergeSourceBlocksWithDefaults(baseline.sourceBlocks);
    const auto_records = applyCtrToAutoRecords(blocks.auto_records, patch);
    const res = await patchOrderDraft(
      sessionId,
      { workspace: { ...baseline, sourceBlocks: { ...blocks, auto_records } } },
      cur?.workspaceRevision ? { expectedWorkspaceRevision: cur.workspaceRevision } : {},
    );
    if (res.ok) wrote = true;
    else if (res.error !== "stale_revision") {
      console.error(`${LOG} draft write failed`, { sessionId: sessionId.slice(-8), error: res.error });
      return { status: "error", error: res.error };
    }
  }
  if (!wrote) return { status: "error", error: "stale_revision" };

  // AI komentāri (tikai tukšie lauki) - tas pats dīlera ceļš ar visiem filtriem; tad darba statuss «datu nav» -> «Ielasīts».
  let ai = false;
  if (result === "data" && serviceWorks.length > 0) {
    const notes = await generateDealerNotesForExternalData(sessionId, fin.vin).catch((e: unknown) => {
      console.warn(`${LOG} AI notes failed`, e instanceof Error ? e.message.slice(0, 120) : "unknown");
      return null;
    });
    ai = Boolean(notes && (notes.oil || notes.comments));
  }
  await syncDealerJobWithDraftData(sessionId);

  await recordForOrder(sessionId, {
    status: result,
    at: new Date(nowMs).toISOString(),
    ctrOrderId: fin.ctrOrderId,
    orderNumber: fin.orderNumber,
    docCount: fin.documents.length,
    serviceRows: serviceWorks.length,
    mileageRows: historyRows.length,
    formats: [...new Set(combined.docs.map((d) => d.format))],
  });
  await writeJson(seenPath(fin.ctrOrderId), { sessionId, status: result, at: new Date(nowMs).toISOString() });
  await finishPending();
  await addStats({ ...statsBase, year, result });

  // Saņemtie PDF vairs nav vajadzīgi ievades mapē (pasūtījumā ir kopija).
  const blob = getOrderDraftBlobConfig();
  if (blob) {
    await del(
      fin.documents.map((d) => `${blob.prefix}${docPath(fin.ctrOrderId, d.md5)}`),
      { token: blob.token },
    ).catch(() => undefined);
  }

  await push(
    result === "data" ? `CheckThisReg dati ievadīti - ${fin.vin}` : `CheckThisReg PDF - jāapstrādā ar roku`,
    result === "data"
      ? `${serviceWorks.length} servisa ieraksti, ${historyRows.length} nobraukuma rindas${ai ? ", AI komentāri sagatavoti" : ""}. Pārbaudi pirms sūtīšanas.`
      : `${fin.vin}: ${fin.documents.length} PDF saņemti, formāts nav atpazīts. PDF pasūtījumā, teksts RAW laukā.`,
    adminPath,
    `ctr-${sessionId}`,
  );
  console.info(`${LOG} attached`, { sessionId: sessionId.slice(-8), result, rows: serviceWorks.length, ai });
  return { status: "attached", sessionId, result, serviceRows: serviceWorks.length, mileageRows: historyRows.length, ai };
}

/** Gaidošie: vai pasūtījums ar šo VIN nu ir? Darbinieks izsauc katrā gājienā; katru ierakstu mēģina ne biežāk kā reizi stundā. */
export async function retryCtrPending(nowMs: number = Date.now()): Promise<{ checked: number; attached: number; waiting: number }> {
  const raw = json(await readVendorAutoRaw(PENDING));
  if (!Array.isArray(raw) || raw.length === 0) return { checked: 0, attached: 0, waiting: 0 };
  const list = normalizeCtrPending(raw, nowMs);
  // Novecojušie (> 30 d): saņemtos PDF izmet no ievades mapes.
  const keep = new Set(list.map((p) => p.ctrOrderId));
  const expired = normalizeCtrPending(raw, 0).filter((p) => !keep.has(p.ctrOrderId));
  const blob = getOrderDraftBlobConfig();
  if (blob && expired.length) {
    const urls = expired.flatMap((p) => p.finalize.documents.map((d) => `${blob.prefix}${docPath(p.ctrOrderId, d.md5)}`));
    if (urls.length) await del(urls, { token: blob.token }).catch(() => undefined);
  }
  const due = list.filter((p) => ctrPendingDue(p, nowMs)).slice(0, 5);
  if (due.length === 0) {
    if (expired.length) await writeJson(PENDING, list);
    return { checked: 0, attached: 0, waiting: list.length };
  }
  const triedAt = new Date(nowMs).toISOString();
  const dueIds = new Set(due.map((p) => p.ctrOrderId));
  await writeJson(PENDING, list.map((p) => (dueIds.has(p.ctrOrderId) ? { ...p, triedAt } : p)));
  let attached = 0;
  for (const p of due) {
    const r = await finalizeCtrIngest(p.finalize, { nowMs, fromPending: true }).catch(() => null);
    if (r && (r.status === "attached" || r.status === "no_data")) attached++;
  }
  return { checked: due.length, attached, waiting: list.length - attached };
}
