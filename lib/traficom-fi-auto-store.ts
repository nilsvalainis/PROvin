import "server-only";

import fs from "fs/promises";
import path from "path";
import { get, put } from "@vercel/blob";

import {
  getOrderDraftBlobConfig,
  getOrderDraftStorageDir,
  isSafeOrderDraftSessionId,
} from "@/lib/admin-order-draft-store";
import { sanitizeTraficomFiData } from "@/lib/traficom-fi-auto-logic";
import type { TraficomFiAutoState, TraficomFiAutoStatus } from "@/lib/traficom-fi-auto-types";

/**
 * Traficom (FI) automātikas stāvoklis - viens mazs fails uz pasūtījumu / VIN SCAN atsauci (bez personas datiem).
 * Ceļš: {dir|blobPrefix}/traficom_fi_auto/{sessionId}.json
 */

const SUBDIR = "traficom_fi_auto";
const STATES: readonly TraficomFiAutoState[] = [
  "skipped",
  "not_configured",
  "queued",
  "awaiting_eparaksts",
  "awaiting_browser_code",
  "searching",
  "found",
  "not_found",
  "error",
];

function str(v: unknown, max = 400): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined;
}

export function parseTraficomFiAutoStatus(raw: unknown): TraficomFiAutoStatus | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const state = STATES.find((s) => s === o.state);
  if (!state) return null;
  const code = str(o.verificationCode, 8);
  const pdfRaw = o.pdf && typeof o.pdf === "object" ? (o.pdf as Record<string, unknown>) : null;
  const pdf =
    pdfRaw && str(pdfRaw.dropboxPath) && str(pdfRaw.name)
      ? {
          dropboxPath: str(pdfRaw.dropboxPath, 600)!,
          name: str(pdfRaw.name, 200)!,
          size: typeof pdfRaw.size === "number" && Number.isFinite(pdfRaw.size) ? pdfRaw.size : 0,
          savedAt: str(pdfRaw.savedAt, 40) ?? "",
        }
      : undefined;
  const data = sanitizeTraficomFiData(o.data);
  return {
    state,
    updatedAt: str(o.updatedAt, 40) ?? new Date(0).toISOString(),
    ...(str(o.vin, 20) ? { vin: str(o.vin, 20) } : {}),
    ...(str(o.jobId, 80) ? { jobId: str(o.jobId, 80) } : {}),
    ...(code && /^[0-9A-Za-z]{2,8}$/.test(code) ? { verificationCode: code } : {}),
    ...(str(o.codeExpiresAt, 40) && Number.isFinite(Date.parse(str(o.codeExpiresAt, 40)!)) ? { codeExpiresAt: str(o.codeExpiresAt, 40) } : {}),
    ...(o.codeExpired === true ? { codeExpired: true } : {}),
    ...(typeof o.browserCodeAttempt === "number" && Number.isInteger(o.browserCodeAttempt) && o.browserCodeAttempt > 0 && o.browserCodeAttempt < 10
      ? { browserCodeAttempt: o.browserCodeAttempt }
      : {}),
    ...(o.browserCodeRejected === true ? { browserCodeRejected: true } : {}),
    ...(str(o.message) ? { message: str(o.message) } : {}),
    ...(str(o.requestedAt, 40) ? { requestedAt: str(o.requestedAt, 40) } : {}),
    ...(str(o.checkedAt, 40) ? { checkedAt: str(o.checkedAt, 40) } : {}),
    ...(str(o.rawText, 60_000) ? { rawText: str(o.rawText, 60_000) } : {}),
    ...(data ? { data } : {}),
    ...(o.cached === true ? { cached: true } : {}),
    ...(pdf ? { pdf } : {}),
    ...(str(o.appliedAt, 40) ? { appliedAt: str(o.appliedAt, 40) } : {}),
    ...(o.appliedBy === "auto" || o.appliedBy === "manual" ? { appliedBy: o.appliedBy } : {}),
    ...(str(o.previousRawText, 60_000) ? { previousRawText: str(o.previousRawText, 60_000) } : {}),
    ...(str(o.previousRawSavedAt, 40) ? { previousRawSavedAt: str(o.previousRawSavedAt, 40) } : {}),
    ...(str(o.restoredAt, 40) ? { restoredAt: str(o.restoredAt, 40) } : {}),
    ...(str(o.errorCode, 40) ? { errorCode: str(o.errorCode, 40) } : {}),
    ...(o.trigger === "auto" || o.trigger === "manual" ? { trigger: o.trigger } : {}),
    ...(str(o.reason, 80) ? { reason: str(o.reason, 80) } : {}),
  };
}

function fsPath(dir: string, sessionId: string): string {
  return path.join(dir, SUBDIR, `${sessionId}.json`);
}

function blobPath(prefix: string, sessionId: string): string {
  return `${prefix}${SUBDIR}/${sessionId}.json`;
}

export async function readTraficomFiAutoStatus(sessionId: string): Promise<TraficomFiAutoStatus | null> {
  if (!isSafeOrderDraftSessionId(sessionId)) return null;
  const dir = getOrderDraftStorageDir();
  const blob = getOrderDraftBlobConfig();
  if (blob) {
    try {
      const res = await get(blobPath(blob.prefix, sessionId), { access: "private", token: blob.token, useCache: false });
      if (res?.statusCode === 200 && res.stream) {
        return parseTraficomFiAutoStatus(JSON.parse(await new Response(res.stream).text()));
      }
    } catch {
      /* nav faila */
    }
  }
  if (dir && process.env.VERCEL !== "1") {
    try {
      return parseTraficomFiAutoStatus(JSON.parse(await fs.readFile(fsPath(dir, sessionId), "utf8")));
    } catch {
      /* nav faila */
    }
  }
  return null;
}

export async function writeTraficomFiAutoStatus(
  sessionId: string,
  status: TraficomFiAutoStatus,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isSafeOrderDraftSessionId(sessionId)) return { ok: false, error: "invalid_session" };
  const dir = getOrderDraftStorageDir();
  const blob = getOrderDraftBlobConfig();
  if (!dir && !blob) return { ok: false, error: "store_disabled" };
  if (process.env.VERCEL === "1" && !blob) return { ok: false, error: "store_not_durable" };
  const body = JSON.stringify(status);
  if (blob) {
    try {
      await put(blobPath(blob.prefix, sessionId), body, {
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
  if (dir) {
    try {
      const fp = fsPath(dir, sessionId);
      await fs.mkdir(path.dirname(fp), { recursive: true });
      await fs.writeFile(`${fp}.tmp`, body, "utf8");
      await fs.rename(`${fp}.tmp`, fp);
      return { ok: true };
    } catch {
      return { ok: false, error: "write_failed" };
    }
  }
  return { ok: false, error: "write_failed" };
}
