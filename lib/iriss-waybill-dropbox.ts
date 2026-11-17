import "server-only";

import { getDropboxClient } from "@/lib/dropbox-client";
import { dropboxPavadzimesPath } from "@/lib/iriss-pavadzimes-dropbox";
import { readIrissPavadzimePdf } from "@/lib/iriss-pavadzimes-store";
import { saveWaybillPdfToDropbox, type WaybillDropboxSaveResult } from "@/lib/iriss-waybill-dropbox-core";
import { waybillDropboxFileName, waybillPdfIndexId } from "@/lib/iriss-waybill-pdf";
import type { WaybillRequest } from "@/lib/iriss-waybill-requests";
import { readWaybillRequestsDoc, setWaybillRequestDropbox } from "@/lib/iriss-waybill-requests-store";

/** Cik senas izdotās pavadzīmes cron vēl mēģina ielikt Dropbox. */
export const WAYBILL_DROPBOX_SWEEP_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/** PDF baiti izdotajai pavadzīmei: pēc `pdfUrl` (pavadzīmju saraksts) vai pēc numura. */
export async function readWaybillRequestPdfBytes(request: Pick<WaybillRequest, "pdfUrl" | "waybillNo">): Promise<Buffer | null> {
  const ids = [waybillPdfIndexId(request.pdfUrl), request.waybillNo.trim().toLowerCase()].filter(Boolean);
  for (const id of [...new Set(ids)]) {
    const pdf = await readIrissPavadzimePdf(id).catch(() => null);
    if (pdf && pdf.bytes.byteLength > 0) return pdf.bytes;
  }
  return null;
}

/** Saglabā PDF Dropbox (bez pieprasījuma). Lieto manuālā augšupielāde. */
export async function saveWaybillBytesToDropbox(input: {
  waybillNo: string;
  brandModel: string;
  plate: string;
  bytes: Uint8Array | null;
}): Promise<WaybillDropboxSaveResult> {
  const client = getDropboxClient();
  if (!client) return { ok: false, error: "Dropbox nav konfigurēts." };
  const fileName = waybillDropboxFileName(input);
  if (!fileName) return { ok: false, error: "Nav pavadzīmes numura - Dropbox nesaglabā." };
  return saveWaybillPdfToDropbox(
    { client },
    { folder: dropboxPavadzimesPath(), fileName, waybillNo: input.waybillNo, bytes: input.bytes },
  );
}

/**
 * Izdotajam pieprasījumam: PDF -> Dropbox, rezultāts pieprasījumā (`dropboxPath` vai `dropboxError`).
 * Jau saglabātu neaiztiek. Kļūdas neizmet (atgriež tekstu).
 */
export async function ensureWaybillRequestInDropbox(requestId: string): Promise<WaybillDropboxSaveResult | null> {
  const doc = await readWaybillRequestsDoc();
  const request = doc.requests.find((r) => r.id === requestId);
  if (!request || request.status !== "issued") return null;
  if (request.dropboxPath) return { ok: true, path: request.dropboxPath, size: 0, reused: true };
  let result: WaybillDropboxSaveResult;
  try {
    const bytes = await readWaybillRequestPdfBytes(request);
    result = await saveWaybillBytesToDropbox({
      waybillNo: request.waybillNo,
      brandModel: request.vehicle.brandModel,
      plate: request.vehicle.plate,
      bytes,
    });
  } catch (err) {
    result = { ok: false, error: err instanceof Error ? err.message.slice(0, 160) : "Dropbox kļūda" };
  }
  await setWaybillRequestDropbox(
    result.ok ? { id: request.id, dropboxPath: result.path } : { id: request.id, error: result.error },
  );
  if (!result.ok) console.error("[iriss-waybill] dropbox_failed", request.id, result.error);
  return result;
}

/** Cron: izdotās (pēdējās 7 dienās) bez Dropbox ceļa - mēģina vēlreiz. */
export async function sweepWaybillRequestsToDropbox(opts: { limit?: number; nowMs?: number } = {}): Promise<{
  tried: number;
  saved: number;
  failed: number;
}> {
  if (!getDropboxClient()) return { tried: 0, saved: 0, failed: 0 };
  const nowMs = opts.nowMs ?? Date.now();
  const doc = await readWaybillRequestsDoc();
  const due = doc.requests
    .filter((r) => r.status === "issued" && !r.dropboxPath && /^P\d{4,8}$/i.test(r.waybillNo))
    .filter((r) => nowMs - (Date.parse(r.updatedAt || r.createdAt) || 0) < WAYBILL_DROPBOX_SWEEP_MAX_AGE_MS)
    .slice(0, opts.limit ?? 5);
  let saved = 0;
  let failed = 0;
  for (const r of due) {
    const res = await ensureWaybillRequestInDropbox(r.id);
    if (res?.ok) saved += 1;
    else failed += 1;
  }
  return { tried: due.length, saved, failed };
}
