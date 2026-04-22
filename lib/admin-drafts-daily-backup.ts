import "server-only";

import { get, list, put } from "@vercel/blob";
import type { Dirent } from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { getConsultationDraftStorageDir, isConsultationDraftStoreEnabled } from "@/lib/admin-consultation-draft-store";
import { getOrderDraftStorageDir, isOrderDraftStoreEnabled } from "@/lib/admin-order-draft-store";
import { getIrissPasutijumiStorageDir, getIrissPasutijumiStorageState } from "@/lib/iriss-pasutijumi-store";

type BackupSourceReport = {
  source: string;
  files: number;
  bytes: number;
};

export type DailyDraftBackupResult = {
  startedAt: string;
  finishedAt: string;
  ok: boolean;
  warnings: string[];
  backupRootFs: string;
  backupBlobPath?: string;
  reports: BackupSourceReport[];
};

const DEFAULT_BACKUP_ROOT = ".data/daily-admin-draft-backups";
const DEFAULT_BLOB_BACKUP_PREFIX = "admin-daily-backups/";

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

async function readJsonFilesFromBlob(prefix: string, token: string): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  let cursor: string | undefined;
  do {
    const page = await list({ prefix, token, cursor, limit: 1000 });
    for (const b of page.blobs) {
      if (!b.pathname.endsWith(".json")) continue;
      try {
        const got = await get(b.pathname, { access: "private", token, useCache: false });
        if (!got?.stream || got.statusCode !== 200) continue;
        const text = await new Response(got.stream).text();
        out.set(b.pathname.slice(prefix.length), text);
      } catch {
        /* ignore one blob */
      }
    }
    cursor = page.hasMore && page.cursor ? page.cursor : undefined;
  } while (cursor);
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

  const backupRoot = path.join(process.cwd(), DEFAULT_BACKUP_ROOT, dateSlug());
  await fs.mkdir(backupRoot, { recursive: true });

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

  const fsSources: Array<{ label: string; dir: string | null }> = [
    { label: "order-drafts-fs", dir: orderDir },
    { label: "consultation-drafts-fs", dir: consultationDir },
    { label: "iriss-fs", dir: irissDir },
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
  const orderBlobPrefix = process.env.ADMIN_ORDER_DRAFT_BLOB_PREFIX?.trim() ?? "";
  const irissBlobPrefix = "iriss-pasutijumi/";
  if (!token) warnings.push("BLOB_READ_WRITE_TOKEN is missing; no offsite Blob snapshot was created.");

  if (token && orderBlobPrefix) {
    const files = await readJsonFilesFromBlob(orderBlobPrefix, token);
    if (files.size > 0) {
      const relPayload: Record<string, string> = {};
      for (const [k, v] of files) relPayload[k] = v;
      snapshotPayload["order-drafts-blob"] = relPayload;
      reports.push({ source: "order-drafts-blob", files: files.size, bytes: sizeOfMap(files) });
    }
  }
  if (token && irissState.enabled && irissState.persistence === "vercel_blob") {
    const files = await readJsonFilesFromBlob(irissBlobPrefix, token);
    if (files.size > 0) {
      const relPayload: Record<string, string> = {};
      for (const [k, v] of files) relPayload[k] = v;
      snapshotPayload["iriss-blob"] = relPayload;
      reports.push({ source: "iriss-blob", files: files.size, bytes: sizeOfMap(files) });
    }
  }

  const manifest = {
    startedAt,
    finishedAt: new Date().toISOString(),
    warnings,
    reports,
    sources: Object.keys(snapshotPayload),
  };
  await fs.writeFile(path.join(backupRoot, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
  await fs.writeFile(path.join(backupRoot, "snapshot.json"), JSON.stringify(snapshotPayload), "utf8");

  let backupBlobPath: string | undefined;
  if (token) {
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

  return {
    startedAt,
    finishedAt: new Date().toISOString(),
    ok: reports.length > 0,
    warnings,
    backupRootFs: backupRoot,
    backupBlobPath,
    reports,
  };
}
