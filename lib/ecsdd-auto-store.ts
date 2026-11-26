import "server-only";

import fs from "fs/promises";
import path from "path";
import { get, put } from "@vercel/blob";

import {
  getOrderDraftBlobConfig,
  getOrderDraftStorageDir,
  isSafeOrderDraftSessionId,
} from "@/lib/admin-order-draft-store";
import type { EcsddAutoState, EcsddAutoStatus } from "@/lib/ecsdd-auto-types";

/**
 * e.csdd automātikas stāvoklis - viens mazs fails uz pasūtījumu (ar e.csdd tekstu, bez personas datiem).
 * Ceļš: {dir|blobPrefix}/ecsdd_auto/{sessionId}.json
 */

const SUBDIR = "ecsdd_auto";
const STATES: readonly EcsddAutoState[] = [
  "skipped",
  "not_configured",
  "queued",
  "awaiting_login",
  "awaiting_smartid",
  "searching",
  "found",
  "not_found",
  "error",
];

function str(v: unknown, max = 400): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined;
}

export function parseEcsddAutoStatus(raw: unknown): EcsddAutoStatus | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const state = STATES.find((s) => s === o.state);
  if (!state) return null;
  const code = str(o.verificationCode, 8);
  return {
    state,
    updatedAt: str(o.updatedAt, 40) ?? new Date(0).toISOString(),
    ...(str(o.query, 20) ? { query: str(o.query, 20) } : {}),
    ...(o.queryKind === "vin" || o.queryKind === "plate" ? { queryKind: o.queryKind } : {}),
    ...(str(o.jobId, 80) ? { jobId: str(o.jobId, 80) } : {}),
    ...(code && /^\d{4}$/.test(code) ? { verificationCode: code } : {}),
    ...(str(o.message) ? { message: str(o.message) } : {}),
    ...(str(o.requestedAt, 40) ? { requestedAt: str(o.requestedAt, 40) } : {}),
    ...(str(o.checkedAt, 40) ? { checkedAt: str(o.checkedAt, 40) } : {}),
    ...(str(o.rawText, 60_000) ? { rawText: str(o.rawText, 60_000) } : {}),
    ...(str(o.appliedAt, 40) ? { appliedAt: str(o.appliedAt, 40) } : {}),
    ...(o.appliedBy === "auto" || o.appliedBy === "manual" ? { appliedBy: o.appliedBy } : {}),
    ...(str(o.previousRawText, 60_000) ? { previousRawText: str(o.previousRawText, 60_000) } : {}),
    ...(str(o.previousRawSavedAt, 40) ? { previousRawSavedAt: str(o.previousRawSavedAt, 40) } : {}),
    ...(str(o.appliedRawHash, 40) ? { appliedRawHash: str(o.appliedRawHash, 40) } : {}),
    ...(str(o.restoredAt, 40) ? { restoredAt: str(o.restoredAt, 40) } : {}),
    ...(str(o.smartIdAskedAt, 40) ? { smartIdAskedAt: str(o.smartIdAskedAt, 40) } : {}),
    ...(str(o.errorCode, 40) ? { errorCode: str(o.errorCode, 40) } : {}),
    ...(str(o.waitReason, 20) ? { waitReason: str(o.waitReason, 20) } : {}),
    ...(o.trigger === "auto" || o.trigger === "manual" ? { trigger: o.trigger } : {}),
  };
}

function fsPath(dir: string, sessionId: string): string {
  return path.join(dir, SUBDIR, `${sessionId}.json`);
}

function blobPath(prefix: string, sessionId: string): string {
  return `${prefix}${SUBDIR}/${sessionId}.json`;
}

async function readJson(key: string): Promise<unknown> {
  const dir = getOrderDraftStorageDir();
  const blob = getOrderDraftBlobConfig();
  if (blob) {
    try {
      const res = await get(blobPath(blob.prefix, key), { access: "private", token: blob.token, useCache: false });
      if (res?.statusCode === 200 && res.stream) return JSON.parse(await new Response(res.stream).text());
    } catch {
      /* nav faila */
    }
  }
  if (dir && process.env.VERCEL !== "1") {
    try {
      return JSON.parse(await fs.readFile(fsPath(dir, key), "utf8"));
    } catch {
      /* nav faila */
    }
  }
  return null;
}

async function writeJson(key: string, value: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  const dir = getOrderDraftStorageDir();
  const blob = getOrderDraftBlobConfig();
  if (!dir && !blob) return { ok: false, error: "store_disabled" };
  if (process.env.VERCEL === "1" && !blob) return { ok: false, error: "store_not_durable" };
  const body = JSON.stringify(value);
  if (blob) {
    try {
      await put(blobPath(blob.prefix, key), body, {
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
      const fp = fsPath(dir, key);
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

export async function readEcsddAutoStatus(sessionId: string): Promise<EcsddAutoStatus | null> {
  if (!isSafeOrderDraftSessionId(sessionId)) return null;
  return parseEcsddAutoStatus(await readJson(sessionId));
}

export async function writeEcsddAutoStatus(
  sessionId: string,
  status: EcsddAutoStatus,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isSafeOrderDraftSessionId(sessionId)) return { ok: false, error: "invalid_session" };
  return writeJson(sessionId, status);
}

/**
 * Pasūtījumi, kuru e.csdd uzziņa beidzās ar neapstiprinātu Smart-ID. Kad serveris atkal ielogojas
 * (Nils nospiež «Mēģināt vēlreiz» vienā pasūtījumā), tie visi tiek ielikti rindā no jauna - viens Smart-ID visiem.
 */
export type EcsddSmartIdRetryEntry = { ref: string; query: string; at: string };

const RETRY_INDEX_KEY = "zz_smartid_retry_index";
const RETRY_INDEX_MAX = 40;

export function parseEcsddSmartIdRetryIndex(raw: unknown): EcsddSmartIdRetryEntry[] {
  const list = raw && typeof raw === "object" && Array.isArray((raw as { refs?: unknown }).refs) ? (raw as { refs: unknown[] }).refs : [];
  const out: EcsddSmartIdRetryEntry[] = [];
  for (const e of list) {
    if (!e || typeof e !== "object") continue;
    const o = e as Record<string, unknown>;
    const ref = str(o.ref, 200);
    if (!ref || !isSafeOrderDraftSessionId(ref) || ref === RETRY_INDEX_KEY) continue;
    out.push({ ref, query: str(o.query, 20) ?? "", at: str(o.at, 40) ?? new Date(0).toISOString() });
  }
  return out.slice(-RETRY_INDEX_MAX);
}

export async function readEcsddSmartIdRetryIndex(): Promise<EcsddSmartIdRetryEntry[]> {
  return parseEcsddSmartIdRetryIndex(await readJson(RETRY_INDEX_KEY));
}

export async function writeEcsddSmartIdRetryIndex(refs: EcsddSmartIdRetryEntry[]): Promise<{ ok: true } | { ok: false; error: string }> {
  return writeJson(RETRY_INDEX_KEY, { refs: refs.slice(-RETRY_INDEX_MAX) });
}
