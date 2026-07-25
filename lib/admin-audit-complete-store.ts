import "server-only";

import fs from "fs/promises";
import path from "path";
import { get, put } from "@vercel/blob";
import {
  getOrderDraftBlobConfig,
  getOrderDraftStorageDir,
  isSafeOrderDraftSessionId,
} from "@/lib/admin-order-draft-store";

/**
 * Atsevišķa maza krātuve 48 h „Izpildīts” atzīmēm.
 * Tikai šis modulis to raksta — workspace / dashboard indekss to neaizskar.
 * Uz Vercel obligāti jāizdodas Blob rakstīšanai (ne /tmp).
 */

const AUDIT_COMPLETE_INDEX_FILENAME = "audit_complete_index.json";

type AuditCompleteIndexDoc = {
  version: 1;
  updatedAt: string;
  /** sessionId → ISO completedAt */
  completed: Record<string, string>;
};

function indexFilePath(dir: string): string {
  return path.join(dir, AUDIT_COMPLETE_INDEX_FILENAME);
}

function normalizeDoc(raw: unknown): AuditCompleteIndexDoc | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (!o.completed || typeof o.completed !== "object") return null;
  const completed: Record<string, string> = {};
  for (const [id, val] of Object.entries(o.completed as Record<string, unknown>)) {
    if (!isSafeOrderDraftSessionId(id)) continue;
    if (typeof val === "string" && val.trim()) completed[id] = val.trim();
  }
  return {
    version: 1,
    updatedAt: typeof o.updatedAt === "string" ? o.updatedAt : new Date(0).toISOString(),
    completed,
  };
}

async function readIndexFromFilesystem(dir: string): Promise<AuditCompleteIndexDoc | null> {
  try {
    const raw = await fs.readFile(indexFilePath(dir), "utf8");
    return normalizeDoc(JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

async function readIndexFromBlob(blob: {
  token: string;
  prefix: string;
}): Promise<AuditCompleteIndexDoc | null> {
  try {
    const res = await get(`${blob.prefix}${AUDIT_COMPLETE_INDEX_FILENAME}`, {
      access: "private",
      token: blob.token,
      useCache: false,
    });
    if (!res || res.statusCode !== 200 || !res.stream) return null;
    return normalizeDoc(JSON.parse(await new Response(res.stream).text()) as unknown);
  } catch {
    return null;
  }
}

function pickNewer(
  a: AuditCompleteIndexDoc | null,
  b: AuditCompleteIndexDoc | null,
): AuditCompleteIndexDoc | null {
  if (!a) return b;
  if (!b) return a;
  const aTs = Date.parse(a.updatedAt);
  const bTs = Date.parse(b.updatedAt);
  return (Number.isFinite(bTs) ? bTs : 0) >= (Number.isFinite(aTs) ? aTs : 0) ? b : a;
}

async function readAuditCompleteIndex(): Promise<AuditCompleteIndexDoc> {
  const dir = getOrderDraftStorageDir();
  const blob = getOrderDraftBlobConfig();
  const fromFs = dir ? await readIndexFromFilesystem(dir) : null;
  const fromBlob = blob ? await readIndexFromBlob(blob) : null;
  return (
    pickNewer(fromFs, fromBlob) ?? {
      version: 1,
      updatedAt: new Date(0).toISOString(),
      completed: {},
    }
  );
}

async function writeAuditCompleteIndex(
  doc: AuditCompleteIndexDoc,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const dir = getOrderDraftStorageDir();
  const blob = getOrderDraftBlobConfig();
  if (!dir && !blob) return { ok: false, error: "store_disabled" };
  if (process.env.VERCEL === "1" && !blob) return { ok: false, error: "store_not_durable" };

  const body = JSON.stringify(doc);
  let fsOk = false;
  let blobOk = false;

  if (dir) {
    try {
      await fs.mkdir(dir, { recursive: true });
      const fp = indexFilePath(dir);
      const tmp = `${fp}.tmp`;
      await fs.writeFile(tmp, body, "utf8");
      await fs.rename(tmp, fp);
      fsOk = true;
    } catch {
      fsOk = false;
    }
  }

  if (blob) {
    try {
      await put(`${blob.prefix}${AUDIT_COMPLETE_INDEX_FILENAME}`, body, {
        access: "private",
        token: blob.token,
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: "application/json",
      });
      blobOk = true;
    } catch {
      blobOk = false;
    }
  }

  if (!fsOk && !blobOk) return { ok: false, error: "write_failed:fs_and_blob" };
  if (process.env.VERCEL === "1" && !blobOk) return { ok: false, error: "store_not_durable" };
  return { ok: true };
}

export async function setAuditDeadlineComplete(
  sessionId: string,
  complete: boolean,
): Promise<
  | { ok: true; completedAt: string | null; durable: boolean }
  | { ok: false; error: string }
> {
  if (!isSafeOrderDraftSessionId(sessionId)) return { ok: false, error: "invalid_session" };

  const idx = await readAuditCompleteIndex();
  const completed = { ...idx.completed };
  let completedAt: string | null = null;

  if (complete) {
    completedAt = new Date().toISOString();
    completed[sessionId] = completedAt;
  } else {
    delete completed[sessionId];
  }

  const doc: AuditCompleteIndexDoc = {
    version: 1,
    updatedAt: new Date().toISOString(),
    completed,
  };
  const write = await writeAuditCompleteIndex(doc);
  if (!write.ok) return write;

  return {
    ok: true,
    completedAt,
    durable: Boolean(getOrderDraftBlobConfig()) || process.env.VERCEL !== "1",
  };
}

/** Dashboard: viena maza JSON lasīšana visiem sessionId. */
export async function getAuditDeadlineCompleteMap(
  sessionIds: string[],
): Promise<Map<string, boolean>> {
  const idx = await readAuditCompleteIndex();
  const out = new Map<string, boolean>();
  for (const id of sessionIds) {
    out.set(id, Boolean(idx.completed[id]));
  }
  return out;
}
