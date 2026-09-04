import "server-only";

import fs from "node:fs/promises";
import path from "node:path";
import { get, put } from "@vercel/blob";
import {
  getOrderDraftBlobConfig,
  getOrderDraftStorageDir,
  isSafeOrderDraftSessionId,
  upsertOrderDraftClientReportFields,
} from "@/lib/admin-order-draft-store";
import type { ReportReadyMailAttachment } from "@/lib/email/send-transactional";
import { pickClientReportPdfAttachment } from "@/lib/partner-client-report";

function reportPdfBlobPathname(prefix: string, sessionId: string): string {
  const p = prefix.endsWith("/") ? prefix : `${prefix}/`;
  return `${p}client-reports/${sessionId}.pdf`;
}

function reportPdfFilePath(sessionId: string): string | null {
  const dir = getOrderDraftStorageDir();
  if (!dir || !isSafeOrderDraftSessionId(sessionId)) return null;
  return path.join(dir, "client-reports", `${sessionId}.pdf`);
}

async function readReportPdfFromBlob(sessionId: string): Promise<Uint8Array | null> {
  const blob = getOrderDraftBlobConfig();
  if (!blob || !isSafeOrderDraftSessionId(sessionId)) return null;
  try {
    const res = await get(reportPdfBlobPathname(blob.prefix, sessionId), {
      access: "private",
      token: blob.token,
      useCache: false,
    });
    if (!res || res.statusCode !== 200 || !res.stream) return null;
    const buf = await new Response(res.stream).arrayBuffer();
    return new Uint8Array(buf);
  } catch {
    return null;
  }
}

async function writeReportPdfToBlob(sessionId: string, bytes: Uint8Array): Promise<boolean> {
  const blob = getOrderDraftBlobConfig();
  if (!blob || !isSafeOrderDraftSessionId(sessionId)) return false;
  try {
    await put(reportPdfBlobPathname(blob.prefix, sessionId), Buffer.from(bytes), {
      access: "private",
      token: blob.token,
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/pdf",
    });
    return true;
  } catch {
    return false;
  }
}

async function readReportPdfFromDisk(sessionId: string): Promise<Uint8Array | null> {
  const fp = reportPdfFilePath(sessionId);
  if (!fp) return null;
  try {
    const buf = await fs.readFile(fp);
    return new Uint8Array(buf);
  } catch {
    return null;
  }
}

async function writeReportPdfToDisk(sessionId: string, bytes: Uint8Array): Promise<boolean> {
  const fp = reportPdfFilePath(sessionId);
  if (!fp) return false;
  try {
    await fs.mkdir(path.dirname(fp), { recursive: true });
    const tmp = `${fp}.tmp`;
    await fs.writeFile(tmp, bytes);
    await fs.rename(tmp, fp);
    return true;
  } catch {
    return false;
  }
}

export async function readClientReportPdf(sessionId: string): Promise<Uint8Array | null> {
  const fromBlob = await readReportPdfFromBlob(sessionId);
  if (fromBlob) return fromBlob;
  return readReportPdfFromDisk(sessionId);
}

export async function persistClientReportFromNotify(
  sessionId: string,
  attachments: ReportReadyMailAttachment[],
): Promise<boolean> {
  const picked = pickClientReportPdfAttachment(attachments);
  if (!picked || !isSafeOrderDraftSessionId(sessionId)) return false;
  const bytes = new Uint8Array(picked.content);
  const [blobOk, diskOk] = await Promise.all([
    writeReportPdfToBlob(sessionId, bytes),
    writeReportPdfToDisk(sessionId, bytes),
  ]);
  if (!blobOk && !diskOk) return false;
  const meta = await upsertOrderDraftClientReportFields(sessionId, {
    clientReportReadyAt: new Date().toISOString(),
    clientReportFilename: picked.filename,
  });
  return meta.ok;
}
