import "server-only";

import fs from "fs/promises";
import path from "path";
import { get, put } from "@vercel/blob";
import { getOrderDraftBlobConfig, getOrderDraftStorageDir } from "@/lib/admin-order-draft-store";
import {
  UNPAID_REMINDER_STORE_TTL_MS,
  unpaidGroupKey,
  type UnpaidReminderState,
} from "@/lib/admin-unpaid-orders-core";

const REL = "unpaid_reminders/v1.json";

export type UnpaidReminderRecord = UnpaidReminderState & {
  createdAt: string;
  remindedBy?: string | null;
  newSessionId?: string | null;
  paymentTokenHash?: string | null;
  expiresAt?: string | null;
};

type UnpaidReminderDoc = {
  version: 1;
  updatedAt: string;
  records: UnpaidReminderRecord[];
};

function emptyDoc(): UnpaidReminderDoc {
  return { version: 1, updatedAt: new Date(0).toISOString(), records: [] };
}

function parseDoc(raw: unknown): UnpaidReminderDoc {
  if (!raw || typeof raw !== "object") return emptyDoc();
  const o = raw as Record<string, unknown>;
  const recordsIn = Array.isArray(o.records) ? o.records : [];
  const records: UnpaidReminderRecord[] = [];
  for (const item of recordsIn) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const sessionId = typeof r.sessionId === "string" ? r.sessionId.trim() : "";
    if (!sessionId) continue;
    const email = typeof r.email === "string" ? r.email : "";
    const vin = typeof r.vin === "string" ? r.vin : "";
    const createdAt = typeof r.createdAt === "string" ? r.createdAt : new Date(0).toISOString();
    const aliasSessionIds = Array.isArray(r.aliasSessionIds)
      ? r.aliasSessionIds.filter((x): x is string => typeof x === "string" && x.trim().length > 0)
      : [];
    records.push({
      sessionId,
      aliasSessionIds,
      email,
      vin,
      createdAt,
      remindedAt: typeof r.remindedAt === "string" ? r.remindedAt : null,
      remindedBy: typeof r.remindedBy === "string" ? r.remindedBy : null,
      newSessionId: typeof r.newSessionId === "string" ? r.newSessionId : null,
      paymentTokenHash: typeof r.paymentTokenHash === "string" ? r.paymentTokenHash : null,
      paymentPublicUrl: typeof r.paymentPublicUrl === "string" ? r.paymentPublicUrl : null,
      expiresAt: typeof r.expiresAt === "string" ? r.expiresAt : null,
      hidden: r.hidden === true,
    });
  }
  return {
    version: 1,
    updatedAt: typeof o.updatedAt === "string" ? o.updatedAt : new Date(0).toISOString(),
    records,
  };
}

function prune(doc: UnpaidReminderDoc, nowMs: number): UnpaidReminderDoc {
  const records = doc.records.filter((r) => {
    const ts = Date.parse(r.remindedAt || r.createdAt);
    if (!Number.isFinite(ts)) return false;
    return nowMs - ts <= UNPAID_REMINDER_STORE_TTL_MS;
  });
  return { ...doc, records };
}

async function readDoc(): Promise<UnpaidReminderDoc> {
  const blob = getOrderDraftBlobConfig();
  const dir = getOrderDraftStorageDir();
  try {
    if (blob) {
      const res = await get(`${blob.prefix}${REL}`, { access: "private", token: blob.token, useCache: false });
      if (res?.statusCode === 200 && res.stream) {
        return prune(parseDoc(JSON.parse(await new Response(res.stream).text())), Date.now());
      }
    } else if (dir && process.env.VERCEL !== "1") {
      return prune(parseDoc(JSON.parse(await fs.readFile(path.join(dir, REL), "utf8"))), Date.now());
    }
  } catch {
    /* nav datu */
  }
  return emptyDoc();
}

async function writeDoc(doc: UnpaidReminderDoc): Promise<void> {
  const body = JSON.stringify({ ...doc, updatedAt: new Date().toISOString() });
  const blob = getOrderDraftBlobConfig();
  const dir = getOrderDraftStorageDir();
  if (blob) {
    await put(`${blob.prefix}${REL}`, body, {
      access: "private",
      token: blob.token,
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
    });
    return;
  }
  if (dir && process.env.VERCEL !== "1") {
    const fp = path.join(dir, REL);
    await fs.mkdir(path.dirname(fp), { recursive: true });
    await fs.writeFile(fp, body, "utf8");
  }
}

const writeLock: { p: Promise<unknown> } = { p: Promise.resolve() };

function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const next = writeLock.p.catch(() => undefined).then(fn);
  writeLock.p = next;
  return next;
}

export async function listUnpaidReminderRecords(): Promise<UnpaidReminderRecord[]> {
  return (await readDoc()).records;
}

export function findUnpaidReminderRecord(
  records: readonly UnpaidReminderRecord[],
  opts: { sessionId?: string; email?: string; vin?: string; tokenHash?: string },
): UnpaidReminderRecord | null {
  if (opts.tokenHash) {
    const hit = records.find((r) => r.paymentTokenHash === opts.tokenHash);
    if (hit) return hit;
  }
  if (opts.sessionId) {
    const hit = records.find(
      (r) => r.sessionId === opts.sessionId || (r.aliasSessionIds ?? []).includes(opts.sessionId!),
    );
    if (hit) return hit;
  }
  if (opts.email || opts.vin) {
    const key = unpaidGroupKey({ sessionId: opts.sessionId, email: opts.email, vin: opts.vin });
    if (!key.startsWith("id:")) {
      const hit = records.find((r) => unpaidGroupKey(r) === key);
      if (hit) return hit;
    }
  }
  return null;
}

export async function upsertUnpaidReminderRecord(
  patch: UnpaidReminderRecord,
): Promise<UnpaidReminderRecord> {
  return withLock(async () => {
    const doc = prune(await readDoc(), Date.now());
    const patchKey = unpaidGroupKey(patch);
    const idx = doc.records.findIndex((r) => {
      if (r.sessionId === patch.sessionId) return true;
      if ((r.aliasSessionIds ?? []).includes(patch.sessionId)) return true;
      if ((patch.aliasSessionIds ?? []).includes(r.sessionId)) return true;
      const rk = unpaidGroupKey(r);
      return !rk.startsWith("id:") && rk === patchKey;
    });
    if (idx >= 0) {
      const prev = doc.records[idx]!;
      const next: UnpaidReminderRecord = { ...prev, ...patch, sessionId: prev.sessionId || patch.sessionId };
      const aliases = new Set([...(prev.aliasSessionIds ?? []), ...(patch.aliasSessionIds ?? [])]);
      if (patch.sessionId && patch.sessionId !== next.sessionId) aliases.add(patch.sessionId);
      next.aliasSessionIds = [...aliases];
      doc.records[idx] = next;
      await writeDoc(doc);
      return next;
    }
    doc.records.push(patch);
    await writeDoc(doc);
    return patch;
  });
}

export async function hideUnpaidReminderGroup(args: {
  sessionId: string;
  aliasSessionIds: string[];
  email: string;
  vin: string;
}): Promise<UnpaidReminderRecord> {
  const now = new Date().toISOString();
  return upsertUnpaidReminderRecord({
    sessionId: args.sessionId,
    aliasSessionIds: args.aliasSessionIds,
    email: args.email,
    vin: args.vin,
    createdAt: now,
    hidden: true,
  });
}
