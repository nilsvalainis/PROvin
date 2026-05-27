import "server-only";

import fs from "fs/promises";
import os from "os";
import path from "path";
import { put, get } from "@vercel/blob";
import {
  describeOrderDraftWriteResult,
  isOrderDraftStorageDurable,
  isOrderDraftStoreEnabled,
} from "@/lib/admin-order-draft-store";

const HEALTH_PROBE_ID = "__provin_persistence_health_probe__";

export type PersistenceHealthReport = {
  ok: boolean;
  durable: boolean;
  storeEnabled: boolean;
  backend: "blob" | "filesystem" | "blob+filesystem" | "none";
  blob: {
    configured: boolean;
    reachable: boolean;
    canWrite: boolean;
    canRead: boolean;
    writeLatencyMs: number | null;
    readLatencyMs: number | null;
    error: string | null;
  };
  filesystem: {
    configured: boolean;
    path: string | null;
    ephemeral: boolean;
    canWrite: boolean;
    error: string | null;
  };
  vercel: boolean;
  checkedAt: string;
};

function resolveBlobCfg(): { token: string; prefix: string } | null {
  const rawPrefix = (process.env.ADMIN_ORDER_DRAFT_BLOB_PREFIX ?? "").trim();
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim() ?? "";
  if (!rawPrefix || !token) return null;
  const prefix = rawPrefix.endsWith("/") ? rawPrefix : `${rawPrefix}/`;
  return { token, prefix };
}

function resolveDraftDir(): string | null {
  const raw = process.env.ADMIN_ORDER_DRAFT_DIR?.trim() ?? "";
  const off = ["0", "false", "no", "off", "disabled"];
  if (off.includes(raw.toLowerCase())) return null;
  if (raw) return path.resolve(raw);
  if (process.env.VERCEL === "1") return path.join(os.tmpdir(), "provin-admin-order-drafts");
  return path.join(process.cwd(), ".data/admin-order-drafts");
}

function isEphemeralDraftDir(dir: string): boolean {
  const normalized = path.resolve(dir);
  const tmp = path.resolve(os.tmpdir());
  return normalized === tmp || normalized.startsWith(`${tmp}${path.sep}`);
}

export async function runPersistenceHealthCheck(): Promise<PersistenceHealthReport> {
  const blobCfg = resolveBlobCfg();
  const dir = resolveDraftDir();
  const vercel = process.env.VERCEL === "1";
  const durable = isOrderDraftStorageDurable();
  const storeEnabled = isOrderDraftStoreEnabled();

  const blob = {
    configured: Boolean(blobCfg),
    reachable: false,
    canWrite: false,
    canRead: false,
    writeLatencyMs: null as number | null,
    readLatencyMs: null as number | null,
    error: null as string | null,
  };

  if (blobCfg) {
    const pathname = `${blobCfg.prefix}${HEALTH_PROBE_ID}.json`;
    const payload = JSON.stringify({ probe: true, at: new Date().toISOString() });
    try {
      const w0 = Date.now();
      await put(pathname, payload, {
        access: "private",
        token: blobCfg.token,
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: "application/json",
      });
      blob.writeLatencyMs = Date.now() - w0;
      blob.canWrite = true;
      blob.reachable = true;
      const r0 = Date.now();
      const res = await get(pathname, { access: "private", token: blobCfg.token, useCache: false });
      blob.readLatencyMs = Date.now() - r0;
      if (res?.statusCode === 200 && res.stream) {
        const text = await new Response(res.stream).text();
        blob.canRead = text.includes("probe");
      }
    } catch (e) {
      blob.error = e instanceof Error ? e.message : String(e);
    }
  }

  const filesystem = {
    configured: Boolean(dir),
    path: dir,
    ephemeral: dir ? isEphemeralDraftDir(dir) : false,
    canWrite: false,
    error: null as string | null,
  };

  if (dir && !(vercel && blobCfg && isEphemeralDraftDir(dir))) {
    try {
      await fs.mkdir(dir, { recursive: true });
      const fp = path.join(dir, `${HEALTH_PROBE_ID}.json`);
      await fs.writeFile(fp, JSON.stringify({ probe: true }), "utf8");
      filesystem.canWrite = true;
    } catch (e) {
      filesystem.error = e instanceof Error ? e.message : String(e);
    }
  }

  const meta = describeOrderDraftWriteResult(filesystem.canWrite, blob.canWrite, dir);
  const ok = durable && (blob.canWrite && blob.canRead || (!vercel && filesystem.canWrite && !filesystem.ephemeral));

  return {
    ok,
    durable,
    storeEnabled,
    backend: meta.storageBackend,
    blob,
    filesystem,
    vercel,
    checkedAt: new Date().toISOString(),
  };
}
