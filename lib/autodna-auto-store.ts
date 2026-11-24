import "server-only";

import { isSafeOrderDraftSessionId } from "@/lib/admin-order-draft-store";
import {
  AUTODNA_AUTO_ACTIVE_STATES,
  type AutodnaAutoState,
  type AutodnaAutoStatus,
  type AutodnaBalance,
} from "@/lib/autodna-auto-types";
import { parseCarverticalBalance, readVendorAutoRaw, writeVendorAutoRaw } from "@/lib/carvertical-auto-store";

/**
 * AutoDNA fona pirkuma krātuve (tā pati, kur pasūtījumu melnraksti un CarVertical fona pirkums):
 *   autodna_auto/{sessionId}.json  - stāvoklis pasūtījumam
 *   autodna_auto/{sessionId}.pdf   - saņemtā atskaite (privāts Blob; avots "Ievietot" pogai)
 *   autodna_auto/_balance.json     - kredītu atlikuma kešs (+ pēdējā zemā atlikuma push diena)
 */

const SUBDIR = "autodna_auto";
const STATES: readonly AutodnaAutoState[] = ["not_configured", ...AUTODNA_AUTO_ACTIVE_STATES, "ready", "error"];

function str(v: unknown, max = 400): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined;
}

export function parseAutodnaAutoStatus(raw: unknown): AutodnaAutoStatus | null {
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
    ...(str(o.message) ? { message: str(o.message) } : {}),
    ...(str(o.code, 60) ? { code: str(o.code, 60) } : {}),
    ...(str(o.requestedAt, 40) ? { requestedAt: str(o.requestedAt, 40) } : {}),
    ...(str(o.readyAt, 40) ? { readyAt: str(o.readyAt, 40) } : {}),
    ...(pdf ? { pdf } : {}),
    ...(str(o.appliedAt, 40) ? { appliedAt: str(o.appliedAt, 40) } : {}),
  };
}

function parseJsonBytes(bytes: Uint8Array | null): unknown {
  if (!bytes) return null;
  try {
    return JSON.parse(Buffer.from(bytes).toString("utf8"));
  } catch {
    return null;
  }
}

export async function readAutodnaAutoStatus(sessionId: string): Promise<AutodnaAutoStatus | null> {
  if (!isSafeOrderDraftSessionId(sessionId)) return null;
  return parseAutodnaAutoStatus(parseJsonBytes(await readVendorAutoRaw(`${SUBDIR}/${sessionId}.json`)));
}

export async function writeAutodnaAutoStatus(sessionId: string, status: AutodnaAutoStatus) {
  if (!isSafeOrderDraftSessionId(sessionId)) return { ok: false as const, error: "invalid_session" };
  return writeVendorAutoRaw(`${SUBDIR}/${sessionId}.json`, JSON.stringify(status), "application/json");
}

export function autodnaPdfBlobPath(sessionId: string): string {
  return `${SUBDIR}/${sessionId}.pdf`;
}

export async function writeAutodnaPdf(sessionId: string, bytes: Uint8Array) {
  if (!isSafeOrderDraftSessionId(sessionId)) return { ok: false as const, error: "invalid_session" };
  return writeVendorAutoRaw(autodnaPdfBlobPath(sessionId), bytes, "application/pdf");
}

export async function readAutodnaPdf(sessionId: string): Promise<Uint8Array | null> {
  if (!isSafeOrderDraftSessionId(sessionId)) return null;
  return readVendorAutoRaw(autodnaPdfBlobPath(sessionId));
}

export async function readAutodnaBalance(): Promise<AutodnaBalance | null> {
  return parseCarverticalBalance(parseJsonBytes(await readVendorAutoRaw(`${SUBDIR}/_balance.json`)));
}

export async function writeAutodnaBalance(b: AutodnaBalance) {
  return writeVendorAutoRaw(`${SUBDIR}/_balance.json`, JSON.stringify(b), "application/json");
}
