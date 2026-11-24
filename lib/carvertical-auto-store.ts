import "server-only";

import fs from "fs/promises";
import path from "path";
import { get, put } from "@vercel/blob";

import {
  getOrderDraftBlobConfig,
  getOrderDraftStorageDir,
  isSafeOrderDraftSessionId,
} from "@/lib/admin-order-draft-store";
import {
  CARVERTICAL_AUTO_ACTIVE_STATES,
  type CarverticalAutoState,
  type CarverticalAutoStatus,
  type CarverticalBalance,
} from "@/lib/carvertical-auto-types";

/**
 * CarVertical fona pirkuma krātuve (tā pati, kur pasūtījumu melnraksti):
 *   carvertical_auto/{sessionId}.json  - stāvoklis pasūtījumam
 *   carvertical_auto/{sessionId}.pdf   - saņemtā atskaite (privāts Blob; avots "Ievietot" pogai)
 *   carvertical_auto/_balance.json     - kredītu atlikuma kešs (+ pēdējā zemā atlikuma push diena)
 */

const SUBDIR = "carvertical_auto";
const STATES: readonly CarverticalAutoState[] = ["not_configured", ...CARVERTICAL_AUTO_ACTIVE_STATES, "ready", "error"];

function str(v: unknown, max = 400): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined;
}

export function parseCarverticalAutoStatus(raw: unknown): CarverticalAutoStatus | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const state = STATES.find((s) => s === o.state);
  if (!state) return null;
  const pdfRaw = o.pdf && typeof o.pdf === "object" ? (o.pdf as Record<string, unknown>) : null;
  const pdf =
    pdfRaw && str(pdfRaw.name) && (str(pdfRaw.dropboxPath) || str(pdfRaw.blobPath))
      ? {
          ...(str(pdfRaw.dropboxPath, 600) ? { dropboxPath: str(pdfRaw.dropboxPath, 600) } : {}),
          ...(str(pdfRaw.blobPath, 300) ? { blobPath: str(pdfRaw.blobPath, 300) } : {}),
          name: str(pdfRaw.name, 200)!,
          size: typeof pdfRaw.size === "number" && Number.isFinite(pdfRaw.size) ? pdfRaw.size : 0,
          savedAt: str(pdfRaw.savedAt, 40) ?? "",
        }
      : undefined;
  return {
    state,
    updatedAt: str(o.updatedAt, 40) ?? new Date(0).toISOString(),
    ...(str(o.vin, 17) ? { vin: str(o.vin, 17) } : {}),
    ...(str(o.jobId, 80) ? { jobId: str(o.jobId, 80) } : {}),
    ...(str(o.requestId, 80) ? { requestId: str(o.requestId, 80) } : {}),
    ...(o.kind === "purchase" || o.kind === "report" ? { kind: o.kind } : {}),
    ...(typeof o.existing === "boolean" ? { existing: o.existing } : {}),
    ...(str(o.reportId, 80) ? { reportId: str(o.reportId, 80) } : {}),
    ...(str(o.message) ? { message: str(o.message) } : {}),
    ...(str(o.code, 60) ? { code: str(o.code, 60) } : {}),
    ...(str(o.requestedAt, 40) ? { requestedAt: str(o.requestedAt, 40) } : {}),
    ...(str(o.readyAt, 40) ? { readyAt: str(o.readyAt, 40) } : {}),
    ...(pdf ? { pdf } : {}),
    ...(str(o.appliedAt, 40) ? { appliedAt: str(o.appliedAt, 40) } : {}),
  };
}

export function parseCarverticalBalance(raw: unknown): CarverticalBalance | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const credits = typeof o.credits === "number" && Number.isFinite(o.credits) ? Math.max(0, Math.floor(o.credits)) : null;
  const checkedAt = str(o.checkedAt, 40) ?? "";
  if (credits == null && !checkedAt) return null;
  return { credits, checkedAt, ...(str(o.lowPushDay, 10) ? { lowPushDay: str(o.lowPushDay, 10) } : {}) };
}

async function readRaw(rel: string): Promise<Uint8Array | null> {
  const blob = getOrderDraftBlobConfig();
  if (blob) {
    try {
      const res = await get(`${blob.prefix}${rel}`, { access: "private", token: blob.token, useCache: false });
      if (res?.statusCode === 200 && res.stream) return new Uint8Array(await new Response(res.stream).arrayBuffer());
    } catch {
      /* nav faila */
    }
  }
  const dir = getOrderDraftStorageDir();
  if (dir && process.env.VERCEL !== "1") {
    try {
      return new Uint8Array(await fs.readFile(path.join(dir, rel)));
    } catch {
      /* nav faila */
    }
  }
  return null;
}

async function writeRaw(rel: string, body: string | Uint8Array, contentType: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const dir = getOrderDraftStorageDir();
  const blob = getOrderDraftBlobConfig();
  if (!dir && !blob) return { ok: false, error: "store_disabled" };
  if (process.env.VERCEL === "1" && !blob) return { ok: false, error: "store_not_durable" };
  if (blob) {
    try {
      await put(`${blob.prefix}${rel}`, typeof body === "string" ? body : Buffer.from(body), {
        access: "private",
        token: blob.token,
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType,
      });
      return { ok: true };
    } catch {
      if (process.env.VERCEL === "1") return { ok: false, error: "write_failed" };
    }
  }
  if (dir) {
    try {
      const fp = path.join(dir, rel);
      await fs.mkdir(path.dirname(fp), { recursive: true });
      await fs.writeFile(`${fp}.tmp`, body);
      await fs.rename(`${fp}.tmp`, fp);
      return { ok: true };
    } catch {
      return { ok: false, error: "write_failed" };
    }
  }
  return { ok: false, error: "write_failed" };
}

function parseJsonBytes(bytes: Uint8Array | null): unknown {
  if (!bytes) return null;
  try {
    return JSON.parse(Buffer.from(bytes).toString("utf8"));
  } catch {
    return null;
  }
}

export async function readCarverticalAutoStatus(sessionId: string): Promise<CarverticalAutoStatus | null> {
  if (!isSafeOrderDraftSessionId(sessionId)) return null;
  return parseCarverticalAutoStatus(parseJsonBytes(await readRaw(`${SUBDIR}/${sessionId}.json`)));
}

export async function writeCarverticalAutoStatus(sessionId: string, status: CarverticalAutoStatus) {
  if (!isSafeOrderDraftSessionId(sessionId)) return { ok: false as const, error: "invalid_session" };
  return writeRaw(`${SUBDIR}/${sessionId}.json`, JSON.stringify(status), "application/json");
}

export function carverticalPdfBlobPath(sessionId: string): string {
  return `${SUBDIR}/${sessionId}.pdf`;
}

export async function writeCarverticalPdf(sessionId: string, bytes: Uint8Array) {
  if (!isSafeOrderDraftSessionId(sessionId)) return { ok: false as const, error: "invalid_session" };
  return writeRaw(carverticalPdfBlobPath(sessionId), bytes, "application/pdf");
}

export async function readCarverticalPdf(sessionId: string): Promise<Uint8Array | null> {
  if (!isSafeOrderDraftSessionId(sessionId)) return null;
  return readRaw(carverticalPdfBlobPath(sessionId));
}

export async function readCarverticalBalance(): Promise<CarverticalBalance | null> {
  return parseCarverticalBalance(parseJsonBytes(await readRaw(`${SUBDIR}/_balance.json`)));
}

export async function writeCarverticalBalance(b: CarverticalBalance) {
  return writeRaw(`${SUBDIR}/_balance.json`, JSON.stringify(b), "application/json");
}

/** Tā pati krātuve (Blob / lokāla mape) citiem fona piegādātājiem (AutoDNA). */
export { readRaw as readVendorAutoRaw, writeRaw as writeVendorAutoRaw };
