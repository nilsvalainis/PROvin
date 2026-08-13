import "server-only";

import { del, get } from "@vercel/blob";

import {
  isSafeAdminOrderId,
  isVercelBlobHostname,
  sourcePdfBlobPathPrefix,
  type SourcePdfBlobRef,
} from "@/lib/admin-source-pdf-blob-constants";
import { PDF_MAX_FILE_BYTES } from "@/lib/pdf-api-limits";

export type FetchedSourcePdf = { fileName: string; buffer: ArrayBuffer; url: string };

function blobRwToken(): string | null {
  return process.env.BLOB_READ_WRITE_TOKEN?.trim() || null;
}

/** Klienta augšupielādētie avotu PDF no Blob — tikai šī pasūtījuma ceļā un tikai PDF. */
export async function fetchSourcePdfsFromBlob(
  sessionId: string,
  refs: SourcePdfBlobRef[],
): Promise<FetchedSourcePdf[]> {
  if (refs.length === 0) return [];
  const sid = sessionId.trim();
  if (!isSafeAdminOrderId(sid)) throw new Error("invalid_session_id");
  const token = blobRwToken();
  if (!token) throw new Error("blob_token_missing");
  const expected = `/${sourcePdfBlobPathPrefix(sid)}/`;

  const out: FetchedSourcePdf[] = [];
  for (const ref of refs) {
    const urlStr = (ref.url ?? "").trim();
    if (!urlStr) continue;
    let u: URL;
    try {
      u = new URL(urlStr);
    } catch {
      throw new Error("invalid_blob_url");
    }
    if (u.protocol !== "https:") throw new Error("invalid_blob_url");
    if (!isVercelBlobHostname(u.hostname)) throw new Error("invalid_blob_host");
    if (!decodeURIComponent(u.pathname).includes(expected)) throw new Error("blob_path_session_mismatch");

    const res = await get(urlStr, { access: "private", token, useCache: false });
    if (!res || res.statusCode !== 200 || !res.stream) throw new Error("blob_fetch_failed");
    const buffer = await new Response(res.stream).arrayBuffer();
    if (buffer.byteLength > PDF_MAX_FILE_BYTES) throw new Error("file_too_large");

    const name =
      (ref.name ?? "").trim() || res.blob.pathname.split("/").pop() || "atskaite.pdf";
    out.push({ fileName: name, buffer, url: urlStr });
  }
  return out;
}

/** Pagaidu faili krātuvē pēc apstrādes vairs nav vajadzīgi. */
export async function deleteSourcePdfBlobs(urls: string[]): Promise<void> {
  const token = blobRwToken();
  const clean = urls.map((u) => u.trim()).filter(Boolean);
  if (!token || clean.length === 0) return;
  await Promise.all(
    clean.map(async (url) => {
      try {
        await del(url, { token });
      } catch {
        /* best-effort */
      }
    }),
  );
}