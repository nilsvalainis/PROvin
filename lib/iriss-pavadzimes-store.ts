import "server-only";

import { get, put } from "@vercel/blob";
import fs from "fs/promises";
import path from "path";
import { extractPdfTextOnServer } from "@/lib/pdf-text-extract-server";
import { downloadDropboxFile, isDropboxConfigured, listDropboxPavadzimes, type DropboxWaybillFile } from "@/lib/iriss-pavadzimes-dropbox";
import {
  applyParsedFields,
  isCsddWaybillText,
  isSafeIrissPavadzimeId,
  parseCsddWaybill,
  parseCsddWaybillFileName,
  sortIrissPavadzimes,
  waybillIdFromNumber,
} from "@/lib/iriss-pavadzimes-parse";
import { isIrissPavadzimeSyncBlocked } from "@/lib/iriss-pavadzimes-sync-blocklist";
import {
  emptyIrissPavadzimeRecord,
  type IrissPavadzimeRecord,
  type IrissPavadzimesIndex,
} from "@/lib/iriss-pavadzimes-types";

const BLOB_PREFIX = "iriss-pavadzimes/";
export const IRISS_PAVADZIMES_BLOB_PREFIX = BLOB_PREFIX;
const INDEX_NAME = "index.json";
const DEFAULT_FS_DIR = ".data/iriss-pavadzimes";
const PARSE_BATCH = 24;
const PARSE_CONCURRENCY = 4;

type ResolvedStorage = { kind: "fs"; dir: string } | { kind: "blob"; token: string };

function blobToken(): string {
  return process.env.BLOB_READ_WRITE_TOKEN?.trim() ?? "";
}

export function getIrissPavadzimesStorageDir(): string | null {
  const r = resolveStorage();
  return r.kind === "fs" ? r.dir : null;
}

function resolveStorage(): ResolvedStorage {
  const token = blobToken();
  if (token) return { kind: "blob", token };
  return { kind: "fs", dir: path.join(process.cwd(), DEFAULT_FS_DIR) };
}

function indexBlobPath(): string {
  return `${BLOB_PREFIX}${INDEX_NAME}`;
}

function pdfBlobPath(id: string): string {
  return `${BLOB_PREFIX}pdf/${id}.pdf`;
}

function fsIndexPath(dir: string): string {
  return path.join(dir, INDEX_NAME);
}

function fsPdfPath(dir: string, id: string): string {
  return path.join(dir, "pdf", `${id}.pdf`);
}

function emptyIndex(nowIso = new Date().toISOString()): IrissPavadzimesIndex {
  return { version: 1, updatedAt: nowIso, items: [] };
}

function parseIndex(raw: string): IrissPavadzimesIndex {
  try {
    const o = JSON.parse(raw) as Partial<IrissPavadzimesIndex>;
    if (!o || typeof o !== "object") return emptyIndex();
    const items = withoutSyncBlocked(Array.isArray(o.items) ? o.items.filter(isRecord) : []);
    return {
      version: 1,
      updatedAt: typeof o.updatedAt === "string" ? o.updatedAt : new Date().toISOString(),
      items,
    };
  } catch {
    return emptyIndex();
  }
}

function isRecord(v: unknown): v is IrissPavadzimeRecord {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return typeof o.id === "string" && isSafeIrissPavadzimeId(o.id);
}

function withoutSyncBlocked(items: IrissPavadzimeRecord[]): IrissPavadzimeRecord[] {
  return items.filter(
    (rec) =>
      !isIrissPavadzimeSyncBlocked({
        id: rec.id,
        number: rec.number,
        plate: rec.plate,
        fileName: rec.fileName,
      }),
  );
}

async function readIndex(): Promise<IrissPavadzimesIndex> {
  const r = resolveStorage();
  if (r.kind === "blob") {
    try {
      const res = await get(indexBlobPath(), { access: "private", token: r.token, useCache: false });
      if (res && res.statusCode === 200 && res.stream) {
        return parseIndex(await new Response(res.stream).text());
      }
    } catch {
      /* tukšs */
    }
    return emptyIndex();
  }
  try {
    return parseIndex(await fs.readFile(fsIndexPath(r.dir), "utf8"));
  } catch {
    return emptyIndex();
  }
}

async function writeIndex(doc: IrissPavadzimesIndex): Promise<void> {
  const next: IrissPavadzimesIndex = { ...doc, version: 1, updatedAt: new Date().toISOString() };
  const body = JSON.stringify(next);
  const r = resolveStorage();
  if (r.kind === "blob") {
    await put(indexBlobPath(), body, {
      access: "private",
      token: r.token,
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
    });
    return;
  }
  await fs.mkdir(r.dir, { recursive: true });
  const fp = fsIndexPath(r.dir);
  const tmp = `${fp}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, body, "utf8");
  await fs.rename(tmp, fp);
}

async function writePdfBytes(id: string, bytes: Buffer): Promise<string> {
  const r = resolveStorage();
  if (r.kind === "blob") {
    const pathname = pdfBlobPath(id);
    await put(pathname, bytes, {
      access: "private",
      token: r.token,
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/pdf",
    });
    return pathname;
  }
  const fp = fsPdfPath(r.dir, id);
  await fs.mkdir(path.dirname(fp), { recursive: true });
  await fs.writeFile(fp, bytes);
  return path.relative(process.cwd(), fp);
}

async function readPdfBytes(rec: IrissPavadzimeRecord): Promise<Buffer | null> {
  if (rec.blobPath) {
    const r = resolveStorage();
    if (r.kind === "blob") {
      try {
        const res = await get(rec.blobPath, { access: "private", token: r.token, useCache: false });
        if (res && res.statusCode === 200 && res.stream) {
          return Buffer.from(await new Response(res.stream).arrayBuffer());
        }
      } catch {
        /* Dropbox rezerve */
      }
    } else {
      try {
        const abs = path.isAbsolute(rec.blobPath) ? rec.blobPath : path.join(process.cwd(), rec.blobPath);
        return await fs.readFile(abs);
      } catch {
        /* Dropbox rezerve */
      }
    }
  }
  if (rec.source === "dropbox" && rec.dropboxPath) {
    return downloadDropboxFile(rec.dropboxId ? rec.dropboxId : rec.dropboxPath);
  }
  return null;
}

export type IrissPavadzimesListResult = {
  rows: IrissPavadzimeRecord[];
  pendingParse: number;
  dropboxConfigured: boolean;
  dropboxError: string | null;
};

export type IrissPavadzimesSyncResult = IrissPavadzimesListResult & {
  ok: boolean;
  updatedAt: string;
  itemCount: number;
  indexChanged: boolean;
};

function backupIndexBlobName(now = new Date()): string {
  const ts = now.toISOString().replace(/[:.]/g, "-");
  return `index.backup-${ts}.json`;
}

async function backupIndexBeforeWrite(doc: IrissPavadzimesIndex): Promise<void> {
  if (!doc.items.length && !doc.updatedAt) return;
  const body = JSON.stringify(doc);
  const r = resolveStorage();
  const name = backupIndexBlobName();
  if (r.kind === "blob") {
    await put(`${BLOB_PREFIX}${name}`, body, {
      access: "private",
      token: r.token,
      addRandomSuffix: false,
      allowOverwrite: false,
      contentType: "application/json",
    });
    return;
  }
  await fs.mkdir(r.dir, { recursive: true });
  await fs.writeFile(path.join(r.dir, name), body, "utf8");
}

let syncInFlight: Promise<IrissPavadzimesSyncResult> | null = null;

function recordFromDropboxFile(file: DropboxWaybillFile, existing: IrissPavadzimeRecord | undefined, nowIso: string): IrissPavadzimeRecord {
  const fromName = parseCsddWaybillFileName(file.name);
  const id = existing?.id || waybillIdFromNumber(fromName.number ?? "", file.id.replace(/^id:/, "").replace(/[^A-Za-z0-9._-]/g, "").slice(0, 24));
  const base = existing ?? emptyIrissPavadzimeRecord(id, nowIso);
  return {
    ...base,
    id,
    source: "dropbox",
    fileName: file.name,
    dropboxId: file.id,
    dropboxPath: file.path,
    dropboxRev: existing?.dropboxRev ?? "",
    dropboxContentHash: existing?.dropboxContentHash ?? "",
    archived: file.archived,
    number: base.number || fromName.number || "",
    brandModel: base.brandModel || fromName.brandModel || "",
    plate: base.plate || fromName.plate || "",
    vin: base.vin || fromName.vin || "",
    updatedAt: existing?.updatedAt ?? nowIso,
  };
}

function findExisting(items: IrissPavadzimeRecord[], file: DropboxWaybillFile): IrissPavadzimeRecord | undefined {
  const byId = file.id ? items.find((x) => x.dropboxId === file.id) : undefined;
  if (byId) return byId;
  const fromName = parseCsddWaybillFileName(file.name);
  const number = (fromName.number ?? "").toUpperCase();
  if (!number) return undefined;
  return (
    items.find((x) => x.number.toUpperCase() === number && x.source === "dropbox") ??
    items.find((x) => x.number.toUpperCase() === number)
  );
}

function needsParse(rec: IrissPavadzimeRecord, file: DropboxWaybillFile): boolean {
  if (file.contentHash && rec.dropboxContentHash === file.contentHash) return false;
  if (!file.contentHash && file.rev && rec.dropboxRev === file.rev) return false;
  return true;
}

function bufferToArrayBuffer(bytes: Buffer): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

async function parsePdfBuffer(bytes: Buffer, fileName: string): Promise<ReturnType<typeof parseCsddWaybill> | null> {
  const text = await extractPdfTextOnServer(bufferToArrayBuffer(bytes), { fileName });
  if (!isCsddWaybillText(text) && !parseCsddWaybillFileName(fileName).number) return null;
  return parseCsddWaybill(text, fileName);
}

async function mapPool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i;
      i += 1;
      const item = items[idx];
      if (item === undefined) continue;
      out[idx] = await fn(item);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return out;
}

/** Tikai Blob/FS indekss. Bez Dropbox saraksta un PDF parsēšanas (sānjoslas karte). */
export async function readIrissPavadzimesCached(): Promise<IrissPavadzimeRecord[]> {
  const index = await readIndex();
  return sortIrissPavadzimes(withoutSyncBlocked(index.items));
}

async function syncIrissPavadzimesFromDropboxOnce(): Promise<IrissPavadzimesSyncResult> {
  const dropboxConfigured = isDropboxConfigured();
  let dropboxError: string | null = null;
  const index = await readIndex();
  const priorItems = index.items;
  const byKey = new Map<string, IrissPavadzimeRecord>();
  const nowIso = new Date().toISOString();

  if (dropboxConfigured) {
    const listed = await listDropboxPavadzimes();
    if (!listed.ok) {
      dropboxError = listed.error;
    } else {
      const dirty: { rec: IrissPavadzimeRecord; file: DropboxWaybillFile }[] = [];
      // Nekad nezaudē ierakstus: pavadzīme, kas pārvietota uz Arhīvs/, augšupielādēta manuāli
      // vai vairs nav Dropbox, paliek indeksā (agrāk sync indeksu aizvietoja ar tikai virsmapes PDF).
      for (const prior of priorItems) {
        if (
          !isIrissPavadzimeSyncBlocked({
            id: prior.id,
            number: prior.number,
            plate: prior.plate,
            fileName: prior.fileName,
          })
        ) {
          byKey.set(prior.id, prior);
        }
      }
      const seen = new Set<string>();
      // Aktuālās (virsmapes) vispirms, lai tās tiktu parsētas pirmās.
      const files = [...listed.files].sort((a, b) => Number(a.archived) - Number(b.archived));
      for (const file of files) {
        const fromName = parseCsddWaybillFileName(file.name);
        if (!fromName.number) continue;
        if (
          isIrissPavadzimeSyncBlocked({
            number: fromName.number,
            plate: fromName.plate,
            fileName: file.name,
          })
        ) {
          continue;
        }
        const existing = findExisting(priorItems, file);
        const rec = recordFromDropboxFile(file, existing, nowIso);
        if (seen.has(rec.id)) continue;
        seen.add(rec.id);
        byKey.set(rec.id, rec);
        if (needsParse(rec, file)) dirty.push({ rec, file });
      }

      for (const [id, rec] of byKey) {
        if (rec.source === "dropbox" && !seen.has(id) && !rec.archived) byKey.set(id, { ...rec, archived: true });
      }

      const batch = dirty.slice(0, PARSE_BATCH);
      await mapPool(batch, PARSE_CONCURRENCY, async ({ rec, file }) => {
        try {
          const bytes = await downloadDropboxFile(file.id || file.path);
          const parsed = await parsePdfBuffer(bytes, file.name);
          if (!parsed) {
            if (!parseCsddWaybillFileName(file.name).number) {
              byKey.delete(rec.id);
              return;
            }
            byKey.set(rec.id, { ...rec, dropboxContentHash: file.contentHash, dropboxRev: file.rev, updatedAt: nowIso });
            return;
          }
          byKey.set(rec.id, applyParsedFields({ ...rec, dropboxContentHash: file.contentHash, dropboxRev: file.rev }, parsed, nowIso));
        } catch {
          byKey.set(rec.id, rec);
        }
      });

      const fresh = await readIndex();
      // Paralēli (piem. manuāla augšupielāde) pievienoti ieraksti netiek pārrakstīti.
      for (const item of fresh.items) if (!byKey.has(item.id)) byKey.set(item.id, item);
      const nextItems = sortIrissPavadzimes(withoutSyncBlocked([...byKey.values()]));
      const indexChanged = JSON.stringify(fresh.items) !== JSON.stringify(nextItems);
      if (indexChanged) {
        await backupIndexBeforeWrite(fresh).catch((e) => {
          console.error("[iriss pavadzimes] index backup failed", e instanceof Error ? e.message : e);
        });
        const wrote = await writeIndex({ version: 1, updatedAt: nowIso, items: nextItems })
          .then(() => true)
          .catch(() => false);
        if (wrote) {
          await rememberWaybillChanges(priorItems, nextItems).catch((e) => {
            console.error("[change-history]", e instanceof Error ? e.message : e);
          });
        }
      }

      const pendingParse = Math.max(0, dirty.length - batch.length);
      const updatedAt = indexChanged ? nowIso : fresh.updatedAt;
      return {
        ok: true,
        rows: nextItems,
        pendingParse,
        dropboxConfigured,
        dropboxError,
        updatedAt,
        itemCount: nextItems.length,
        indexChanged,
      };
    }
  }

  const rows = sortIrissPavadzimes(priorItems);
  return {
    ok: !dropboxError,
    rows,
    pendingParse: 0,
    dropboxConfigured,
    dropboxError,
    updatedAt: index.updatedAt,
    itemCount: rows.length,
    indexChanged: false,
  };
}

/** Dropbox → Blob/FS indekss; droši atkārtoti un paralēli (viena aktīva darba instancē). */
export async function runIrissPavadzimesDropboxSync(): Promise<IrissPavadzimesSyncResult> {
  if (syncInFlight) return syncInFlight;
  syncInFlight = syncIrissPavadzimesFromDropboxOnce().finally(() => {
    syncInFlight = null;
  });
  return syncInFlight;
}

/** Tikai indekss (bez Dropbox sinhronizācijas) - ātrai lapas atvēršanai; sinhronizācija notiek pēc tam fonā. */
export async function listIrissPavadzimesCached(): Promise<IrissPavadzimesListResult> {
  return { rows: await readIrissPavadzimesCached(), pendingParse: 0, dropboxConfigured: isDropboxConfigured(), dropboxError: null };
}

export async function listIrissPavadzimes(): Promise<IrissPavadzimesListResult> {
  const r = await runIrissPavadzimesDropboxSync();
  return {
    rows: r.rows,
    pendingParse: r.pendingParse,
    dropboxConfigured: r.dropboxConfigured,
    dropboxError: r.dropboxError,
  };
}

export async function getIrissPavadzime(id: string): Promise<IrissPavadzimeRecord | null> {
  if (!isSafeIrissPavadzimeId(id)) return null;
  const index = await readIndex();
  return index.items.find((x) => x.id === id) ?? null;
}

export async function readIrissPavadzimePdf(id: string): Promise<{ bytes: Buffer; fileName: string } | null> {
  const rec = await getIrissPavadzime(id);
  if (!rec) return null;
  const bytes = await readPdfBytes(rec);
  if (!bytes) return null;
  return { bytes, fileName: rec.fileName || `${rec.number || id}.pdf` };
}

export type UploadWaybillInput = {
  fileName: string;
  bytes: Buffer;
  vin?: string;
  brandModel?: string;
  plate?: string;
};

export async function uploadIrissPavadzime(input: UploadWaybillInput): Promise<IrissPavadzimeRecord> {
  const nowIso = new Date().toISOString();
  const parsed = (await parsePdfBuffer(input.bytes, input.fileName)) ?? {
    number: parseCsddWaybillFileName(input.fileName).number ?? "",
    brandModel: "",
    vin: "",
    plate: "",
    issuedAt: "",
    validUntil: "",
  };
  if (input.vin?.trim()) parsed.vin = input.vin.trim().toUpperCase();
  if (input.brandModel?.trim()) parsed.brandModel = input.brandModel.trim();
  if (input.plate?.trim()) parsed.plate = input.plate.trim().toUpperCase();

  if (
    isIrissPavadzimeSyncBlocked({
      number: parsed.number,
      plate: parsed.plate,
      fileName: input.fileName,
    })
  ) {
    throw new Error("pavadzime_blocked");
  }

  const index = await readIndex();
  const existing = parsed.number
    ? index.items.find((x) => x.number.toUpperCase() === parsed.number.toUpperCase())
    : undefined;
  const id = existing?.id || waybillIdFromNumber(parsed.number, `u-${crypto.randomUUID().slice(0, 12)}`);
  const blobPath = await writePdfBytes(id, input.bytes);
  const rec = applyParsedFields(
    {
      ...(existing ?? emptyIrissPavadzimeRecord(id, nowIso)),
      id,
      source: existing?.source === "dropbox" ? "dropbox" : "upload",
      fileName: input.fileName,
      blobPath,
    },
    parsed,
    nowIso,
  );
  const nextItems = sortIrissPavadzimes(withoutSyncBlocked([...index.items.filter((x) => x.id !== id), rec]));
  await writeIndex({ version: 1, updatedAt: nowIso, items: nextItems });
  if (existing) {
    await rememberWaybillChanges([existing], [rec]).catch((e) => {
      console.error("[change-history]", e instanceof Error ? e.message : e);
    });
  }
  return rec;
}

export async function restoreIrissPavadzimeSnapshot(
  id: string,
  snapshot: Record<string, string>,
  by: string,
): Promise<IrissPavadzimeRecord | null> {
  if (!isSafeIrissPavadzimeId(id)) return null;
  const index = await readIndex();
  const existing = index.items.find((row) => row.id === id);
  if (!existing) return null;
  const { applyIrissWaybillSnapshot } = await import("@/lib/admin-change-history");
  const next = applyIrissWaybillSnapshot(existing, snapshot);
  next.updatedAt = new Date().toISOString();
  const items = sortIrissPavadzimes([...index.items.filter((row) => row.id !== id), next]);
  await writeIndex({ version: 1, updatedAt: next.updatedAt, items });
  await rememberWaybillChanges([existing], [next], "restore", by).catch((e) => {
    console.error("[change-history]", e instanceof Error ? e.message : e);
  });
  return next;
}

async function rememberWaybillChanges(
  beforeRows: readonly IrissPavadzimeRecord[],
  afterRows: readonly IrissPavadzimeRecord[],
  action: "save" | "restore" = "save",
  by?: string,
): Promise<void> {
  const { diffAdminChangeFields, snapshotIrissWaybill } = await import("@/lib/admin-change-history");
  const { ADMIN_SEARCH_OPERATOR_TENANT } = await import("@/lib/admin-global-search");
  const { recordAdminChangeHistory } = await import("@/lib/admin-change-history-store");
  const { adminActorLabel } = await import("@/lib/admin-auth");
  const before = new Map(beforeRows.map((row) => [row.id, row]));
  for (const row of afterRows) {
    const prev = before.get(row.id);
    if (!prev) continue;
    const left = snapshotIrissWaybill(prev);
    const right = snapshotIrissWaybill(row);
    if (diffAdminChangeFields(left, right).length === 0) continue;
    await recordAdminChangeHistory({
      kind: "iriss-waybill",
      recordId: row.id,
      tenantId: ADMIN_SEARCH_OPERATOR_TENANT,
      before: left,
      after: right,
      by: by || adminActorLabel(),
      action,
    });
  }
}
