"use client";

import { upload } from "@vercel/blob/client";

import {
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

export async function uploadSourcePdfToBlob(sessionId: string, file: File): Promise<SourcePdfBlobRef> {
  const sid = sessionId.trim();
  const safe = (file.name || "atskaite.pdf").replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 100);
  const pathname = `${sourcePdfBlobPathPrefix(sid)}/${Date.now()}-${safe || "atskaite.pdf"}`;

  try {
    const result = await upload(pathname, file, {
      access: "private",
      handleUploadUrl: "/api/admin/copilot/pdf-blob-upload",
      clientPayload: JSON.stringify({ sessionId: sid }),
      multipart: file.size > 8 * 1024 * 1024,
      contentType: "application/pdf",
    });
    return { url: result.url, name: file.name || "atskaite.pdf" };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    throw new SourcePdfBlobUploadError(
      /BLOB_READ_WRITE_TOKEN|blob_disabled/i.test(message)
        ? "Serverī nav BLOB_READ_WRITE_TOKEN — PDF, kas lielāki par ~3 MB, nevar augšupielādēt"
        : `Neizdevās augšupielādēt PDF krātuvē: ${message}`,
    );
  }
}
