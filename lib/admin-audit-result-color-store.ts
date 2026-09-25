import "server-only";

import fs from "fs/promises";
import path from "path";
import { get, put } from "@vercel/blob";
import {
  parseAuditResultColor,
  type AuditResultColor,
} from "@/lib/admin-audit-result-color";
import {
  getOrderDraftBlobConfig,
  getOrderDraftStorageDir,
  isSafeOrderDraftSessionId,
} from "@/lib/admin-order-draft-store";

/**
 * Audita rezultāta krāsa — viens mazs fails uz pasūtījumu.
 * Ceļš: {dir|blobPrefix}/audit_result_color/{sessionId}.json
 */

const SUBDIR = "audit_result_color";

type ColorDoc = { color: AuditResultColor | null; at: string };

function fsColorPath(dir: string, sessionId: string): string {
  return path.join(dir, SUBDIR, `${sessionId}.json`);
}

function blobColorPath(prefix: string, sessionId: string): string {
  return `${prefix}${SUBDIR}/${sessionId}.json`;
}

async function readColor(sessionId: string): Promise<AuditResultColor | null> {
  const dir = getOrderDraftStorageDir();
  const blob = getOrderDraftBlobConfig();

  if (blob) {
    try {
      const res = await get(blobColorPath(blob.prefix, sessionId), {
        access: "private",
        token: blob.token,
        useCache: false,
      });
      if (res?.statusCode === 200 && res.stream) {
        const raw = JSON.parse(await new Response(res.stream).text()) as { color?: unknown };
        return parseAuditResultColor(raw?.color);
      }
    } catch {
      /* fall through */
    }
  }

  if (dir && process.env.VERCEL !== "1") {
    try {
      const raw = JSON.parse(await fs.readFile(fsColorPath(dir, sessionId), "utf8")) as {
        color?: unknown;
      };
      return parseAuditResultColor(raw?.color);
    } catch {
      /* missing */
    }
  }

  return null;
}

async function writeColor(
  sessionId: string,
  color: AuditResultColor | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const dir = getOrderDraftStorageDir();
  const blob = getOrderDraftBlobConfig();
  if (!dir && !blob) return { ok: false, error: "store_disabled" };
  if (process.env.VERCEL === "1" && !blob) return { ok: false, error: "store_not_durable" };

  const doc: ColorDoc = { color, at: new Date().toISOString() };
  let fsOk = false;
  let blobOk = false;

  if (dir && process.env.VERCEL !== "1") {
    try {
      const fp = fsColorPath(dir, sessionId);
      await fs.mkdir(path.dirname(fp), { recursive: true });
      if (color) {
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
      await put(blobColorPath(blob.prefix, sessionId), JSON.stringify(doc), {
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

  if (process.env.VERCEL === "1") {
    return blobOk ? { ok: true } : { ok: false, error: "store_not_durable" };
  }
  if (!fsOk && !blobOk) return { ok: false, error: "write_failed" };
  return { ok: true };
}

export async function setAuditResultColor(
  sessionId: string,
  color: AuditResultColor | null,
): Promise<{ ok: true; color: AuditResultColor | null } | { ok: false; error: string }> {
  if (!isSafeOrderDraftSessionId(sessionId)) return { ok: false, error: "invalid_session" };

  const write = await writeColor(sessionId, color);
  if (!write.ok) return write;

  return { ok: true, color };
}

export async function getAuditResultColorMap(
  sessionIds: string[],
): Promise<Map<string, AuditResultColor | null>> {
  const out = new Map<string, AuditResultColor | null>();
  const ids = sessionIds.filter(isSafeOrderDraftSessionId);
  await Promise.all(
    ids.map(async (id) => {
      out.set(id, await readColor(id));
    }),
  );
  for (const id of sessionIds) {
    if (!out.has(id)) out.set(id, null);
  }
  return out;
}

export async function getAuditResultColor(
  sessionId: string,
): Promise<AuditResultColor | null> {
  if (!isSafeOrderDraftSessionId(sessionId)) return null;
  return readColor(sessionId);
}
