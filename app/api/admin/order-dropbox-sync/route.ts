/**
 * Pasūtījuma Dropbox mape (Nils 27.11: «visiem pasūtījuma failiem jābūt Dropbox mapē»).
 *
 * GET  ?sessionId=  - «Dropbox: N/M» bildēm (tikai lasa).
 * POST { sessionId } - «Saglabāt visu Dropbox»: visas galeriju bildes (arī tās, kurām beigušies automātiskie
 *      mēģinājumi), AutoDNA / CarVertical arhīva foto un serverī glabātie dokumenti -> pasūtījuma mapē, bez dublikātiem.
 *      Ja laiks beidzas - pārējās bildes turpina cron.
 */
import { NextResponse } from "next/server";

import { getAdminSession } from "@/lib/admin-auth";
import { isSafeOrderDraftSessionId, readOrderDraft } from "@/lib/admin-order-draft-store";
import { getCheckoutSessionDetail } from "@/lib/admin-orders";
import { mergeSourceBlocksWithDefaults } from "@/lib/admin-source-blocks";
import { backfillOrderDocumentsToDropbox } from "@/lib/order-documents-dropbox";
import { readOrderPhotoDropboxStatus, syncOrderPhotosToDropboxOnce } from "@/lib/order-photo-dropbox";
import { mirrorVendorArchivePhotosToDropbox } from "@/lib/vendor-archive-photos-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function bad(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

export async function GET(req: Request) {
  if (!(await getAdminSession())) return bad("unauthorized", 401);
  const sessionId = (new URL(req.url).searchParams.get("sessionId") ?? "").trim();
  if (!isSafeOrderDraftSessionId(sessionId)) return bad("invalid_session", 400);
  const status = await readOrderPhotoDropboxStatus(sessionId);
  return NextResponse.json({ ok: true, photos: status });
}

export async function POST(req: Request) {
  if (!(await getAdminSession())) return bad("unauthorized", 401);
  const startedAt = Date.now();
  let body: { sessionId?: unknown } = {};
  try {
    body = (await req.json()) as { sessionId?: unknown };
  } catch {
    return bad("invalid_json", 400);
  }
  const sessionId = typeof body.sessionId === "string" ? body.sessionId.trim() : "";
  if (!isSafeOrderDraftSessionId(sessionId)) return bad("invalid_session", 400);
  const order = await getCheckoutSessionDetail(sessionId).catch(() => null);
  if (!order) return bad("not_found", 404);

  const draft = await readOrderDraft(sessionId).catch(() => null);
  const vin = (order.vin ?? "").trim() || draft?.orderEdits?.vin?.trim() || "";
  const documents = await backfillOrderDocumentsToDropbox(sessionId, { vin, deadlineAt: startedAt + 60_000 }).catch(() => null);

  let archive = 0;
  if (draft?.workspace) {
    const sourceBlocks = mergeSourceBlocksWithDefaults(draft.workspace.sourceBlocks);
    for (const source of ["autodna", "carvertical"] as const) {
      if (Date.now() > startedAt + 120_000) break;
      const r = await mirrorVendorArchivePhotosToDropbox({ sessionId, source, sourceBlocks }).catch(() => null);
      archive += r?.uploaded ?? 0;
    }
  }

  const photos = await syncOrderPhotosToDropboxOnce(sessionId, { force: true, deadlineAt: startedAt + 280_000 });
  return NextResponse.json({ ok: true, photos, archivePhotosUploaded: archive, documents });
}
