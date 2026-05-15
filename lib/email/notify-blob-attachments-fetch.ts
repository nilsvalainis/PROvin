import "server-only";

import { del, get } from "@vercel/blob";
import {
  isNotifyBlobHostname,
  isSafeStripeCheckoutSessionId,
  notifyPortfolioPathPrefix,
} from "@/lib/admin-notify-blob-constants";
import { NOTIFY_REPORT_MAX_ATTACHMENTS_BYTES } from "@/lib/notify-report-email-limits";
import { sanitizeAttachmentFilename } from "@/lib/email/notify-attachments-parse";
import type { ReportReadyMailAttachment } from "@/lib/email/send-transactional";

const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

function extMime(pathLower: string): string {
  if (pathLower.endsWith(".pdf")) return "application/pdf";
  if (pathLower.endsWith(".jpg") || pathLower.endsWith(".jpeg")) return "image/jpeg";
  if (pathLower.endsWith(".png")) return "image/png";
  if (pathLower.endsWith(".webp")) return "image/webp";
  if (pathLower.endsWith(".gif")) return "image/gif";
  return "application/octet-stream";
}

function normalizeMime(filename: string, declared: string | null): string {
  const t = (declared ?? "").trim().toLowerCase();
  if (t && ALLOWED_MIME.has(t)) return t;
  return extMime(filename.toLowerCase());
}

export type NotifyBlobAttachmentRef = { url: string; filename?: string };

/**
 * Lejupielādē no Vercel Blob portfeļa failus, ko augšupielādēja klients (lieli pielikumi, apiņot Vercel API route ķermeni).
 */
export async function fetchNotifyBlobAttachmentsForEmail(
  sessionId: string,
  items: NotifyBlobAttachmentRef[],
  blobToken: string,
): Promise<ReportReadyMailAttachment[]> {
  const sid = sessionId.trim();
  if (!isSafeStripeCheckoutSessionId(sid)) {
    throw new Error("invalid_session_id");
  }
  const expectedNeedle = `/${notifyPortfolioPathPrefix(sid)}/`;

  let total = 0;
  const out: ReportReadyMailAttachment[] = [];

  for (const item of items) {
    const urlStr = (item.url ?? "").trim();
    if (!urlStr) continue;
    let u: URL;
    try {
      u = new URL(urlStr);
    } catch {
      throw new Error("invalid_blob_url");
    }
    if (u.protocol !== "https:") throw new Error("invalid_blob_url");
    if (!isNotifyBlobHostname(u.hostname)) throw new Error("invalid_blob_host");
    const path = decodeURIComponent(u.pathname);
    if (!path.includes(expectedNeedle)) throw new Error("blob_path_session_mismatch");

    const res = await get(urlStr, { access: "private", token: blobToken, useCache: false });
    if (!res || res.statusCode !== 200 || !res.stream) {
      throw new Error("blob_fetch_failed");
    }
    const buf = Buffer.from(await new Response(res.stream).arrayBuffer());
    total += buf.length;
    if (total > NOTIFY_REPORT_MAX_ATTACHMENTS_BYTES) {
      throw new Error("attachments_too_large");
    }
    const rawName = (item.filename ?? "").trim() || res.blob.pathname.split("/").pop() || "pielikums.pdf";
    const filename = sanitizeAttachmentFilename(rawName, "pielikums.pdf");
    const contentType = normalizeMime(filename, res.blob.contentType);
    if (!ALLOWED_MIME.has(contentType)) {
      throw new Error("unsupported_file_type");
    }
    out.push({ filename, content: buf, contentType });
  }

  return out;
}

export async function deleteNotifyBlobUrls(urls: string[], blobToken: string): Promise<void> {
  const clean = urls.map((u) => u.trim()).filter(Boolean);
  if (clean.length === 0) return;
  await Promise.all(
    clean.map(async (url) => {
      try {
        await del(url, { token: blobToken });
      } catch {
        /* best-effort cleanup */
      }
    }),
  );
}
