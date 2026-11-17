import "server-only";

import fs from "node:fs/promises";
import path from "node:path";
import { get, put } from "@vercel/blob";
import { getOrderDraftBlobConfig, getOrderDraftStorageDir, isSafeOrderDraftSessionId } from "@/lib/admin-order-draft-store";
import { nextClientReportVersion, versionedReportFilename, type ClientReportSend } from "@/lib/client-report-sends-core";

/**
 * "Sūtīt atskaiti" (2. posms, Nils 17.11, G9): katrs nosūtītais servera PDF paliek arhīvā ar versijas numuru,
 * nevis tiek pārrakstīts. Žurnāls `client-report-sends/<id>.json`, faili `client-reports/<id>/v<N>-<nosaukums>.pdf`.
 * Esošais viena faila arhīvs (`client-reports/<id>.pdf`, partneru portālam) paliek nemainīts.
 */

function pfx(prefix: string): string {
  return prefix.endsWith("/") ? prefix : `${prefix}/`;
}

export async function readClientReportSends(sessionId: string): Promise<ClientReportSend[]> {
  if (!isSafeOrderDraftSessionId(sessionId)) return [];
  const blob = getOrderDraftBlobConfig();
  try {
    if (blob) {
      const res = await get(`${pfx(blob.prefix)}client-report-sends/${sessionId}.json`, { access: "private", token: blob.token, useCache: false });
      if (!res || res.statusCode !== 200 || !res.stream) return [];
      const j = JSON.parse(await new Response(res.stream).text()) as unknown;
      return Array.isArray(j) ? (j as ClientReportSend[]) : [];
    }
    const dir = getOrderDraftStorageDir();
    if (!dir) return [];
    const j = JSON.parse(await fs.readFile(path.join(dir, "client-report-sends", `${sessionId}.json`), "utf8")) as unknown;
    return Array.isArray(j) ? (j as ClientReportSend[]) : [];
  } catch {
    return [];
  }
}

/** Saglabā PDF kā jaunu versiju un ieraksta žurnālā. Atgriež ierakstu (ar `archivePath`, ja izdevās). */
export async function recordClientReportSend(
  sessionId: string,
  entry: Omit<ClientReportSend, "version" | "archivePath">,
  pdf: Uint8Array,
): Promise<ClientReportSend> {
  const prev = await readClientReportSends(sessionId);
  const version = nextClientReportVersion(prev);
  const file = versionedReportFilename(version, entry.filename);
  const out: ClientReportSend = { ...entry, version };
  const blob = getOrderDraftBlobConfig();
  if (blob) {
    const archivePath = `${pfx(blob.prefix)}client-reports/${sessionId}/${file}`;
    await put(archivePath, Buffer.from(pdf), { access: "private", token: blob.token, addRandomSuffix: false, allowOverwrite: true, contentType: "application/pdf" });
    out.archivePath = archivePath;
    await put(`${pfx(blob.prefix)}client-report-sends/${sessionId}.json`, JSON.stringify([...prev, out], null, 1), {
      access: "private",
      token: blob.token,
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
    });
    return out;
  }
  const dir = getOrderDraftStorageDir();
  if (dir) {
    const fp = path.join(dir, "client-reports", sessionId, file);
    await fs.mkdir(path.dirname(fp), { recursive: true });
    await fs.writeFile(fp, pdf);
    out.archivePath = fp;
    const logPath = path.join(dir, "client-report-sends", `${sessionId}.json`);
    await fs.mkdir(path.dirname(logPath), { recursive: true });
    await fs.writeFile(logPath, JSON.stringify([...prev, out], null, 1));
  }
  return out;
}
