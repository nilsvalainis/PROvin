"use client";

import { put } from "@vercel/blob/client";

import {
  SOURCE_PDF_BLOB_CLIENT_TOKEN_ACTION,
  SOURCE_PDF_DIRECT_UPLOAD_MAX_BYTES,
  sourcePdfBlobPathPrefix,
} from "@/lib/admin-source-pdf-blob-constants";

export type SourcePdfBlobRef = { url: string; name: string };

/** Vai fails jāsūta caur Blob (Vercel funkcijas ķermenis ir mazāks par PDF). */
export function sourcePdfNeedsBlobUpload(file: File): boolean {
  return file.size > SOURCE_PDF_DIRECT_UPLOAD_MAX_BYTES;
}

/** Kļūda ar latvisku iemeslu, ko UI var parādīt tieši operatoram. */
export class SourcePdfBlobUploadError extends Error {}

async function fetchSourcePdfClientToken(pathname: string, sessionId: string): Promise<string> {
  const res = await fetch("/api/admin/copilot/pdf-blob-upload", {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      action: SOURCE_PDF_BLOB_CLIENT_TOKEN_ACTION,
      pathname,
      sessionId,
    }),
  });
  const j = (await res.json().catch(() => ({}))) as {
    clientToken?: unknown;
    error?: unknown;
    message?: unknown;
  };
  if (!res.ok) {
    const serverMsg = typeof j.message === "string" ? j.message.trim() : "";
    if (res.status === 401) {
      throw new SourcePdfBlobUploadError("Admin sesija beigusies — ielogojies vēlreiz.");
    }
    if (res.status === 503 || j.error === "blob_disabled" || j.error === "blob_token_invalid") {
      throw new SourcePdfBlobUploadError(
        serverMsg || "Serverī nav derīga BLOB_READ_WRITE_TOKEN — PDF, kas lielāki par ~3 MB, nevar augšupielādēt",
      );
    }
    throw new SourcePdfBlobUploadError(serverMsg || `Neizdevās saņemt Blob atļauju (HTTP ${res.status})`);
  }
  if (typeof j.clientToken !== "string" || !j.clientToken.startsWith("vercel_blob_client_")) {
    throw new SourcePdfBlobUploadError("Serveris neatgrieza derīgu Blob augšupielādes atļauju.");
  }
  return j.clientToken;
}

export async function uploadSourcePdfToBlob(sessionId: string, file: File): Promise<SourcePdfBlobRef> {
  const sid = sessionId.trim();
  const safe = (file.name || "atskaite.pdf").replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 100);
  const pathname = `${sourcePdfBlobPathPrefix(sid)}/${Date.now()}-${safe || "atskaite.pdf"}`;

  try {
    const token = await fetchSourcePdfClientToken(pathname, sid);
    const result = await put(pathname, file, {
      access: "private",
      token,
      multipart: file.size > 8 * 1024 * 1024,
      contentType: "application/pdf",
    });
    return { url: result.url, name: file.name || "atskaite.pdf" };
  } catch (e) {
    if (e instanceof SourcePdfBlobUploadError) throw e;
    const message = e instanceof Error ? e.message : String(e);
    throw new SourcePdfBlobUploadError(
      /BLOB_READ_WRITE_TOKEN|blob_disabled/i.test(message)
        ? "Serverī nav BLOB_READ_WRITE_TOKEN — PDF, kas lielāki par ~3 MB, nevar augšupielādēt"
        : `Neizdevās augšupielādēt PDF krātuvē: ${message}`,
    );
  }
}
