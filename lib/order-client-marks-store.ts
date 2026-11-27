import "server-only";

import fs from "fs/promises";
import path from "path";
import { get, put } from "@vercel/blob";
import {
  getOrderDraftBlobConfig,
  getOrderDraftStorageDir,
  isSafeOrderDraftSessionId,
} from "@/lib/admin-order-draft-store";
import { BLOB_CAS_ATTEMPTS, putBlobBodyIfMatch } from "@/lib/blob-if-match-put";
import { readPrivateBlobText } from "@/lib/blob-read";
import { compareAndSwap } from "@/lib/conditional-write";
import {
  parseOrderClientMarks,
  withAuditSend,
  withDealerSend,
  type AuditSendRecord,
  type DealerSendRecord,
  type OrderClientMarks,
} from "@/lib/order-client-marks";

/**
 * Klienta saziņas atzīmes - viens mazs fails uz pasūtījumu (jauns, veci pasūtījumi netiek aiztikti).
 * Ceļš: {dir|blobPrefix}/client_marks/{sessionId}.json
 */
const SUBDIR = "client_marks";

function fsPath(dir: string, sessionId: string): string {
  return path.join(dir, SUBDIR, `${sessionId}.json`);
}

function blobPath(prefix: string, sessionId: string): string {
  return `${prefix}${SUBDIR}/${sessionId}.json`;
}

export async function readOrderClientMarks(sessionId: string): Promise<OrderClientMarks> {
  if (!isSafeOrderDraftSessionId(sessionId)) return {};
  const blob = getOrderDraftBlobConfig();
  const dir = getOrderDraftStorageDir();
  if (blob) {
    try {
      const res = await get(blobPath(blob.prefix, sessionId), { access: "private", token: blob.token, useCache: false });
      if (res?.statusCode === 200 && res.stream) {
        return parseOrderClientMarks(JSON.parse(await new Response(res.stream).text()));
      }
    } catch {
      /* nav faila */
    }
    if (process.env.VERCEL === "1" || !dir) return {};
  }
  if (dir && process.env.VERCEL !== "1") {
    try {
      return parseOrderClientMarks(JSON.parse(await fs.readFile(fsPath(dir, sessionId), "utf8")));
    } catch {
      /* nav faila */
    }
  }
  return {};
}

export async function writeOrderClientMarks(sessionId: string, marks: OrderClientMarks): Promise<boolean> {
  if (!isSafeOrderDraftSessionId(sessionId)) return false;
  const blob = getOrderDraftBlobConfig();
  const dir = getOrderDraftStorageDir();
  const body = JSON.stringify(marks);
  if (blob) {
    try {
      await put(blobPath(blob.prefix, sessionId), body, {
        access: "private",
        token: blob.token,
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: "application/json",
      });
      return true;
    } catch {
      if (process.env.VERCEL === "1") return false;
    }
  }
  if (dir && process.env.VERCEL !== "1") {
    try {
      const fp = fsPath(dir, sessionId);
      await fs.mkdir(path.dirname(fp), { recursive: true });
      await fs.writeFile(`${fp}.tmp`, body, "utf8");
      await fs.rename(`${fp}.tmp`, fp);
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

/**
 * Atjauno atzīmes ar CAS (Blob `ifMatch`; lokāli - procesa slēdzene), lai divi vienlaicīgi
 * sūtījumi (piem. serveris + WhatsApp atzīme) nepazaudē viens otra ierakstu.
 */
export async function updateOrderClientMarks(
  sessionId: string,
  fn: (cur: OrderClientMarks) => OrderClientMarks,
): Promise<OrderClientMarks | null> {
  if (!isSafeOrderDraftSessionId(sessionId)) return null;
  const blob = getOrderDraftBlobConfig();
  if (blob) {
    const pathname = blobPath(blob.prefix, sessionId);
    try {
      return await compareAndSwap<OrderClientMarks, OrderClientMarks>({
        read: async () => {
          const snap = await readPrivateBlobText({ pathname, token: blob.token });
          if (snap.state === "missing") return { value: null, etag: null };
          return { value: parseOrderClientMarks(JSON.parse(snap.text)), etag: snap.etag };
        },
        write: async (next, etag) => {
          await putBlobBodyIfMatch({ pathname, body: JSON.stringify(next), token: blob.token, etag, seen: etag != null });
        },
        update: (cur) => {
          const next = fn(cur ?? {});
          return { next, result: next };
        },
        maxAttempts: BLOB_CAS_ATTEMPTS,
      });
    } catch (err) {
      console.error("[order-client-marks] update failed", { sessionId, error: err instanceof Error ? err.message.slice(0, 120) : "unknown" });
      if (process.env.VERCEL === "1") return null;
    }
  }
  return withLocalLock(sessionId, async () => {
    const next = fn(await readOrderClientMarks(sessionId));
    return (await writeOrderClientMarks(sessionId, next)) ? next : null;
  });
}

const localLocks = new Map<string, Promise<unknown>>();
async function withLocalLock<T>(key: string, run: () => Promise<T>): Promise<T> {
  const prev = localLocks.get(key) ?? Promise.resolve();
  const p = prev.catch(() => undefined).then(run);
  localLocks.set(key, p);
  try {
    return await p;
  } finally {
    if (localLocks.get(key) === p) localLocks.delete(key);
  }
}

/** Servera maršrutiem pēc veiksmīgas sūtīšanas. Kļūda sūtījumu neaptur (atgriež null). */
export async function recordDealerSendOnServer(
  sessionId: string,
  rec: DealerSendRecord,
): Promise<OrderClientMarks | null> {
  try {
    return await updateOrderClientMarks(sessionId, (cur) => withDealerSend(cur, rec));
  } catch {
    return null;
  }
}

/** AUDITS «Sūtīt atskaiti» žurnāls pēc veiksmīgas sūtīšanas. Kļūda sūtījumu neaptur (atgriež null). */
export async function recordAuditSendOnServer(
  sessionId: string,
  rec: AuditSendRecord,
): Promise<OrderClientMarks | null> {
  try {
    return await updateOrderClientMarks(sessionId, (cur) => withAuditSend(cur, rec));
  } catch {
    return null;
  }
}
