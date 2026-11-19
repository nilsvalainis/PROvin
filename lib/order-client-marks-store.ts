import "server-only";

import fs from "fs/promises";
import path from "path";
import { get, put } from "@vercel/blob";
import {
  getOrderDraftBlobConfig,
  getOrderDraftStorageDir,
  isSafeOrderDraftSessionId,
} from "@/lib/admin-order-draft-store";
import { parseOrderClientMarks, type OrderClientMarks } from "@/lib/order-client-marks";

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

export async function updateOrderClientMarks(
  sessionId: string,
  fn: (cur: OrderClientMarks) => OrderClientMarks,
): Promise<OrderClientMarks | null> {
  const next = fn(await readOrderClientMarks(sessionId));
  return (await writeOrderClientMarks(sessionId, next)) ? next : null;
}
