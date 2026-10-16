import "server-only";

import fs from "fs/promises";
import path from "path";
import { get, put } from "@vercel/blob";
import { getOrderDraftBlobConfig, getOrderDraftStorageDir } from "@/lib/admin-order-draft-store";
import type {
  KnowledgeItem,
  KnowledgeItemStatus,
  KnowledgeUsageSnapshot,
} from "@/lib/admin-audit-knowledge-items-types";
import {
  applyKnowledgeReview,
  emptyKnowledgeItemsDoc,
  listKnowledgeItems,
  normalizeKnowledgeItemsDoc,
  summarizeKnowledgeByAggregate,
  upsertCandidateItem,
  type KnowledgeItemsDoc,
} from "@/lib/admin-audit-knowledge-items-logic";

export type { KnowledgeItemsDoc };

const FILENAME = "provin_audit_knowledge_items.json";

function indexFilePath(dir: string): string {
  return path.join(dir, FILENAME);
}

async function readFromFs(dir: string): Promise<KnowledgeItemsDoc | null> {
  try {
    return normalizeKnowledgeItemsDoc(JSON.parse(await fs.readFile(indexFilePath(dir), "utf8")) as unknown);
  } catch {
    return null;
  }
}

async function readFromBlob(blob: { token: string; prefix: string }): Promise<KnowledgeItemsDoc | null> {
  try {
    const res = await get(`${blob.prefix}${FILENAME}`, {
      access: "private",
      token: blob.token,
      useCache: false,
    });
    if (!res || res.statusCode !== 200 || !res.stream) return null;
    return normalizeKnowledgeItemsDoc(JSON.parse(await new Response(res.stream).text()) as unknown);
  } catch {
    return null;
  }
}

function pickNewer(a: KnowledgeItemsDoc | null, b: KnowledgeItemsDoc | null): KnowledgeItemsDoc | null {
  if (!a) return b;
  if (!b) return a;
  return Date.parse(b.updatedAt) >= Date.parse(a.updatedAt) ? b : a;
}

async function readDoc(): Promise<KnowledgeItemsDoc> {
  const dir = getOrderDraftStorageDir();
  const blob = getOrderDraftBlobConfig();
  const fromFs = dir ? await readFromFs(dir) : null;
  const fromBlob = blob ? await readFromBlob(blob) : null;
  return pickNewer(fromFs, fromBlob) ?? emptyKnowledgeItemsDoc();
}

async function writeDoc(doc: KnowledgeItemsDoc): Promise<{ ok: true } | { ok: false; error: string }> {
  const dir = getOrderDraftStorageDir();
  const blob = getOrderDraftBlobConfig();
  if (!dir && !blob) return { ok: false, error: "store_disabled" };
  if (process.env.VERCEL === "1" && !blob) return { ok: false, error: "store_not_durable" };

  const body = JSON.stringify(doc);
  let fsOk = false;
  let blobOk = false;

  if (dir) {
    try {
      await fs.mkdir(dir, { recursive: true });
      const fp = indexFilePath(dir);
      const tmp = `${fp}.tmp`;
      await fs.writeFile(tmp, body, "utf8");
      await fs.rename(tmp, fp);
      fsOk = true;
    } catch {
      fsOk = false;
    }
  }

  if (blob) {
    try {
      await put(`${blob.prefix}${FILENAME}`, body, {
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

  if (!fsOk && !blobOk) return { ok: false, error: "write_failed" };
  if (process.env.VERCEL === "1" && !blobOk) return { ok: false, error: "store_not_durable" };
  return { ok: true };
}

let cache: { at: number; doc: KnowledgeItemsDoc } | null = null;
const CACHE_MS = 30_000;

async function readCached(): Promise<KnowledgeItemsDoc> {
  const now = Date.now();
  if (cache && now - cache.at < CACHE_MS) return cache.doc;
  const doc = await readDoc();
  cache = { at: now, doc };
  return doc;
}

export function invalidateKnowledgeItemsCache(): void {
  cache = null;
}

export async function readKnowledgeItemsDoc(): Promise<KnowledgeItemsDoc> {
  return readCached();
}

export async function saveCandidateKnowledgeItems(items: KnowledgeItem[]): Promise<KnowledgeItem[]> {
  if (items.length === 0) return [];
  const doc = await readDoc();
  const saved: KnowledgeItem[] = [];
  for (const item of items) saved.push(upsertCandidateItem(doc, item));
  await writeDoc(doc);
  invalidateKnowledgeItemsCache();
  return saved;
}

export async function reviewKnowledgeItem(
  id: string,
  action: "approve" | "reject" | "delete" | "restore",
  opts: { by?: string; reason?: string; claim?: string },
): Promise<KnowledgeItem | null> {
  const doc = await readDoc();
  const item = doc.items[id];
  if (!item) return null;
  const next = applyKnowledgeReview(item, action, opts);
  doc.items[id] = next;
  doc.updatedAt = next.updatedAt;
  await writeDoc(doc);
  invalidateKnowledgeItemsCache();
  return next;
}

export async function editKnowledgeItem(
  id: string,
  claim: string,
  opts: { by?: string },
): Promise<KnowledgeItem | null> {
  const doc = await readDoc();
  const item = doc.items[id];
  if (!item) return null;
  const now = new Date().toISOString();
  const next: KnowledgeItem = {
    ...item,
    claim: claim.trim().slice(0, 500),
    updatedAt: now,
    reviewedBy: opts.by,
    reviewedAt: now,
    history: [
      ...item.history,
      { at: now, action: "edit" as const, by: opts.by, claim: claim.trim() },
    ].slice(-40),
  };
  doc.items[id] = next;
  doc.updatedAt = now;
  await writeDoc(doc);
  invalidateKnowledgeItemsCache();
  return next;
}

export async function listKnowledgeItemsFromStore(
  status?: KnowledgeItemStatus | "all",
  aggregate?: string,
): Promise<KnowledgeItem[]> {
  return listKnowledgeItems(await readCached(), status, aggregate);
}

export async function summarizeKnowledgeStore() {
  const doc = await readCached();
  const rows = summarizeKnowledgeByAggregate(doc);
  return {
    updatedAt: doc.updatedAt,
    itemCount: Object.keys(doc.items).length,
    aggregates: rows,
  };
}

export async function recordKnowledgeUsage(snapshot: KnowledgeUsageSnapshot): Promise<void> {
  const doc = await readDoc();
  doc.usageBySession[snapshot.sessionId] = snapshot;
  const ids = [...snapshot.approved, ...snapshot.rejected].map((x) => x.id);
  const now = snapshot.at;
  for (const id of ids) {
    const item = doc.items[id];
    if (item) doc.items[id] = { ...item, lastUsedAt: now };
  }
  doc.updatedAt = now;
  await writeDoc(doc);
  invalidateKnowledgeItemsCache();
}

export async function getKnowledgeUsage(sessionId: string): Promise<KnowledgeUsageSnapshot | null> {
  const doc = await readCached();
  return doc.usageBySession[sessionId] ?? null;
}

export async function markKnowledgeLastUsed(ids: string[], at = new Date().toISOString()): Promise<void> {
  if (ids.length === 0) return;
  const doc = await readDoc();
  let changed = false;
  for (const id of ids) {
    const item = doc.items[id];
    if (!item) continue;
    doc.items[id] = { ...item, lastUsedAt: at };
    changed = true;
  }
  if (!changed) return;
  doc.updatedAt = at;
  await writeDoc(doc);
  invalidateKnowledgeItemsCache();
}
