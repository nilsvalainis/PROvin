import { NextResponse } from "next/server";

import { getAdminSession } from "@/lib/admin-auth";
import { isSafeOrderDraftSessionId } from "@/lib/admin-order-draft-store";
import { mergeSourceBlocksWithDefaults, type WorkspaceSourceBlocks } from "@/lib/admin-source-blocks";
import { readAutodnaAutoStatus, readAutodnaPdf } from "@/lib/autodna-auto-store";
import { readCarverticalAutoStatus, readCarverticalPdf } from "@/lib/carvertical-auto-store";
import { getDropboxClient } from "@/lib/dropbox-client";
import { downloadOrderDropboxFile } from "@/lib/order-dropbox";
import { isInsideDropboxFolder } from "@/lib/iriss-autoparks-dropbox-path";
import { provOrdersDropboxRoot } from "@/lib/ltab-dropbox";
import { isVendorArchiveSource, type VendorArchiveSource } from "@/lib/vendor-archive-photo-group";
import { importVendorArchivePhotosFull } from "@/lib/vendor-archive-photos-import";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Jau saglabātais AutoDNA / CarVertical PDF (Blob, rezerve - pasūtījuma Dropbox mape). */
async function readStoredVendorPdf(
  sessionId: string,
  source: VendorArchiveSource,
): Promise<{ bytes: Uint8Array | null; vin: string }> {
  const status = source === "carvertical" ? await readCarverticalAutoStatus(sessionId) : await readAutodnaAutoStatus(sessionId);
  const vin = status?.vin ?? "";
  if (!status?.pdf) return { bytes: null, vin };
  let bytes = status.pdf.blobPath
    ? source === "carvertical"
      ? await readCarverticalPdf(sessionId)
      : await readAutodnaPdf(sessionId)
    : null;
  if (!bytes && status.pdf.dropboxPath && isInsideDropboxFolder(status.pdf.dropboxPath, provOrdersDropboxRoot())) {
    const client = getDropboxClient();
    if (client) {
      try {
        bytes = (await downloadOrderDropboxFile(client, sessionId, status.pdf.dropboxPath))?.bytes ?? null;
      } catch {
        bytes = null;
      }
    }
  }
  return { bytes, vin };
}

/**
 * Admin: «Ielādēt arhīva foto» - no jau saglabātā AutoDNA / CarVertical PDF (un releja pilnās bildes, ja pieejams) ieliek
 * «Sludinājuma vēsture» grupās (dedup pret esošajām). Neko nepērk, PDF tikai lasa.
 */
export async function POST(req: Request) {
  if (!(await getAdminSession())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const sessionId = typeof body.sessionId === "string" ? body.sessionId.trim() : "";
  if (!isSafeOrderDraftSessionId(sessionId)) return NextResponse.json({ error: "invalid_session" }, { status: 400 });
  if (!isVendorArchiveSource(body.source)) return NextResponse.json({ error: "invalid_source" }, { status: 400 });
  const source = body.source;
  let sourceBlocks: WorkspaceSourceBlocks;
  try {
    sourceBlocks = mergeSourceBlocksWithDefaults((body.sourceBlocks ?? {}) as Partial<WorkspaceSourceBlocks>);
  } catch {
    return NextResponse.json({ error: "missing_source_blocks" }, { status: 400 });
  }
  const { bytes, vin } = await readStoredVendorPdf(sessionId, source);
  if (!bytes && !vin) return NextResponse.json({ error: "pdf_missing" }, { status: 404 });
  try {
    // PDF sīktēli + releja pilnās bildes (ja relejs pieslēgts); relejs tikai lasa jau nopirktu atskaiti.
    const res = await importVendorArchivePhotosFull({ sessionId, source, pdfBytes: bytes, vin, sourceBlocks });
    return NextResponse.json({
      ok: true,
      added: res.added,
      upgraded: res.upgraded,
      duplicates: res.duplicates,
      extracted: res.extracted,
      notes: res.notes,
      patchedSourceBlocks: {
        ...(res.changed ? { tirgus: res.tirgus } : {}),
        ...(res.listingAnalysis ? { listing_analysis: res.listingAnalysis } : {}),
      },
      changedKeys: [...(res.changed ? ["tirgus"] : []), ...(res.listingAnalysis ? ["listing_analysis"] : [])],
    });
  } catch (e) {
    console.error("[admin/vendor-archive-photos] failed", e instanceof Error ? e.message.slice(0, 200) : "unknown");
    return NextResponse.json({ error: "extraction_failed" }, { status: 502 });
  }
}
