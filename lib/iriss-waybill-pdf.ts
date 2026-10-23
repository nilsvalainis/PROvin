import { displayDealerPlate } from "@/lib/iriss-waybill-plates";
import type { WaybillAivarsReply, WaybillRequest } from "@/lib/iriss-waybill-requests";

/**
 * Izdotās pavadzīmes PDF: Dropbox faila nosaukums (tāpat kā Aivars, piem. `P02813_MB_E250_B762-7.pdf`)
 * un kurš drīkst PDF saglabāt telefonā / datorā. Tīras funkcijas (bez servera atkarībām).
 */

const PDF_INDEX_URL_RE = /^\/api\/admin\/iriss-pavadzimes\/([A-Za-z0-9._-]{1,80})\/pdf$/;

/** Pavadzīmju indeksa ieraksta id no `pdfUrl` (`/api/admin/iriss-pavadzimes/<id>/pdf`), citādi "". */
export function waybillPdfIndexId(pdfUrl: string): string {
  const m = pdfUrl.trim().match(PDF_INDEX_URL_RE);
  return m?.[1] ? decodeURIComponent(m[1]) : "";
}

function fileNamePart(raw: string): string {
  return raw
    .normalize("NFC")
    .replace(/[^\p{L}\p{N}-]+/gu, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
}

/** `<NUMURS>_<MARKA_MODELIS>_<NUMURZĪME>.pdf`; tukšās daļas izlaiž. Bez numura - "". */
export function waybillDropboxFileName(input: { waybillNo: string; brandModel: string; plate: string }): string {
  const no = input.waybillNo.trim().toUpperCase();
  if (!/^P\d{4,8}$/.test(no)) return "";
  const plate = displayDealerPlate(input.plate) || fileNamePart(input.plate.toUpperCase());
  const parts = [no, fileNamePart(input.brandModel), plate].filter(Boolean);
  return `${parts.join("_")}.pdf`;
}

export function waybillDropboxFilePath(folder: string, fileName: string): string {
  const base = folder.trim().replace(/\/+$/, "");
  return `${base}/${fileName}`;
}

/** Pieprasījumam ir PDF, ko var izsniegt (mūsu pavadzīmju sarakstā vai Dropbox). */
export function waybillRequestHasPdf(request: Pick<WaybillRequest, "pdfUrl" | "dropboxPath">): boolean {
  return Boolean(waybillPdfIndexId(request.pdfUrl) || request.dropboxPath);
}

export type WaybillPdfViewer = { actorId: string; waybillOnly: boolean };

/**
 * "Saglabāt PDF": tikai izdotai pavadzīmei ar PDF. Kolēģis (tikai sadaļa Pavadzīmes) - tikai savus pieprasījumus;
 * pārējie ar sadaļu Pavadzīmes (sadaļas pārbaudi dara route) - visus.
 */
export function waybillPdfAllowed(
  request: Pick<WaybillRequest, "status" | "pdfUrl" | "dropboxPath" | "createdBy">,
  viewer: WaybillPdfViewer,
): boolean {
  if (request.status !== "issued" || !waybillRequestHasPdf(request)) return false;
  if (viewer.waybillOnly) return Boolean(viewer.actorId) && request.createdBy === viewer.actorId;
  return true;
}

export function waybillPdfDownloadHref(requestId: string): string {
  return `/api/admin/iriss/waybill-requests/${encodeURIComponent(requestId)}/pdf`;
}

/**
 * Atbildēm pievieno `canSavePdf` un Dropbox stāvokli. Kolēģim Dropbox kļūdu nerāda (to labo admins).
 */
export function withWaybillPdfAccess<T extends { requests: WaybillRequest[]; replies: WaybillAivarsReply[] }>(
  payload: T,
  viewer: WaybillPdfViewer,
): T {
  const byId = new Map(payload.requests.map((r) => [r.id, r]));
  return {
    ...payload,
    requests: viewer.waybillOnly
      ? payload.requests.map((r) => ({ ...r, dropboxPath: "", dropboxError: "" }))
      : payload.requests,
    replies: payload.replies.map((reply) => {
      const request = byId.get(reply.requestId);
      if (!request) return reply;
      return {
        ...reply,
        canSavePdf: waybillPdfAllowed(request, viewer),
        dropboxPath: viewer.waybillOnly ? "" : request.dropboxPath,
        dropboxError: viewer.waybillOnly ? "" : request.dropboxError,
      };
    }),
  };
}
