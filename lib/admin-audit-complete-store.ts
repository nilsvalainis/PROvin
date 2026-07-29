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
 * „Izpildīts” — viens mazs fails uz pasūtījumu (nav kopīga indeksa → nav race).
 * Ceļš: {dir|blobPrefix}/audit_complete/{sessionId}.json
 */

const SUBDIR = "audit_complete";

type FlagDoc = { complete: true; at: string };

function fsFlagPath(dir: string, sessionId: string): string {
  return path.join(dir, SUBDIR, `${sessionId}.json`);
}

function blobFlagPath(prefix: string, sessionId: string): string {
  return `${prefix}${SUBDIR}/${sessionId}.json`;
}

async function readFlag(sessionId: string): Promise<boolean> {
  const dir = getOrderDraftStorageDir();
  const blob = getOrderDraftBlobConfig();

  if (blob) {
    try {
      const res = await get(blobFlagPath(blob.prefix, sessionId), {
        access: "private",
        token: blob.token,
        useCache: false,
      });
      if (res?.statusCode === 200 && res.stream) {
        const raw = JSON.parse(await new Response(res.stream).text()) as { complete?: unknown };
        if (raw?.complete === true) return true;
      }
    } catch {
      /* fall through */
    }
  }

  if (dir && process.env.VERCEL !== "1") {
    try {
      const raw = JSON.parse(await fs.readFile(fsFlagPath(dir, sessionId), "utf8")) as {
        complete?: unknown;
      };
      if (raw?.complete === true) return true;
    } catch {
      /* missing */
    }
  }

  return false;
}

async function writeFlag(
  sessionId: string,
  complete: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const dir = getOrderDraftStorageDir();
  const blob = getOrderDraftBlobConfig();
  if (!dir && !blob) return { ok: false, error: "store_disabled" };
  if (process.env.VERCEL === "1" && !blob) return { ok: false, error: "store_not_durable" };

  let fsOk = false;
  let blobOk = false;

  if (dir && process.env.VERCEL !== "1") {
    try {
      const fp = fsFlagPath(dir, sessionId);
      await fs.mkdir(path.dirname(fp), { recursive: true });
      if (complete) {
        const doc: FlagDoc = { complete: true, at: new Date().toISOString() };
        const tmp = `${fp}.tmp`;
        await fs.writeFile(tmp, JSON.stringify(doc), "utf8");
        await fs.rename(tmp, fp);
      } else {
        await fs.unlink(fp).catch(() => {});
      }
      fsOk = true;
    } catch {
      fsOk = false;
    }
  }

  if (blob) {
    try {
      if (complete) {
        const doc: FlagDoc = { complete: true, at: new Date().toISOString() };
        await put(blobFlagPath(blob.prefix, sessionId), JSON.stringify(doc), {
          access: "private",
          token: blob.token,
          addRandomSuffix: false,
          allowOverwrite: true,
          contentType: "application/json",
        });
      } else {
        // Nav del — pārrakstām kā incomplete, lai get skaidri rāda false
        await put(blobFlagPath(blob.prefix, sessionId), JSON.stringify({ complete: false }), {
          access: "private",
          token: blob.token,
          addRandomSuffix: false,
          allowOverwrite: true,
          contentType: "application/json",
        });
      }
      blobOk = true;
    } catch {
      blobOk = false;
    }
  }

  if (process.env.VERCEL === "1") {
    return blobOk ? { ok: true } : { ok: false, error: "store_not_durable" };
  }
  if (!fsOk && !blobOk) return { ok: false, error: "write_failed" };
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

  const write = await writeFlag(sessionId, complete);
  if (!write.ok) return write;

  return {
    ok: true,
    completedAt: complete ? new Date().toISOString() : null,
    durable: Boolean(getOrderDraftBlobConfig()) || process.env.VERCEL !== "1",
  };
}

export async function getAuditDeadlineCompleteMap(
  sessionIds: string[],
): Promise<Map<string, boolean>> {
  const out = new Map<string, boolean>();
  const ids = sessionIds.filter(isSafeOrderDraftSessionId);
  await Promise.all(
    ids.map(async (id) => {
      out.set(id, await readFlag(id));
    }),
  );
  for (const id of sessionIds) {
    if (!out.has(id)) out.set(id, false);
  }
  return out;
}
