import "server-only";

import archiver from "archiver";
import { PassThrough } from "node:stream";
import { finished } from "node:stream/promises";
import { buildIrissPasutijumiListPdfBytes } from "@/lib/iriss-pasutijums-pdf";
import {
  irissPasutijumiListPdfFilename,
  orderIrissRecordsForListPdf,
} from "@/lib/iriss-pasutijumi-list-overview";
import {
  getIrissPasutijumiStorageState,
  listIrissPasutijumi,
  readIrissListOrder,
  readIrissPasutijums,
} from "@/lib/iriss-pasutijumi-store";
import type { IrissPasutijumiListOrder, IrissPasutijumsListRow, IrissPasutijumsRecord } from "@/lib/iriss-pasutijumi-types";

export type IrissOrdersBackupMeta = {
  exportedAt: string;
  draftFilesCount: number;
  listPdfIncluded: boolean;
  storage: ReturnType<typeof getIrissPasutijumiStorageState>;
};

function backupDateSlug(): string {
  return new Date().toISOString().slice(0, 10);
}

export function irissOrdersBackupFilename(ext: "zip" | "json" | "pdf"): string {
  if (ext === "pdf") return irissPasutijumiListPdfFilename();
  return `provin-iriss-pasutijumi-backup-${backupDateSlug()}.${ext}`;
}

async function collectIrissDraftRecords(): Promise<Map<string, IrissPasutijumsRecord>> {
  const map = new Map<string, IrissPasutijumsRecord>();
  const rows = await listIrissPasutijumi();
  for (const row of rows) {
    const rec = await readIrissPasutijums(row.id);
    if (!rec) continue;
    map.set(`${row.id}.json`, rec);
  }
  return map;
}

type Gathered = {
  records: Map<string, IrissPasutijumsRecord>;
  listOrder: Awaited<ReturnType<typeof readIrissListOrder>>;
  listRows: IrissPasutijumsListRow[];
  listPdf: Uint8Array | null;
  storage: ReturnType<typeof getIrissPasutijumiStorageState>;
};

async function gatherBackupParts(opts?: { includeListPdf?: boolean }): Promise<Gathered> {
  const includeListPdf = opts?.includeListPdf !== false;
  const storage = getIrissPasutijumiStorageState();
  const listOrder = await readIrissListOrder();
  const listRows = storage.enabled ? await listIrissPasutijumi() : [];
  const records = storage.enabled ? await collectIrissDraftRecords() : new Map<string, IrissPasutijumsRecord>();
  let listPdf: Uint8Array | null = null;
  if (includeListPdf) {
    try {
      const ordered = orderIrissRecordsForListPdf([...records.values()], listOrder);
      listPdf = await buildIrissPasutijumiListPdfBytes(ordered);
    } catch (e) {
      console.error("[admin iriss export] list pdf", e);
      listPdf = null;
    }
  }
  return { records, listOrder, listRows, listPdf, storage };
}

export type IrissOrdersBackupPayload = {
  meta: IrissOrdersBackupMeta;
  listOrder: IrissPasutijumiListOrder | null;
  listRows: IrissPasutijumsListRow[];
  orderDrafts: Record<string, string>;
};

function toPayload(g: Gathered): IrissOrdersBackupPayload {
  const orderDrafts: Record<string, string> = {};
  for (const [name, rec] of g.records) orderDrafts[name] = `${JSON.stringify(rec, null, 2)}\n`;
  return {
    meta: {
      exportedAt: new Date().toISOString(),
      draftFilesCount: g.records.size,
      listPdfIncluded: Boolean(g.listPdf),
      storage: g.storage,
    },
    listOrder: g.listOrder,
    listRows: g.listRows,
    orderDrafts,
  };
}

export async function buildIrissOrdersBackupJsonString(): Promise<string> {
  const g = await gatherBackupParts({ includeListPdf: false });
  return `${JSON.stringify(toPayload(g), null, 2)}\n`;
}

export async function buildIrissPasutijumiListPdfBuffer(): Promise<Uint8Array> {
  const g = await gatherBackupParts({ includeListPdf: true });
  if (g.listPdf) return g.listPdf;
  const ordered = orderIrissRecordsForListPdf([...g.records.values()], g.listOrder);
  return buildIrissPasutijumiListPdfBytes(ordered);
}

export async function buildIrissOrdersBackupZipBuffer(): Promise<Buffer> {
  const g = await gatherBackupParts({ includeListPdf: true });
  const payload = toPayload(g);

  const archive = archiver("zip", { zlib: { level: 6 } });
  const pass = new PassThrough();
  const chunks: Buffer[] = [];
  pass.on("data", (c: Buffer) => chunks.push(Buffer.from(c)));
  archive.on("error", (err: Error) => {
    throw err;
  });
  archive.pipe(pass);

  archive.append(JSON.stringify(payload.meta, null, 2), { name: "meta.json" });
  archive.append(`${JSON.stringify(g.listOrder, null, 2)}\n`, { name: "list-order.json" });
  archive.append(`${JSON.stringify(g.listRows, null, 2)}\n`, { name: "list-rows.json" });

  for (const [name, rec] of g.records) {
    archive.append(`${JSON.stringify(rec, null, 2)}\n`, { name: `drafts/${name}` });
  }

  if (g.listPdf) {
    archive.append(Buffer.from(g.listPdf), { name: irissPasutijumiListPdfFilename() });
  }

  await archive.finalize();
  await finished(pass);
  return Buffer.concat(chunks);
}
