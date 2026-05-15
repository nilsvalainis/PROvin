"use client";

import { uploadNotifyPortfolioBlobs } from "@/lib/admin-notify-upload-portfolio-client";

export async function isNotifyBlobUploadEnabled(): Promise<boolean> {
  const res = await fetch("/api/admin/notify-blob-upload", { credentials: "include" });
  if (!res.ok) return false;
  const j = (await res.json().catch(() => ({}))) as { enabled?: unknown };
  return j.enabled === true;
}

export function parseNotifyReportReadyResponse(res: Response, rawText: string): Record<string, unknown> {
  try {
    return rawText ? (JSON.parse(rawText) as Record<string, unknown>) : {};
  } catch {
    return {
      message:
        res.status === 413
          ? "Pieprasījums pārāk liels hostingam (413). Ja ir BLOB_READ_WRITE_TOKEN, lieli faili iet caur Blob; citādi samazini PDF vai sadali portfeli."
          : rawText.trim().slice(0, 400) || `HTTP ${res.status}`,
    };
  }
}

export async function postNotifyReportReadyMultipart(formData: FormData): Promise<{
  res: Response;
  rawText: string;
  data: Record<string, unknown>;
}> {
  const res = await fetch("/api/admin/notify-report-ready", {
    method: "POST",
    body: formData,
    credentials: "include",
  });
  const rawText = await res.text();
  return { res, rawText, data: parseNotifyReportReadyResponse(res, rawText) };
}

export type NotifyPortfolioUploadItem = {
  buffer: ArrayBuffer;
  name: string;
  mime: string;
  lastModified?: number;
};

/**
 * Augšupielādē portfeli (un opcionālo papildu audita PDF) uz Blob, tad nosūta mazu JSON uz notify-report-ready.
 */
export async function postNotifyReportReadyViaBlob(input: {
  sessionId: string;
  customerEmail?: string;
  uploads: NotifyPortfolioUploadItem[];
  extraAuditPdf?: File | null;
}): Promise<{ res: Response; rawText: string; data: Record<string, unknown> }> {
  const files: { blob: Blob; filename: string; mime: string }[] = [];
  for (const u of input.uploads) {
    files.push({
      blob: new Blob([u.buffer], { type: u.mime }),
      filename: u.name,
      mime: u.mime,
    });
  }
  const extra = input.extraAuditPdf;
  if (extra && extra.size > 0) {
    files.push({
      blob: extra,
      filename: extra.name || "PROVIN_AUDITS.pdf",
      mime: extra.type?.trim() || "application/pdf",
    });
  }
  const blobAttachments =
    files.length > 0
      ? await uploadNotifyPortfolioBlobs({ sessionId: input.sessionId, files })
      : [];
  const res = await fetch("/api/admin/notify-report-ready", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId: input.sessionId,
      ...(input.customerEmail?.trim() ? { customerEmail: input.customerEmail.trim() } : {}),
      blobAttachments,
    }),
  });
  const rawText = await res.text();
  return { res, rawText, data: parseNotifyReportReadyResponse(res, rawText) };
}
