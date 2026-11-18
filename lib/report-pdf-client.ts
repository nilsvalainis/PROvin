"use client";

import { upload } from "@vercel/blob/client";
import { reportPdfPathPrefix } from "@/lib/report-pdf-constants";

export type ServerReportPdfResult = { pdfPathname: string; downloadUrl: string; filename: string; bytes: number; ms: number; fontsReady: boolean };

/**
 * Servera PDF izmēģinājums: atskaites HTML -> privāts Blob -> `/api/admin/report-pdf` (Chromium) -> lejupielādes saite.
 * Neko nesūta un pasūtījumu nemaina.
 */
export async function renderReportPdfOnServer(input: { sessionId: string; html: string; filename: string }): Promise<ServerReportPdfResult> {
  const sid = input.sessionId.trim();
  const blob = new Blob([input.html], { type: "text/html" });
  const htmlPathname = `${reportPdfPathPrefix(sid)}${Date.now()}-atskaite.html`;
  const up = await upload(htmlPathname, blob, {
    access: "private",
    handleUploadUrl: "/api/admin/report-pdf/upload",
    clientPayload: JSON.stringify({ sessionId: sid }),
    multipart: blob.size > 8 * 1024 * 1024,
    contentType: "text/html",
  });
  const res = await fetch("/api/admin/report-pdf", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId: sid, htmlPathname: up.pathname, filename: input.filename }),
  });
  const j = (await res.json().catch(() => null)) as
    | { ok?: boolean; pdfPathname?: string; filename?: string; bytes?: number; ms?: number; fontsReady?: boolean; message?: string; error?: string }
    | null;
  if (!res.ok || !j?.ok || !j.pdfPathname) {
    throw new Error(j?.message || j?.error || `HTTP ${res.status}`);
  }
  const q = new URLSearchParams({ sessionId: sid, pathname: j.pdfPathname });
  return {
    pdfPathname: j.pdfPathname,
    downloadUrl: `/api/admin/report-pdf?${q.toString()}`,
    filename: j.filename ?? input.filename,
    bytes: j.bytes ?? 0,
    ms: j.ms ?? 0,
    fontsReady: j.fontsReady === true,
  };
}
