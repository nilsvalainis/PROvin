import "server-only";

import fs from "fs/promises";
import path from "path";
import { get, put } from "@vercel/blob";

import {
  getOrderDraftBlobConfig,
  getOrderDraftStorageDir,
  isSafeOrderDraftSessionId,
} from "@/lib/admin-order-draft-store";
import { parseLtabCertificateRaw } from "@/lib/ltab-report-extract";
import type { LtabAutoState, LtabAutoStatus } from "@/lib/ltab-auto-types";

/**
 * LTAB automātikas stāvoklis - viens mazs fails uz pasūtījumu.
 * Ceļš: {dir|blobPrefix}/ltab_auto/{sessionId}.json
 */

const SUBDIR = "ltab_auto";
const STATES: readonly LtabAutoState[] = [
  "skipped",
  "not_configured",
  "queued",
  "awaiting_smartid",
  "searching",
  "no_claims",
  "claims",
  "error",
];

function str(v: unknown, max = 400): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined;
}

export function parseLtabAutoStatus(raw: unknown): LtabAutoStatus | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const state = STATES.find((s) => s === o.state);
  if (!state) return null;
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
  const certificate = parseLtabCertificateRaw(o.certificate);
  const code = str(o.verificationCode, 8);
  return {
    state,
    updatedAt: str(o.updatedAt, 40) ?? new Date(0).toISOString(),
    ...(str(o.plate, 12) ? { plate: str(o.plate, 12) } : {}),
    ...(str(o.jobId, 80) ? { jobId: str(o.jobId, 80) } : {}),
    ...(code && /^\d{4}$/.test(code) ? { verificationCode: code } : {}),
    ...(str(o.message) ? { message: str(o.message) } : {}),
    ...(str(o.requestedAt, 40) ? { requestedAt: str(o.requestedAt, 40) } : {}),
    ...(str(o.checkedAt, 40) ? { checkedAt: str(o.checkedAt, 40) } : {}),
    ...(pdf ? { pdf } : {}),
    ...(certificate ? { certificate } : {}),
    ...(str(o.mismatch) ? { mismatch: str(o.mismatch) } : {}),
    ...(str(o.appliedAt, 40) ? { appliedAt: str(o.appliedAt, 40) } : {}),
    ...(o.trigger === "auto" || o.trigger === "manual" ? { trigger: o.trigger } : {}),
  };
}

function fsPath(dir: string, sessionId: string): string {
  return path.join(dir, SUBDIR, `${sessionId}.json`);
}

function blobPath(prefix: string, sessionId: string): string {
  return `${prefix}${SUBDIR}/${sessionId}.json`;
}

export async function readLtabAutoStatus(sessionId: string): Promise<LtabAutoStatus | null> {
  if (!isSafeOrderDraftSessionId(sessionId)) return null;
  const dir = getOrderDraftStorageDir();
  const blob = getOrderDraftBlobConfig();
  if (blob) {
    try {
      const res = await get(blobPath(blob.prefix, sessionId), { access: "private", token: blob.token, useCache: false });
      if (res?.statusCode === 200 && res.stream) {
        return parseLtabAutoStatus(JSON.parse(await new Response(res.stream).text()));
      }
    } catch {
      /* nav faila */
    }
  }
  if (dir && process.env.VERCEL !== "1") {
    try {
      return parseLtabAutoStatus(JSON.parse(await fs.readFile(fsPath(dir, sessionId), "utf8")));
    } catch {
      /* nav faila */
    }
  }
  return null;
}

export async function writeLtabAutoStatus(
  sessionId: string,
  status: LtabAutoStatus,
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
