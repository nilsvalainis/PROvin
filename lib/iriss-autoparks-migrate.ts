import "server-only";

import { getDropboxClient, type DropboxClient, type DropboxEntry } from "@/lib/dropbox-client";
import { dropboxContentHash } from "@/lib/dropbox-content-hash";
import type { AutoparksFile, AutoparksState } from "@/lib/iriss-autoparks";
import { autoparksDropboxFileName, joinDropboxPath } from "@/lib/iriss-autoparks-dropbox-path";
import { autoparksDropboxEnabled, makeAutoparksThumbnail, resolveAutoparksCarFolder } from "@/lib/iriss-autoparks-files";
import { mutateAutoparksState, readAutoparksState } from "@/lib/iriss-autoparks-store";
import { getLogisticsBinaryFile, putLogisticsBinaryFile } from "@/lib/iriss-logistics-store";

/** Faili, kas vēl tikai Blob: ir blobPath, nav dropboxId, nav izņemti. */
export function autoparksBlobOnlyFiles(state: AutoparksState): AutoparksFile[] {
  const cars = new Set(state.cars.map((c) => c.id));
  return state.files.filter((f) => f.blobPath && !f.dropboxId && !f.deletedAt && cars.has(f.carId));
}

export type AutoparksMigrationItem = {
  fileId: string;
  carId: string;
  blobPath: string;
  size: number;
  target: string;
  status: "planned" | "copied" | "reused" | "missing_blob" | "error";
  error?: string;
};

export type AutoparksMigrationReport = {
  dryRun: boolean;
  totalLive: number;
  blobOnlyBefore: number;
  processed: number;
  copied: number;
  reused: number;
  failed: number;
  remaining: number;
  items: AutoparksMigrationItem[];
  verify?: AutoparksMigrationVerify;
};

export type AutoparksMigrationVerify = {
  /** Ierakstu skaits ar dropboxId (dzīvie faili). */
  recordsWithDropbox: number;
  /** No tiem Dropbox API atrasti (pēc mapju saraksta). */
  foundInDropbox: number;
  missing: string[];
  /** Blob faili netiek dzēsti - visiem migrētajiem blobPath paliek. */
  blobPathsKept: number;
};

/**
 * Blob -> Dropbox migrācija. Idempotenta: fails ar dropboxId netiek aiztikts; ja tāds pats saturs
 * (Dropbox content_hash) jau ir auto mapē, to izmanto atkārtoti, nevis augšupielādē vēlreiz.
 * Ieraksts tiek atjaunots ar etag pārbaudi un tikai tad, ja paralēli neviens to nav mainījis.
 * Blob saturs NETIEK dzēsts (blobPath paliek kā rezerve).
 */
export async function runAutoparksBlobMigration(opts: { dryRun: boolean; limit?: number; verify?: boolean }): Promise<AutoparksMigrationReport> {
  const state = await readAutoparksState();
  const live = state.files.filter((f) => !f.deletedAt);
  const pending = autoparksBlobOnlyFiles(state);
  const limit = Math.max(1, Math.min(opts.limit ?? 20, 200));
  const report: AutoparksMigrationReport = {
    dryRun: opts.dryRun,
    totalLive: live.length,
    blobOnlyBefore: pending.length,
    processed: 0,
    copied: 0,
    reused: 0,
    failed: 0,
    remaining: pending.length,
    items: [],
  };
  const client = autoparksDropboxEnabled() ? getDropboxClient() : null;
  if (!client) throw new Error("dropbox_not_configured");

  const folderCache = new Map<string, { id: string; path: string; entries: DropboxEntry[] }>();
  const batch = pending.slice(0, limit);
  for (const f of batch) {
    const car = state.cars.find((c) => c.id === f.carId)!;
    const item: AutoparksMigrationItem = { fileId: f.id, carId: f.carId, blobPath: f.blobPath, size: f.size, target: "", status: "planned" };
    report.items.push(item);
    try {
      let folder = folderCache.get(car.id);
      if (!folder) {
        const ref = await resolveAutoparksCarFolder(client, car, { create: !opts.dryRun });
        if (!ref) {
          item.target = "(jauna mape tiks izveidota)";
          continue;
        }
        const listing = await client.listAll(ref.path, { recursive: false });
        folder = { ...ref, entries: listing.entries.filter((e) => e.tag === "file") };
        folderCache.set(car.id, folder);
      }
      const name = autoparksDropboxFileName(f.stage, f.title, f.fileName, f.contentType);
      item.target = joinDropboxPath(folder.path, name);
      if (opts.dryRun) continue;
      const blob = await getLogisticsBinaryFile(f.blobPath);
      if (!blob) {
        item.status = "missing_blob";
        report.failed += 1;
        continue;
      }
      const hash = dropboxContentHash(blob.bytes);
      let entry = folder.entries.find((e) => e.contentHash === hash) ?? null;
      if (entry) item.status = "reused";
      else {
        entry = await client.upload(item.target, blob.bytes, "add");
        folder.entries.push(entry);
        item.status = "copied";
      }
      item.target = entry.pathDisplay;
      let thumbBlobPath = "";
      if (f.contentType.startsWith("image/") && !f.thumbBlobPath) {
        const thumb = await makeAutoparksThumbnail(blob.bytes, f.contentType);
        if (thumb) thumbBlobPath = (await putLogisticsBinaryFile(`autoparks/${car.id}/thumbs/${f.sha256 || f.id}.jpg`, thumb, "image/jpeg").catch(() => null))?.pathname ?? "";
      }
      const saved = entry;
      const ok = await mutateAutoparksState((s) => {
        const idx = s.files.findIndex((x) => x.id === f.id);
        const cur = idx >= 0 ? s.files[idx]! : null;
        // Paralēli mainīts (izņemts, jau migrēts) - neko nepārrakstām.
        if (!cur || cur.dropboxId || cur.deletedAt || cur.blobPath !== f.blobPath) return { result: false, write: false };
        s.files[idx] = { ...cur, dropboxId: saved.id, dropboxPath: saved.pathDisplay, ...(thumbBlobPath ? { thumbBlobPath } : {}) };
        const ci = s.cars.findIndex((c) => c.id === car.id);
        if (ci >= 0 && !s.cars[ci]!.dropboxFolderId) s.cars[ci] = { ...s.cars[ci]!, dropboxFolderId: folder.id, dropboxFolderPath: folder.path };
        return { result: true };
      });
      if (ok) {
        report.processed += 1;
        if (item.status === "copied") report.copied += 1;
        else report.reused += 1;
      }
    } catch (err) {
      item.status = "error";
      item.error = err instanceof Error ? err.message.slice(0, 200) : "error";
      report.failed += 1;
    }
  }
  const after = await readAutoparksState();
  report.remaining = autoparksBlobOnlyFiles(after).length;
  if (opts.verify) report.verify = await verifyAutoparksDropboxFiles(client, after);
  return report;
}

/** Skaita caur Dropbox API: katram ierakstam ar dropboxId jābūt atrodamam auto mapes sarakstā. */
export async function verifyAutoparksDropboxFiles(client: DropboxClient, state: AutoparksState): Promise<AutoparksMigrationVerify> {
  const files = state.files.filter((f) => f.dropboxId && !f.deletedAt);
  const ids = new Set<string>();
  const byFolder = new Map<string, string>();
  for (const c of state.cars) if (c.dropboxFolderId) byFolder.set(c.id, c.dropboxFolderId);
  const listed = new Set<string>();
  for (const [, folderId] of byFolder) {
    if (listed.has(folderId)) continue;
    listed.add(folderId);
    try {
      const all = await client.listAll(folderId, { recursive: true });
      for (const e of all.entries) if (e.tag === "file" && e.id) ids.add(e.id);
    } catch {
      /* mape pazudusi - faili tiks pārbaudīti pa vienam zemāk */
    }
  }
  const missing: string[] = [];
  for (const f of files) {
    if (ids.has(f.dropboxId!)) continue;
    const meta = await client.getMetadata(f.dropboxId!).catch(() => null);
    if (meta?.tag === "file") ids.add(f.dropboxId!);
    else missing.push(f.id);
  }
  return {
    recordsWithDropbox: files.length,
    foundInDropbox: files.length - missing.length,
    missing,
    blobPathsKept: files.filter((f) => f.blobPath).length,
  };
}
