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
 * 3 h SLA brīdinājuma dedupe (viens ieraksts uz pasūtījumu / termiņu).
 * Nav jaunu ārējo atslēgu: tas pats Blob/FS, kas order-draft.
 */

const FILE = "sla_warning/index.json";

export type AuditSlaWarningRecord = { warnedAt: string; deadlineUnix: number };

type IndexDoc = { entries: Record<string, AuditSlaWarningRecord> };

function emptyIndex(): IndexDoc {
  return { entries: {} };
}

async function readIndex(): Promise<IndexDoc> {
  const blob = getOrderDraftBlobConfig();
  if (blob) {
    try {
      const res = await get(`${blob.prefix}${FILE}`, {
        access: "private",
        token: blob.token,
        useCache: false,
      });
      if (res?.statusCode === 200 && res.stream) {
        const raw = JSON.parse(await new Response(res.stream).text()) as IndexDoc;
        if (raw && typeof raw === "object" && raw.entries && typeof raw.entries === "object") {
          return raw;
        }
      }
    } catch {
      /* missing */
    }
    if (process.env.VERCEL === "1") return emptyIndex();
  }

  const dir = getOrderDraftStorageDir();
  if (dir && process.env.VERCEL !== "1") {
    try {
      const raw = JSON.parse(await fs.readFile(path.join(dir, FILE), "utf8")) as IndexDoc;
      if (raw && typeof raw === "object" && raw.entries && typeof raw.entries === "object") {
        return raw;
      }
    } catch {
      /* missing */
    }
  }
  return emptyIndex();
}

export function isAuditSlaWarningStoreDurable(): boolean {
  if (getOrderDraftBlobConfig()) return true;
  return Boolean(getOrderDraftStorageDir()) && process.env.VERCEL !== "1";
}

export async function readAuditSlaWarningMap(
  sessionIds: string[],
): Promise<Map<string, AuditSlaWarningRecord>> {
  const index = await readIndex();
  const out = new Map<string, AuditSlaWarningRecord>();
  for (const id of sessionIds) {
    const rec = index.entries[id];
    if (rec && typeof rec.deadlineUnix === "number") out.set(id, rec);
  }
  return out;
}

export async function markAuditSlaWarned(
  sessionId: string,
  deadlineUnix: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isSafeOrderDraftSessionId(sessionId)) return { ok: false, error: "invalid_session" };
  if (!isAuditSlaWarningStoreDurable()) return { ok: false, error: "store_not_durable" };

  const index = await readIndex();
  index.entries[sessionId] = { warnedAt: new Date().toISOString(), deadlineUnix };
  const payload = JSON.stringify(index);

  const blob = getOrderDraftBlobConfig();
  if (blob) {
    try {
      await put(`${blob.prefix}${FILE}`, payload, {
        access: "private",
        token: blob.token,
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: "application/json",
      });
      return { ok: true };
    } catch {
      if (process.env.VERCEL === "1") return { ok: false, error: "write_failed" };
    }
  }

  const dir = getOrderDraftStorageDir();
  if (dir && process.env.VERCEL !== "1") {
    try {
      const fp = path.join(dir, FILE);
      await fs.mkdir(path.dirname(fp), { recursive: true });
      const tmp = `${fp}.tmp`;
      await fs.writeFile(tmp, payload, "utf8");
      await fs.rename(tmp, fp);
      return { ok: true };
    } catch {
      return { ok: false, error: "write_failed" };
    }
  }
  return { ok: false, error: "store_not_durable" };
}
