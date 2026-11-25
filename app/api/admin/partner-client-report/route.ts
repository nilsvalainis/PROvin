import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { getCheckoutSessionDetail } from "@/lib/admin-orders";
import { persistClientReportFromNotify } from "@/lib/partner-client-report-storage";
import { isSafeOrderDraftSessionId } from "@/lib/admin-order-draft-store";
import { deleteNotifyBlobUrls, fetchNotifyBlobAttachmentsForEmail } from "@/lib/email/notify-blob-attachments-fetch";
import { isNotifyBlobHostname, notifyPortfolioPathPrefix } from "@/lib/admin-notify-blob-constants";
import { PARTNER_ARCHIVE_PDF_MAX_BYTES, partnerArchiveTooLargeMessage } from "@/lib/partner-archive-pdf-upload";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Ieliek PDF partnera / klienta pasūtījumu arhīvā, nesūtot e-pastu.
 */
export async function POST(req: Request) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const contentType = req.headers.get("content-type") || "";
  // 1) JSON ar Blob atsauci (klienta augšupielāde - nav Vercel ~4,5 MB ķermeņa limita); 2) multipart (mazi faili, rezerve).
  if (contentType.includes("application/json")) return saveFromBlob(req);
  if (!contentType.includes("multipart/form-data")) {
    return NextResponse.json({ error: "invalid_body", message: "Nepieciešams PDF fails." }, { status: 400 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "invalid_body", message: "Neizdevās nolasīt failu." }, { status: 400 });
  }

  const sessionId = String(form.get("sessionId") ?? "").trim();
  if (!sessionId || !isSafeOrderDraftSessionId(sessionId)) {
    return NextResponse.json({ error: "missing_session_id" }, { status: 400 });
  }

  const order = await getCheckoutSessionDetail(sessionId);
  if (!order) {
    return NextResponse.json({ error: "not_found", message: "Pasūtījums nav atrasts." }, { status: 404 });
  }

  const file = form.get("reportPdf");
  if (!(file instanceof File) || file.size <= 0) {
    return NextResponse.json({ error: "no_file", message: "Pievieno PDF failu." }, { status: 400 });
  }
  if (file.size > PARTNER_ARCHIVE_PDF_MAX_BYTES) {
    return NextResponse.json(
      { error: "attachments_too_large", message: partnerArchiveTooLargeMessage(file.size) },
      { status: 413 },
    );
  }

  const mime = (file.type || "").trim().toLowerCase();
  const name = file.name.trim() || "PROVIN_BUSINESS.pdf";
  if (mime !== "application/pdf" && !name.toLowerCase().endsWith(".pdf")) {
    return NextResponse.json({ error: "unsupported_file_type", message: "Atļauts tikai PDF." }, { status: 400 });
  }

  return persist(sessionId, name, Buffer.from(await file.arrayBuffer()));
}

async function persist(sessionId: string, name: string, bytes: Buffer): Promise<NextResponse> {
  try {
    const stored = await persistClientReportFromNotify(sessionId, [
      { filename: name, content: bytes, contentType: "application/pdf" },
    ]);
    if (!stored) {
      return NextResponse.json(
        { error: "persist_failed", message: "Neizdevās saglabāt PDF partnera arhīvā." },
        { status: 500 },
      );
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Nezināma kļūda";
    console.error("[api/admin/partner-client-report]", e);
    return NextResponse.json({ error: "persist_failed", message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, filename: name });
}

const BLOB_ERROR_LV: Record<string, string> = {
  invalid_blob_url: "Nederīga faila saite.",
  invalid_blob_host: "Nederīga faila saite.",
  blob_path_session_mismatch: "Fails nav šim pasūtījumam.",
  blob_fetch_failed: "Augšupielādēto PDF neizdevās nolasīt. Mēģini vēlreiz.",
  unsupported_file_type: "Atļauts tikai PDF.",
};

/** PDF jau Blob (`admin-notify-portfolio/<sessionId>/…`): lejupielādē, saglabā arhīvā, pagaidu failu izdzēš. */
async function saveFromBlob(req: Request): Promise<NextResponse> {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const sessionId = typeof body?.sessionId === "string" ? body.sessionId.trim() : "";
  if (!sessionId || !isSafeOrderDraftSessionId(sessionId)) {
    return NextResponse.json({ error: "missing_session_id" }, { status: 400 });
  }
  const url = typeof body?.blobUrl === "string" ? body.blobUrl.trim() : "";
  const filename = typeof body?.filename === "string" ? body.filename.trim() : "";
  if (!url) return NextResponse.json({ error: "no_file", message: "Pievieno PDF failu." }, { status: 400 });
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim() ?? "";
  if (!token) return NextResponse.json({ error: "blob_disabled", message: "Failu krātuve nav pieejama." }, { status: 503 });
  // Dzēš tikai šī pasūtījuma pagaidu failu (svešu saiti nekad).
  const own = isOwnNotifyBlobUrl(sessionId, url);
  if (!own) return NextResponse.json({ error: "blob_path_session_mismatch", message: BLOB_ERROR_LV.blob_path_session_mismatch }, { status: 400 });
  try {
    const order = await getCheckoutSessionDetail(sessionId);
    if (!order) return NextResponse.json({ error: "not_found", message: "Pasūtījums nav atrasts." }, { status: 404 });
    let files;
    try {
      files = await fetchNotifyBlobAttachmentsForEmail(sessionId, [{ url, ...(filename ? { filename } : {}) }], token);
    } catch (e) {
      const code = e instanceof Error ? e.message : "blob_fetch_failed";
      if (code === "attachments_too_large") {
        return NextResponse.json(
          { error: code, message: partnerArchiveTooLargeMessage(PARTNER_ARCHIVE_PDF_MAX_BYTES + 1) },
          { status: 413 },
        );
      }
      return NextResponse.json({ error: code, message: BLOB_ERROR_LV[code] ?? "Neizdevās nolasīt PDF." }, { status: 400 });
    }
    const pdf = files.find((f) => f.contentType === "application/pdf");
    if (!pdf) return NextResponse.json({ error: "unsupported_file_type", message: "Atļauts tikai PDF." }, { status: 400 });
    return await persist(sessionId, filename || pdf.filename || "PROVIN_BUSINESS.pdf", pdf.content);
  } finally {
    await deleteNotifyBlobUrls([url], token);
  }
}

function isOwnNotifyBlobUrl(sessionId: string, url: string): boolean {
  try {
    const u = new URL(url);
    return (
      u.protocol === "https:" &&
      isNotifyBlobHostname(u.hostname) &&
      decodeURIComponent(u.pathname).includes(`/${notifyPortfolioPathPrefix(sessionId)}/`)
    );
  } catch {
    return false;
  }
}
