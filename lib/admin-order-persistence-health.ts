import "server-only";

import fs from "fs/promises";
import os from "os";
import path from "path";
import { put } from "@vercel/blob";
import {
  describeOrderDraftWriteResult,
  isOrderDraftStorageDurable,
  isOrderDraftStoreEnabled,
} from "@/lib/admin-order-draft-store";
import { blobEtagIsWeak } from "@/lib/blob-etag";
import { putBlobBodyIfMatch, readBlobTextWithEtag } from "@/lib/blob-if-match-put";

const HEALTH_PROBE_ID = "__provin_persistence_health_probe__";
/** Vercel Blob vājo ETag (`W/"…"`) dod lielākiem objektiem; sīks probe to neredz. */
export const PERSISTENCE_HEALTH_MIN_BYTES = 64 * 1024;

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
    canConditionalWrite: boolean;
    payloadBytes: number | null;
    etag: string | null;
    etagWeak: boolean;
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

export function buildPersistenceHealthPayload(at = new Date().toISOString()): string {
  const pad = "H".repeat(PERSISTENCE_HEALTH_MIN_BYTES);
  return JSON.stringify({ probe: true, at, pad });
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
    canConditionalWrite: false,
    payloadBytes: null as number | null,
    etag: null as string | null,
    etagWeak: false,
    writeLatencyMs: null as number | null,
    readLatencyMs: null as number | null,
    error: null as string | null,
  };

  if (blobCfg) {
    const pathname = `${blobCfg.prefix}${HEALTH_PROBE_ID}.json`;
    const payload = buildPersistenceHealthPayload();
    blob.payloadBytes = Buffer.byteLength(payload, "utf8");
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
      const snap = await readBlobTextWithEtag({ pathname, token: blobCfg.token });
      blob.readLatencyMs = Date.now() - r0;
      if (snap && snap.text.includes("probe") && snap.text.length >= PERSISTENCE_HEALTH_MIN_BYTES) {
        blob.canRead = true;
        blob.etag = snap.etag;
        blob.etagWeak = blobEtagIsWeak(snap.rawEtag);
        const second = JSON.stringify({
          ...JSON.parse(snap.text),
          at: new Date().toISOString(),
          roundtrip: true,
        });
        await putBlobBodyIfMatch({
          pathname,
          body: second,
          token: blobCfg.token,
          etag: snap.rawEtag,
          seen: true,
        });
        const verify = await readBlobTextWithEtag({ pathname, token: blobCfg.token });
        blob.canConditionalWrite = Boolean(verify?.text.includes("roundtrip"));
        if (!blob.canConditionalWrite) {
          blob.error = "ifMatch_roundtrip_failed";
        }
      } else if (!snap?.text.includes("probe")) {
        blob.error = "readback_mismatch";
      } else {
        blob.error = "payload_too_small";
      }
    } catch (e) {
      blob.error = e instanceof Error ? e.message : String(e);
      console.error("[persistence-health] blob roundtrip failed", blob.error);
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
  const blobOk = blob.canWrite && blob.canRead && blob.canConditionalWrite;
  const ok = durable && (blobOk || (!vercel && filesystem.canWrite && !filesystem.ephemeral));

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
