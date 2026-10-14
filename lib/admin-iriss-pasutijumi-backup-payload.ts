/**
 * IRISS Pasūtījumi rezerves kopijas JSON forma (bez Blob/FS I/O).
 * Pilni pasūtījumi un piedāvājumi, ieskaitot attēlu dataUrl / blob atsauces.
 */

import { irissPasutijumiListPdfFilename } from "@/lib/iriss-pasutijumi-list-overview";
import type { IrissPasutijumiListOrder, IrissPasutijumsListRow, IrissPasutijumsRecord } from "@/lib/iriss-pasutijumi-types";

export type IrissOrdersBackupStorageMeta = {
  enabled: boolean;
  reason?: string;
  persistence?: string;
  path?: string;
};

export type IrissOrdersBackupMeta = {
  exportedAt: string;
  draftFilesCount: number;
  listPdfIncluded: boolean;
  storage: IrissOrdersBackupStorageMeta;
};

export type IrissOrdersBackupPayload = {
  meta: IrissOrdersBackupMeta;
  listOrder: IrissPasutijumiListOrder | null;
  listRows: IrissPasutijumsListRow[];
  orderDrafts: Record<string, string>;
};

function backupDateSlug(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function irissOrdersBackupFilename(ext: "zip" | "json" | "pdf", now = new Date()): string {
  if (ext === "pdf") return irissPasutijumiListPdfFilename(now);
  return `provin-iriss-pasutijumi-backup-${backupDateSlug(now)}.${ext}`;
}

export function serializeIrissOrderDraft(record: IrissPasutijumsRecord): string {
  return `${JSON.stringify(record, null, 2)}\n`;
}

export function buildIrissOrdersBackupPayload(input: {
  records: Iterable<[string, IrissPasutijumsRecord]>;
  listOrder: IrissPasutijumiListOrder | null;
  listRows: IrissPasutijumsListRow[];
  storage: IrissOrdersBackupStorageMeta;
  exportedAt?: string;
  listPdfIncluded?: boolean;
}): IrissOrdersBackupPayload {
  const orderDrafts: Record<string, string> = {};
  let count = 0;
  for (const [name, rec] of input.records) {
    orderDrafts[name] = serializeIrissOrderDraft(rec);
    count += 1;
  }
  return {
    meta: {
      exportedAt: input.exportedAt ?? new Date().toISOString(),
      draftFilesCount: count,
      listPdfIncluded: Boolean(input.listPdfIncluded),
      storage: input.storage,
    },
    listOrder: input.listOrder,
    listRows: input.listRows,
    orderDrafts,
  };
}

export function backupPayloadContainsOfferImages(payload: IrissOrdersBackupPayload): boolean {
  for (const raw of Object.values(payload.orderDrafts)) {
    if (raw.includes('"dataUrl"') || raw.includes('"blobPath"') || raw.includes('"blobUrl"')) return true;
  }
  return false;
}
