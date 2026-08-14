import "server-only";

import fs from "fs/promises";
import path from "path";
import { get, put } from "@vercel/blob";
import { getOrderDraftBlobConfig, getOrderDraftStorageDir } from "@/lib/admin-order-draft-store";
import type { AuditAggregateLearningEntry } from "@/lib/admin-audit-learnings-types";

export type { AuditAggregateLearningEntry };

/**
 * Anonimizēti agregātu mācījumi no pabeigtām PROVIN atskaitēm — papildina statisko case-rule bāzi.
 * Failu raksta tikai serveris pēc workspace saglabāšanas.
 */

const LEARNINGS_FILENAME = "provin_audit_aggregate_learnings.json";
const MAX_SNIPPETS_PER_KEY = 12;
const SNIPPET_MAX_LEN = 420;

type LearningsDoc = {
  version: 1;
  updatedAt: string;
  entries: Record<string, AuditAggregateLearningEntry>;
};

function indexFilePath(dir: string): string {
  return path.join(dir, LEARNINGS_FILENAME);
}

function normalizeDoc(raw: unknown): LearningsDoc | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (!o.entries || typeof o.entries !== "object") return null;
  const entries: Record<string, AuditAggregateLearningEntry> = {};
  for (const [key, val] of Object.entries(o.entries as Record<string, unknown>)) {
    if (!val || typeof val !== "object") continue;
    const e = val as Record<string, unknown>;
    const snippets: string[] = [];
    if (Array.isArray(e.snippets)) {
      for (const s of e.snippets) {
        if (typeof s === "string" && s.trim()) snippets.push(s.trim().slice(0, SNIPPET_MAX_LEN));
      }
    }
    if (snippets.length === 0) continue;
    entries[key] = {
      key,
      label: typeof e.label === "string" ? e.label.slice(0, 120) : key,
      updatedAt: typeof e.updatedAt === "string" ? e.updatedAt : new Date(0).toISOString(),
      snippets: snippets.slice(0, MAX_SNIPPETS_PER_KEY),
    };
  }
  return {
    version: 1,
    updatedAt: typeof o.updatedAt === "string" ? o.updatedAt : new Date(0).toISOString(),
    entries,
  };
}

async function readFromFs(dir: string): Promise<LearningsDoc | null> {
  try {
    return normalizeDoc(JSON.parse(await fs.readFile(indexFilePath(dir), "utf8")) as unknown);
  } catch {
    return null;
  }
}

async function readFromBlob(blob: { token: string; prefix: string }): Promise<LearningsDoc | null> {
  try {
    const res = await get(`${blob.prefix}${LEARNINGS_FILENAME}`, {
      access: "private",
      token: blob.token,
      useCache: false,
    });
    if (!res || res.statusCode !== 200 || !res.stream) return null;
    return normalizeDoc(JSON.parse(await new Response(res.stream).text()) as unknown);
  } catch {
    return null;
  }
}

function pickNewer(a: LearningsDoc | null, b: LearningsDoc | null): LearningsDoc | null {
  if (!a) return b;
  if (!b) return a;
  return Date.parse(b.updatedAt) >= Date.parse(a.updatedAt) ? b : a;
}

async function readLearningsDoc(): Promise<LearningsDoc> {
  const dir = getOrderDraftStorageDir();
  const blob = getOrderDraftBlobConfig();
  const fromFs = dir ? await readFromFs(dir) : null;
  const fromBlob = blob ? await readFromBlob(blob) : null;
  return (
    pickNewer(fromFs, fromBlob) ?? {
      version: 1,
      updatedAt: new Date(0).toISOString(),
      entries: {},
    }
  );
}

async function writeLearningsDoc(doc: LearningsDoc): Promise<{ ok: true } | { ok: false; error: string }> {
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
      await put(`${blob.prefix}${LEARNINGS_FILENAME}`, body, {
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

let cache: { at: number; doc: LearningsDoc } | null = null;
const CACHE_MS = 120_000;

async function readLearningsCached(): Promise<LearningsDoc> {
  const now = Date.now();
  if (cache && now - cache.at < CACHE_MS) return cache.doc;
  const doc = await readLearningsDoc();
  cache = { at: now, doc };
  return doc;
}

export function invalidateAuditLearningsCache(): void {
  cache = null;
}

export async function upsertAuditAggregateLearning(entry: AuditAggregateLearningEntry): Promise<void> {
  if (!entry.key || entry.snippets.length === 0) return;
  const doc = await readLearningsDoc();
  const prev = doc.entries[entry.key];
  const merged = new Set<string>(prev?.snippets ?? []);
  for (const s of entry.snippets) merged.add(s);
  const snippets = [...merged].slice(-MAX_SNIPPETS_PER_KEY);
  doc.entries[entry.key] = {
    key: entry.key,
    label: entry.label || prev?.label || entry.key,
    updatedAt: new Date().toISOString(),
    snippets,
  };
  doc.updatedAt = new Date().toISOString();
  await writeLearningsDoc(doc);
  invalidateAuditLearningsCache();
}

export async function getAuditLearningsForKeys(keys: string[]): Promise<AuditAggregateLearningEntry[]> {
  const doc = await readLearningsCached();
  const out: AuditAggregateLearningEntry[] = [];
  for (const key of keys) {
    const e = doc.entries[key];
    if (e) out.push(e);
  }
  return out;
}

export async function listAllAuditLearningKeys(): Promise<string[]> {
  const doc = await readLearningsCached();
  return Object.keys(doc.entries);
}

export async function readAllAuditLearningEntries(): Promise<AuditAggregateLearningEntry[]> {
  const doc = await readLearningsCached();
  return Object.values(doc.entries).sort((a, b) => b.snippets.length - a.snippets.length);
}
