import "server-only";

import { NOTIFY_REPORT_MAX_ATTACHMENTS_BYTES } from "@/lib/notify-report-email-limits";

export const MAX_NOTIFY_ATTACHMENTS_BYTES = NOTIFY_REPORT_MAX_ATTACHMENTS_BYTES;
export const MAX_NOTIFY_FILES = 20;

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

/** Drošs pielikuma nosaukums (bez ceļiem). */
export function sanitizeAttachmentFilename(raw: string, fallback: string): string {
  const base = raw.replace(/\\/g, "/").split("/").pop()?.trim() || fallback;
  const cleaned = base
    .replace(/[^a-zA-Z0-9._\-\s]+/g, "_")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 120);
  return cleaned || fallback;
}

export type ParsedMailAttachment = {
  filename: string;
  content: Buffer;
  contentType: string;
};

function normalizeMime(filename: string, declared: string | null): string {
  const t = (declared ?? "").trim().toLowerCase();
  if (t && ALLOWED_MIME.has(t)) return t;
  return extMime(filename.toLowerCase());
}

export async function collectAttachmentsFromFormData(form: FormData): Promise<{
  attachments: ParsedMailAttachment[];
  totalBytes: number;
}> {
  const out: ParsedMailAttachment[] = [];
  let totalBytes = 0;

  const pushFile = async (f: File, fallbackName: string) => {
    if (!(f instanceof File) || f.size <= 0) return;
    if (out.length >= MAX_NOTIFY_FILES) {
      throw new Error("too_many_attachments");
    }
    totalBytes += f.size;
    if (totalBytes > MAX_NOTIFY_ATTACHMENTS_BYTES) {
      throw new Error("attachments_too_large");
    }
    const buf = Buffer.from(await f.arrayBuffer());
    const filename = sanitizeAttachmentFilename(f.name, fallbackName);
    const contentType = normalizeMime(filename, f.type);
    if (!ALLOWED_MIME.has(contentType) && contentType !== "application/octet-stream") {
      throw new Error("unsupported_file_type");
    }
    if (contentType === "application/octet-stream") {
      throw new Error("unsupported_file_type");
    }
    out.push({ filename, content: buf, contentType });
  };

  const report = form.get("reportPdf");
  if (report instanceof File) await pushFile(report, "PROVIN_atskaite.pdf");

  for (const v of form.getAll("attachment")) {
    if (v instanceof File) await pushFile(v, "pielikums.pdf");
  }

  return { attachments: out, totalBytes };
}

export function collectAttachmentsFromJsonBase64(
  items: unknown,
): { attachments: ParsedMailAttachment[]; totalBytes: number } {
  if (!Array.isArray(items)) return { attachments: [], totalBytes: 0 };
  const out: ParsedMailAttachment[] = [];
  let totalBytes = 0;

  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const nameRaw = typeof o.filename === "string" ? o.filename : typeof o.name === "string" ? o.name : "";
    const data = typeof o.data === "string" ? o.data : "";
    const mimeRaw = typeof o.mimeType === "string" ? o.mimeType : typeof o.contentType === "string" ? o.contentType : "";
    if (!data) continue;
    if (out.length >= MAX_NOTIFY_FILES) throw new Error("too_many_attachments");
    let buf: Buffer;
    try {
      buf = Buffer.from(data, "base64");
    } catch {
      continue;
    }
    if (buf.length <= 0) continue;
    totalBytes += buf.length;
    if (totalBytes > MAX_NOTIFY_ATTACHMENTS_BYTES) throw new Error("attachments_too_large");
    const filename = sanitizeAttachmentFilename(nameRaw, "pielikums.pdf");
    const contentType = normalizeMime(filename, mimeRaw || null);
    if (!ALLOWED_MIME.has(contentType)) throw new Error("unsupported_file_type");
    out.push({ filename, content: buf, contentType });
  }

  return { attachments: out, totalBytes };
}
