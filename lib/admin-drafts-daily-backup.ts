import "server-only";

import { get, list, put } from "@vercel/blob";
import type { Dirent } from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { getConsultationDraftStorageDir, isConsultationDraftStoreEnabled } from "@/lib/admin-consultation-draft-store";
import { getOrderDraftStorageDir, isOrderDraftStoreEnabled } from "@/lib/admin-order-draft-store";
import { getIrissPasutijumiStorageDir, getIrissPasutijumiStorageState } from "@/lib/iriss-pasutijumi-store";
import { getIrissPavadzimesStorageDir, IRISS_PAVADZIMES_BLOB_PREFIX } from "@/lib/iriss-pavadzimes-store";
import { getIrissScanStorageDir, getIrissScanStorageState, IRISS_SCAN_BLOB_PREFIX } from "@/lib/iriss-scan-store";

type BackupSourceReport = {
  source: string;
  files: number;
  bytes: number;
};

export type DailyDraftBackupResult = {
  startedAt: string;
  finishedAt: string;
  ok: boolean;
  /** Vai snapshot saturēja vismaz vienu failu grupu (FS vai Blob). */
  hadPayload: boolean;
  warnings: string[];
  backupRootFs: string;
  backupBlobPath?: string;
  /** Vai snapshot ir saglabāts noturīgi (Blob vai pastāvīgs disks), nevis tikai `/tmp`. */
  persisted: boolean;
  reports: BackupSourceReport[];
};

const DEFAULT_BACKUP_ROOT = ".data/daily-admin-draft-backups";
const DEFAULT_BLOB_BACKUP_PREFIX = "admin-daily-backups/";
/** Sk. `lib/b2b-partner-credit-store.ts`. */
const B2B_PARTNER_CREDITS_BLOB_PREFIX = "b2b-partner-credits/";

function envFlag(name: string, defaultValue: boolean): boolean {
  const raw = process.env[name]?.trim().toLowerCase() ?? "";
  if (!raw) return defaultValue;
  if (["1", "true", "yes", "on"].includes(raw)) return true;
  if (["0", "false", "no", "off"].includes(raw)) return false;
  return defaultValue;
}

/** Noklusējums: false — mazāk Vercel Blob operāciju / krātuves (piemērots bezmaksas plānam). */
function shouldUploadDailySnapshotToBlob(): boolean {
  return envFlag("ADMIN_DRAFT_DAILY_BACKUP_TO_BLOB", false);
}

/**
 * Noklusējums: true - PRO pasūtījumi (darba vietas, manuālie, Stripe apmaksu indekss, rēķinu skaitītājs,
 * upsell) un partneru kredīti iet dienas backupā. Izslēgt tikai apzināti ar `=0`.
 */
export function shouldIncludeOrderDraftsFromBlob(): boolean {
  return envFlag("ADMIN_DRAFT_DAILY_BACKUP_INCLUDE_ORDER_BLOB", true);
}

/** Noklusējums: true — IRISS pasūtījumi, SCAN un pavadzīmes Blob iet dienas backupā. */
export function shouldIncludeIrissFromBlob(): boolean {
  return envFlag("ADMIN_DRAFT_DAILY_BACKUP_INCLUDE_IRISS_BLOB", true);
}

function fsRetentionFolderCount(): number {
  const n = Number.parseInt(process.env.ADMIN_DRAFT_BACKUP_FS_RETENTION ?? "12", 10);
  return Number.isFinite(n) && n >= 1 ? Math.min(n, 365) : 12;
}

/** Mapju sakne (datētas apakšmapes `YYYY-MM-DD/`). */
function resolveBackupBaseDir(): string {
  const custom = process.env.ADMIN_DRAFT_BACKUP_FS_ROOT?.trim();
  if (custom) return path.resolve(custom);
  return path.join(process.cwd(), DEFAULT_BACKUP_ROOT);
}

function dateSlug(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

function isTmpPath(p: string): boolean {
  const tmp = path.resolve(os.tmpdir());
  const rp = path.resolve(p);
  return rp === tmp || rp.startsWith(`${tmp}${path.sep}`);
}

async function readJsonFilesFromDir(dir: string): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  async function walk(cur: string, relBase = ""): Promise<void> {
    let entries: Dirent<string>[];
    try {
      entries = await fs.readdir(cur, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const rel = relBase ? path.join(relBase, e.name) : e.name;
      const full = path.join(cur, e.name);
      if (e.isDirectory()) {
        await walk(full, rel);
        continue;
      }
      if (!e.isFile() || !e.name.endsWith(".json")) continue;
      try {
        const raw = await fs.readFile(full, "utf8");
        out.set(rel, raw);
      } catch {
        /* ignore one broken file */
      }
    }
  }
  await walk(dir);
  return out;
}

/** Paralēli `get()` - secīgi simtiem pasūtījumu JSON neiekļautos cron `maxDuration`. */
const BLOB_READ_CONCURRENCY = 8;

async function readJsonFilesFromBlob(prefix: string, token: string): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const pathnames: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await list({ prefix, token, cursor, limit: 1000 });
    for (const b of page.blobs) {
      if (b.pathname.endsWith(".json")) pathnames.push(b.pathname);
    }
    cursor = page.hasMore && page.cursor ? page.cursor : undefined;
  } while (cursor);

  let next = 0;
  const worker = async (): Promise<void> => {
    while (next < pathnames.length) {
      const pathname = pathnames[next++]!;
      try {
        const got = await get(pathname, { access: "private", token, useCache: false });
        if (!got?.stream || got.statusCode !== 200) continue;
        const text = await new Response(got.stream).text();
        out.set(pathname.slice(prefix.length), text);
      } catch {
        /* ignore one blob */
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(BLOB_READ_CONCURRENCY, pathnames.length) }, worker));
  return out;
}

function sizeOfMap(m: Map<string, string>): number {
  let s = 0;
  for (const v of m.values()) s += Buffer.byteLength(v, "utf8");
  return s;
}

export async function runDailyAdminDraftBackup(): Promise<DailyDraftBackupResult> {
  const startedAt = new Date().toISOString();
  const warnings: string[] = [];
  const reports: BackupSourceReport[] = [];

  const backupBase = resolveBackupBaseDir();
  const backupRoot = path.join(backupBase, dateSlug());
  /**
   * Vercel: `process.cwd()/.data` nav rakstāms. Agrāk te bija agrs `return` - tad arī Blob snapshot
   * (ADMIN_DRAFT_DAILY_BACKUP_TO_BLOB=1) nekad netika izveidots. Tagad turpinām tikai ar Blob.
   */
  let fsWritable = true;
  try {
    await fs.mkdir(backupRoot, { recursive: true });
  } catch (e) {
    if (!process.env.VERCEL) throw e;
    fsWritable = false;
    const msg = e instanceof Error ? e.message : String(e);
    warnings.push(
      `Filesystem backup unavailable on Vercel (${msg}); only the Blob snapshot (ADMIN_DRAFT_DAILY_BACKUP_TO_BLOB=1) can persist. Offsite copy: \`npm run admin:backup-full\` from your Mac (Dropbox).`,
    );
  }

  const orderEnabled = isOrderDraftStoreEnabled();
  if (!orderEnabled) warnings.push("Order draft storage is disabled (ADMIN_ORDER_DRAFT_DIR=off/disabled).");
  const orderDir = getOrderDraftStorageDir();
  if (orderDir && isTmpPath(orderDir)) warnings.push(`Order drafts are in ephemeral tmp path: ${orderDir}`);

  const consultationEnabled = isConsultationDraftStoreEnabled();
  if (!consultationEnabled) warnings.push("Consultation draft storage is disabled (ADMIN_CONSULTATION_DRAFT_DIR=off/disabled).");
  const consultationDir = getConsultationDraftStorageDir();
  if (consultationDir && isTmpPath(consultationDir)) warnings.push(`Consultation drafts are in ephemeral tmp path: ${consultationDir}`);

  const irissState = getIrissPasutijumiStorageState();
  if (!irissState.enabled) warnings.push(`IRISS storage disabled: ${irissState.reason}.`);
  const irissDir = getIrissPasutijumiStorageDir();
  if (irissDir && isTmpPath(irissDir)) warnings.push(`IRISS data is in ephemeral tmp path: ${irissDir}`);
  const irissScanDir = getIrissScanStorageDir();
  if (irissScanDir && isTmpPath(irissScanDir)) warnings.push(`IRISS SCAN data is in ephemeral tmp path: ${irissScanDir}`);
  const irissPavadzimesDir = getIrissPavadzimesStorageDir();
  if (irissPavadzimesDir && isTmpPath(irissPavadzimesDir)) {
    warnings.push(`IRISS pavadzīmes data is in ephemeral tmp path: ${irissPavadzimesDir}`);
  }

  const fsSources: Array<{ label: string; dir: string | null }> = [
    { label: "order-drafts-fs", dir: orderDir },
    { label: "consultation-drafts-fs", dir: consultationDir },
    { label: "iriss-fs", dir: irissDir },
    { label: "iriss-scan-fs", dir: irissScanDir },
    { label: "iriss-pavadzimes-fs", dir: irissPavadzimesDir },
  ];

  const snapshotPayload: Record<string, Record<string, string>> = {};
  for (const src of fsSources) {
    if (!src.dir) continue;
    const files = await readJsonFilesFromDir(src.dir);
    if (files.size === 0) continue;
    const relPayload: Record<string, string> = {};
    for (const [k, v] of files) relPayload[k] = v;
    snapshotPayload[src.label] = relPayload;
    reports.push({ source: src.label, files: files.size, bytes: sizeOfMap(files) });
  }

  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim() ?? "";
  const orderBlobPrefixRaw = process.env.ADMIN_ORDER_DRAFT_BLOB_PREFIX?.trim() ?? "";
  const orderBlobPrefix = orderBlobPrefixRaw && !orderBlobPrefixRaw.endsWith("/") ? `${orderBlobPrefixRaw}/` : orderBlobPrefixRaw;
  const irissBlobPrefix = "iriss-pasutijumi/";
  if (!token) warnings.push("BLOB_READ_WRITE_TOKEN is missing; no offsite Blob snapshot was created.");

  if (token && orderBlobPrefix && shouldIncludeOrderDraftsFromBlob()) {
    const files = await readJsonFilesFromBlob(orderBlobPrefix, token);
    if (files.size > 0) {
      const relPayload: Record<string, string> = {};
      for (const [k, v] of files) relPayload[k] = v;
      snapshotPayload["order-drafts-blob"] = relPayload;
      reports.push({ source: "order-drafts-blob", files: files.size, bytes: sizeOfMap(files) });
    }
    /** Partneru kredītu atlikumi (nauda) - tā pati pasūtījumu datu grupa. */
    const credits = await readJsonFilesFromBlob(B2B_PARTNER_CREDITS_BLOB_PREFIX, token);
    if (credits.size > 0) {
      const relPayload: Record<string, string> = {};
      for (const [k, v] of credits) relPayload[k] = v;
      snapshotPayload["b2b-partner-credits-blob"] = relPayload;
      reports.push({ source: "b2b-partner-credits-blob", files: credits.size, bytes: sizeOfMap(credits) });
    }
  }
  if (token && shouldIncludeIrissFromBlob()) {
    const irissBlobSources: Array<{ label: string; prefix: string; include: boolean }> = [
      { label: "iriss-blob", prefix: irissBlobPrefix, include: irissState.enabled && irissState.persistence === "vercel_blob" },
      { label: "iriss-scan-blob", prefix: IRISS_SCAN_BLOB_PREFIX, include: getIrissScanStorageState().enabled },
      { label: "iriss-pavadzimes-blob", prefix: IRISS_PAVADZIMES_BLOB_PREFIX, include: true },
    ];
    for (const src of irissBlobSources) {
      if (!src.include) continue;
      const files = await readJsonFilesFromBlob(src.prefix, token);
      if (files.size === 0) continue;
      const relPayload: Record<string, string> = {};
      for (const [k, v] of files) relPayload[k] = v;
      snapshotPayload[src.label] = relPayload;
      reports.push({ source: src.label, files: files.size, bytes: sizeOfMap(files) });
    }
  }

  if (!shouldIncludeOrderDraftsFromBlob() && orderBlobPrefix) {
    warnings.push("Order drafts in Blob are NOT in this snapshot (ADMIN_DRAFT_DAILY_BACKUP_INCLUDE_ORDER_BLOB=0).");
  }

  const manifest = {
    startedAt,
    finishedAt: new Date().toISOString(),
    warnings,
    reports,
    sources: Object.keys(snapshotPayload),
  };
  if (fsWritable) {
    await fs.writeFile(path.join(backupRoot, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
    await fs.writeFile(path.join(backupRoot, "snapshot.json"), JSON.stringify(snapshotPayload), "utf8");
  }

  let backupBlobPath: string | undefined;
  if (token && shouldUploadDailySnapshotToBlob()) {
    const blobPrefix = process.env.ADMIN_DRAFT_DAILY_BACKUP_BLOB_PREFIX?.trim() || DEFAULT_BLOB_BACKUP_PREFIX;
    const safePrefix = blobPrefix.endsWith("/") ? blobPrefix : `${blobPrefix}/`;
    const blobPath = `${safePrefix}${dateSlug()}.json`;
    await put(
      blobPath,
      JSON.stringify({
        manifest,
        snapshotPayload,
      }),
      {
        token,
        access: "private",
        contentType: "application/json; charset=utf-8",
        addRandomSuffix: false,
        allowOverwrite: true,
      },
    );
    backupBlobPath = blobPath;
  }

  if (fsWritable) await trimFsBackupDirs(backupBase, fsRetentionFolderCount());

  /** FS snapshot `os.tmpdir()` (vai Vercel bez FS) pazūd kopā ar instanci - noturīgs ir tikai Blob vai pastāvīgs disks. */
  const persisted = Boolean(backupBlobPath) || (fsWritable && !isTmpPath(backupRoot) && !process.env.VERCEL);
  if (!persisted) {
    const msg =
      "No durable backup was written (Blob upload disabled and filesystem is ephemeral). Set ADMIN_DRAFT_DAILY_BACKUP_TO_BLOB=1 and ADMIN_DRAFT_DAILY_BACKUP_INCLUDE_ORDER_BLOB=1.";
    warnings.push(msg);
    console.error("[cron/admin-drafts-daily-backup] not_persisted", { sources: manifest.sources });
  }

  return {
    startedAt,
    finishedAt: new Date().toISOString(),
    ok: true,
    hadPayload: reports.length > 0,
    warnings,
    backupRootFs: fsWritable ? backupRoot : "",
    backupBlobPath,
    persisted,
    reports,
  };
}

async function trimFsBackupDirs(backupBase: string, keep: number): Promise<void> {
  const root = backupBase;
  let names: string[] = [];
  try {
    names = await fs.readdir(root);
  } catch {
    return;
  }
  const dayDirs = names.filter((n) => /^\d{4}-\d{2}-\d{2}$/.test(n)).sort();
  const stale = dayDirs.slice(0, Math.max(0, dayDirs.length - keep));
  for (const d of stale) {
    await fs.rm(path.join(root, d), { recursive: true, force: true }).catch(() => undefined);
  }
}
