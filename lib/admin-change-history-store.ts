/**
 * Append-only izmaiņu žurnāls. Operators: `admin-change-history/operator/...`.
 * B2B tenants: `b2b-demo/tenants/{tenantId}/change-history/...` (#186).
 * Nelasa Dropbox, Stripe, izsoles vai maksas VIN avotus.
 */
import "server-only";

import { get, put } from "@vercel/blob";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { randomBytes } from "node:crypto";
import {
  ADMIN_CHANGE_OPERATOR_TENANT,
  appendAdminChangeHistory,
  assertAdminChangeTenant,
  isAdminChangeHistoryKind,
  isSafeAdminChangeEntryId,
  isSafeAdminChangeRecordId,
  toAdminChangeHistoryView,
  visibleAdminChangeHistory,
  type AdminChangeHistoryAction,
  type AdminChangeHistoryEntry,
  type AdminChangeHistoryKind,
  type AdminChangeHistoryLog,
  type AdminChangeHistoryView,
  type AdminChangeScope,
} from "@/lib/admin-change-history";

const OPERATOR_PREFIX = "admin-change-history/";

type ResolvedStorage = { kind: "fs"; dir: string } | { kind: "blob"; token: string };

function blobToken(): string {
  return process.env.BLOB_READ_WRITE_TOKEN?.trim() ?? "";
}

function resolveStorage(): ResolvedStorage {
  if (process.env.VITEST) {
    return { kind: "fs", dir: path.join(os.tmpdir(), "provin-admin-change-history-test") };
  }
  const token = blobToken();
  if (token) return { kind: "blob", token };
  const dir = process.env.VERCEL
    ? path.join(os.tmpdir(), "provin-admin-change-history")
    : path.join(process.cwd(), ".data", "admin-change-history");
  return { kind: "fs", dir };
}

export function newAdminChangeHistoryId(now = Date.now()): string {
  return `h_${now.toString(36)}${randomBytes(3).toString("hex")}`.slice(0, 26);
}

function historyKey(tenantId: string, kind: AdminChangeHistoryKind, recordId: string): string {
  if (tenantId === ADMIN_CHANGE_OPERATOR_TENANT) {
    return `${OPERATOR_PREFIX}${tenantId}/${kind}/${recordId}.json`;
  }
  return `b2b-demo/tenants/${tenantId}/change-history/${kind}/${recordId}.json`;
}

function emptyLog(kind: AdminChangeHistoryKind, recordId: string, tenantId: string): AdminChangeHistoryLog {
  return { version: 1, kind, recordId, tenantId, entries: [] };
}

function parseLog(raw: string, kind: AdminChangeHistoryKind, recordId: string, tenantId: string): AdminChangeHistoryLog {
  try {
    const data = JSON.parse(raw) as Partial<AdminChangeHistoryLog>;
    if (!data || data.version !== 1 || data.kind !== kind || data.recordId !== recordId || data.tenantId !== tenantId) {
      return emptyLog(kind, recordId, tenantId);
    }
    const entries: AdminChangeHistoryEntry[] = [];
    for (const row of Array.isArray(data.entries) ? data.entries : []) {
      if (!row || typeof row !== "object") continue;
      const item = row as AdminChangeHistoryEntry;
      if (!isSafeAdminChangeEntryId(item.id) || item.kind !== kind || item.recordId !== recordId || item.tenantId !== tenantId) continue;
      if (item.action !== "save" && item.action !== "restore") continue;
      if (!item.snapshot || typeof item.snapshot !== "object" || !Array.isArray(item.fields)) continue;
      entries.push(item);
    }
    return { version: 1, kind, recordId, tenantId, entries };
  } catch {
    return emptyLog(kind, recordId, tenantId);
  }
}

async function readLog(kind: AdminChangeHistoryKind, recordId: string, tenantId: string): Promise<AdminChangeHistoryLog> {
  const key = historyKey(tenantId, kind, recordId);
  const storage = resolveStorage();
  if (storage.kind === "blob") {
    try {
      const res = await get(key, { access: "private", token: storage.token, useCache: false });
      if (res && res.statusCode === 200 && res.stream) {
        return parseLog(await new Response(res.stream).text(), kind, recordId, tenantId);
      }
    } catch {
      return emptyLog(kind, recordId, tenantId);
    }
    return emptyLog(kind, recordId, tenantId);
  }
  try {
    return parseLog(await fs.readFile(path.join(storage.dir, key), "utf8"), kind, recordId, tenantId);
  } catch {
    return emptyLog(kind, recordId, tenantId);
  }
}

async function writeLog(log: AdminChangeHistoryLog): Promise<void> {
  const key = historyKey(log.tenantId, log.kind, log.recordId);
  const body = JSON.stringify(log);
  const storage = resolveStorage();
  if (storage.kind === "blob") {
    await put(key, body, {
      access: "private",
      token: storage.token,
      contentType: "application/json; charset=utf-8",
      addRandomSuffix: false,
      allowOverwrite: true,
    });
    return;
  }
  const file = path.join(storage.dir, key);
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  await fs.writeFile(tmp, body, "utf8");
  await fs.rename(tmp, file);
}

function scopeTenant(scope: AdminChangeScope): string | null {
  if (scope.kind === "operator") return ADMIN_CHANGE_OPERATOR_TENANT;
  try {
    assertAdminChangeTenant(scope.tenantId, scope);
    return scope.tenantId;
  } catch {
    return null;
  }
}

export async function recordAdminChangeHistory(input: {
  kind: AdminChangeHistoryKind;
  recordId: string;
  tenantId: string;
  before: Record<string, string>;
  after: Record<string, string>;
  by?: string;
  action?: AdminChangeHistoryAction;
  at?: string;
}): Promise<void> {
  if (!isAdminChangeHistoryKind(input.kind) || !isSafeAdminChangeRecordId(input.kind, input.recordId)) return;
  if (input.tenantId !== ADMIN_CHANGE_OPERATOR_TENANT) {
    try {
      assertAdminChangeTenant(input.tenantId, { kind: "tenant", tenantId: input.tenantId });
    } catch {
      return;
    }
  }
  const current = await readLog(input.kind, input.recordId, input.tenantId);
  const next = appendAdminChangeHistory(current.entries.length ? current : null, {
    id: newAdminChangeHistoryId(),
    kind: input.kind,
    recordId: input.recordId,
    tenantId: input.tenantId,
    at: input.at ?? new Date().toISOString(),
    by: input.by,
    action: input.action ?? "save",
    before: input.before,
    after: input.after,
  });
  if (!next || next.entries.length === current.entries.length) return;
  await writeLog(next);
}

export async function listAdminChangeHistory(
  kind: AdminChangeHistoryKind,
  recordId: string,
  scope: AdminChangeScope,
): Promise<AdminChangeHistoryView[]> {
  const tenantId = scopeTenant(scope);
  if (!tenantId || !isSafeAdminChangeRecordId(kind, recordId)) return [];
  const log = await readLog(kind, recordId, tenantId);
  return toAdminChangeHistoryView(visibleAdminChangeHistory(log.entries, scope));
}

export async function loadAdminChangeSnapshot(
  kind: AdminChangeHistoryKind,
  recordId: string,
  entryId: string,
  scope: AdminChangeScope,
): Promise<Record<string, string> | null> {
  const tenantId = scopeTenant(scope);
  if (!tenantId || !isSafeAdminChangeRecordId(kind, recordId) || !isSafeAdminChangeEntryId(entryId)) return null;
  const log = await readLog(kind, recordId, tenantId);
  const entry = visibleAdminChangeHistory(log.entries, scope).find((row) => row.id === entryId);
  if (!entry) return null;
  return { ...entry.snapshot };
}
