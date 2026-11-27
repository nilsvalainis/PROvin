import "server-only";

/**
 * Pasūtījuma dokumenti pasūtījuma Dropbox mapes SAKNĒ (Nils 27.11: «visiem failiem, kuri ir nopirkti katram
 * pasūtījumam, jābūt Dropbox mapē; failus negrupēt»). Bez apakšmapēm; bildes - `order-photo-dropbox`.
 *
 * Dublikāti: ja saknē jau ir fails ar to pašu saturu (Dropbox content_hash) - neliek otrreiz. Tas pats nosaukums ar
 * citu saturu (jauna PDF versija) - Dropbox pievieno « (1)». Nekad nemet kļūdu.
 */

import { readAutodnaPdf, readAutodnaAutoStatus } from "@/lib/autodna-auto-store";
import { autodnaPdfFileName } from "@/lib/autodna-auto-logic";
import { readAuctionArchivePdf } from "@/lib/auction-archive-offer-store";
import { readCarfaxPdf, carfaxPdfFileName } from "@/lib/carfax-pdf-store";
import { readCarverticalAutoStatus, readCarverticalPdf } from "@/lib/carvertical-auto-store";
import { carverticalPdfFileName } from "@/lib/carvertical-auto-logic";
import { readClientReportSends } from "@/lib/client-report-sends";
import { dropboxReportFilename } from "@/lib/client-report-sends-core";
import { dropboxContentHash } from "@/lib/dropbox-content-hash";
import { DropboxApiError, getDropboxClient, type DropboxClient } from "@/lib/dropbox-client";
import { sanitizeDropboxName } from "@/lib/iriss-autoparks-dropbox-path";
import { currentOrderDropboxFolderPath, ensureOrderDropboxFolder } from "@/lib/order-dropbox";

const LOG = "[order-documents-dropbox]";

function errCode(e: unknown): string {
  if (e instanceof DropboxApiError) return `dropbox_${e.status}`;
  return e instanceof Error ? e.message.slice(0, 100) : "unknown";
}

type RootFiles = { folder: string; hashes: Set<string>; names: Set<string> };

async function rootFiles(sessionId: string, client: DropboxClient): Promise<RootFiles | null> {
  const rec = await ensureOrderDropboxFolder(sessionId, { client, materialize: true });
  if (!rec || rec.state !== "ok" || !rec.path) return null;
  const folder = await currentOrderDropboxFolderPath(client, rec);
  if (!folder) return null;
  const hashes = new Set<string>();
  const names = new Set<string>();
  try {
    const { entries } = await client.listAll(folder, { maxPages: 10 });
    for (const e of entries) {
      if (e.tag !== "file") continue;
      if (e.contentHash) hashes.add(e.contentHash);
      names.add(e.name.toLowerCase());
    }
  } catch {
    /* tukša / tikko izveidota mape */
  }
  return { folder, hashes, names };
}

async function putDocument(
  client: DropboxClient,
  root: RootFiles,
  fileName: string,
  bytes: Uint8Array,
): Promise<{ path: string; duplicate: boolean }> {
  const name = sanitizeDropboxName(fileName, 140) || "fails.pdf";
  const h = dropboxContentHash(bytes);
  if (root.hashes.has(h)) return { path: `${root.folder}/${name}`, duplicate: true };
  const up = await client.upload(`${root.folder}/${name}`, bytes, "add", { autorename: true });
  root.hashes.add(h);
  root.names.add((up.name || name).toLowerCase());
  return { path: up.pathDisplay || `${root.folder}/${name}`, duplicate: false };
}

/** Viens dokuments pasūtījuma mapes saknē (dīlera datiem mape rodas šajā brīdī). null - neizdevās / nav Dropbox. */
export async function saveOrderDocumentToDropbox(
  sessionId: string,
  fileName: string,
  bytes: Uint8Array,
): Promise<{ path: string; duplicate: boolean } | null> {
  const client = getDropboxClient();
  if (!client || !bytes.length) return null;
  try {
    const root = await rootFiles(sessionId, client);
    if (!root) return null;
    return await putDocument(client, root, fileName, bytes);
  } catch (e) {
    console.warn(`${LOG} save failed`, { sessionId: sessionId.slice(-8), error: errCode(e) });
    return null;
  }
}

/** Fona variants maršrutiem: kļūda nekad neaptur atbildi klientam. */
export function saveOrderDocumentToDropboxSafe(sessionId: string, fileName: string, bytes: Uint8Array): Promise<void> {
  return saveOrderDocumentToDropbox(sessionId, fileName, bytes).then(
    () => undefined,
    () => undefined,
  );
}

export type OrderDocumentsBackfillResult = { found: number; uploaded: number; duplicates: number; failed: number; folder: string | null };

/**
 * «Saglabāt visu Dropbox»: visi serverī glabātie pasūtījuma dokumenti -> mapes saknē (bez dublikātiem):
 * PROVIN atskaišu versijas (visas valodas), AutoDNA, CarVertical, CARFAX, izsoļu arhīva PDF.
 * LTAB, Traficom, CheckThisReg, e.csdd / CSDD SMS izziņas Dropbox nonāk jau saņemšanas brīdī (krātuvē to kopijas nav).
 */
export async function backfillOrderDocumentsToDropbox(
  sessionId: string,
  opts: { vin?: string; client?: DropboxClient | null; deadlineAt?: number } = {},
): Promise<OrderDocumentsBackfillResult> {
  const out: OrderDocumentsBackfillResult = { found: 0, uploaded: 0, duplicates: 0, failed: 0, folder: null };
  const client = opts.client === undefined ? getDropboxClient() : opts.client;
  if (!client) return out;
  const deadlineAt = opts.deadlineAt ?? Date.now() + 60_000;
  const vin = (opts.vin ?? "").trim();
  const docs: { name: string; load: () => Promise<Uint8Array | null> }[] = [];

  const sends = await readClientReportSends(sessionId).catch(() => []);
  const { get } = await import("@vercel/blob");
  const { getOrderDraftBlobConfig } = await import("@/lib/admin-order-draft-store");
  const blob = getOrderDraftBlobConfig();
  for (const s of sends) {
    if (!s.archivePath) continue;
    docs.push({
      name: dropboxReportFilename(s.version, s.filename),
      load: async () => {
        if (blob && !s.archivePath!.startsWith("/")) {
          const res = await get(s.archivePath!, { access: "private", token: blob.token, useCache: false });
          return res?.statusCode === 200 && res.stream ? new Uint8Array(await new Response(res.stream).arrayBuffer()) : null;
        }
        const fs = await import("fs/promises");
        return new Uint8Array(await fs.readFile(s.archivePath!));
      },
    });
  }
  const adna = await readAutodnaAutoStatus(sessionId).catch(() => null);
  docs.push({ name: autodnaPdfFileName(adna?.vin || vin), load: () => readAutodnaPdf(sessionId) });
  const cv = await readCarverticalAutoStatus(sessionId).catch(() => null);
  docs.push({ name: carverticalPdfFileName(cv?.vin || vin), load: () => readCarverticalPdf(sessionId) });
  docs.push({ name: carfaxPdfFileName(vin), load: () => readCarfaxPdf(sessionId) });
  const { auctionArchiveReportPdfFilename } = await import("@/lib/auction-archive-report");
  docs.push({
    name: auctionArchiveReportPdfFilename(vin, "lv"),
    load: async () => {
      const b = await readAuctionArchivePdf(sessionId);
      return b ? new Uint8Array(b) : null;
    },
  });

  let root: RootFiles | null = null;
  for (const d of docs) {
    if (Date.now() > deadlineAt - 5_000) break;
    const bytes = await d.load().catch(() => null);
    if (!bytes?.length) continue;
    out.found += 1;
    try {
      root ??= await rootFiles(sessionId, client);
      if (!root) {
        out.failed += 1;
        continue;
      }
      out.folder = root.folder;
      const r = await putDocument(client, root, d.name, bytes);
      if (r.duplicate) out.duplicates += 1;
      else out.uploaded += 1;
    } catch (e) {
      out.failed += 1;
      console.warn(`${LOG} backfill failed`, { sessionId: sessionId.slice(-8), error: errCode(e) });
    }
  }
  return out;
}
