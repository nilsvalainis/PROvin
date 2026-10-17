import "server-only";

import fs from "fs/promises";
import path from "path";
import { get, put } from "@vercel/blob";
import { getOrderDraftBlobConfig, getOrderDraftStorageDir } from "@/lib/admin-order-draft-store";
import {
  mergeAiDraftMaps,
  mergeAiEditedMaps,
  parseAiDraftMeta,
  parseAiEditedMeta,
  snapshotAiEditedFromFields,
  type AiDraftFieldMeta,
  type SessionAiFieldRevisions,
  type WorkspaceAiDrafts,
  type WorkspaceAiEdited,
} from "@/lib/admin-ai-draft-fields";

const FILENAME = "provin_ai_field_revisions.json";

type RevisionsDoc = {
  version: 1;
  updatedAt: string;
  sessions: Record<string, SessionAiFieldRevisions>;
};

function emptyDoc(): RevisionsDoc {
  return { version: 1, updatedAt: new Date(0).toISOString(), sessions: {} };
}

function parseSession(sessionId: string, raw: unknown): SessionAiFieldRevisions | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const aiDrafts: WorkspaceAiDrafts = {};
  if (o.aiDrafts && typeof o.aiDrafts === "object") {
    for (const [k, v] of Object.entries(o.aiDrafts as Record<string, unknown>)) {
      const parsed = parseAiDraftMeta(v);
      if (parsed) aiDrafts[k] = parsed;
    }
  }
  const aiEdited: WorkspaceAiEdited = {};
  if (o.aiEdited && typeof o.aiEdited === "object") {
    for (const [k, v] of Object.entries(o.aiEdited as Record<string, unknown>)) {
      const parsed = parseAiEditedMeta(v);
      if (parsed) aiEdited[k] = parsed;
    }
  }
  return {
    sessionId,
    aiDrafts,
    aiEdited,
    updatedAt: typeof o.updatedAt === "string" ? o.updatedAt : new Date(0).toISOString(),
  };
}

function normalizeDoc(raw: unknown): RevisionsDoc {
  if (!raw || typeof raw !== "object") return emptyDoc();
  const o = raw as Record<string, unknown>;
  const sessions: Record<string, SessionAiFieldRevisions> = {};
  const src = o.sessions && typeof o.sessions === "object" ? (o.sessions as Record<string, unknown>) : {};
  for (const [sid, val] of Object.entries(src)) {
    const parsed = parseSession(sid, val);
    if (parsed) sessions[sid] = parsed;
  }
  return {
    version: 1,
    updatedAt: typeof o.updatedAt === "string" ? o.updatedAt : new Date(0).toISOString(),
    sessions,
  };
}

function indexFilePath(dir: string): string {
  return path.join(dir, FILENAME);
}

async function readFromFs(dir: string): Promise<RevisionsDoc | null> {
  try {
    return normalizeDoc(JSON.parse(await fs.readFile(indexFilePath(dir), "utf8")) as unknown);
  } catch {
    return null;
  }
}

async function readFromBlob(blob: { token: string; prefix: string }): Promise<RevisionsDoc | null> {
  try {
    const res = await get(`${blob.prefix}${FILENAME}`, {
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

function pickNewer(a: RevisionsDoc | null, b: RevisionsDoc | null): RevisionsDoc | null {
  if (!a) return b;
  if (!b) return a;
  return Date.parse(b.updatedAt) >= Date.parse(a.updatedAt) ? b : a;
}

async function readDoc(): Promise<RevisionsDoc> {
  const dir = getOrderDraftStorageDir();
  const blob = getOrderDraftBlobConfig();
  const fromFs = dir ? await readFromFs(dir) : null;
  const fromBlob = blob ? await readFromBlob(blob) : null;
  return pickNewer(fromFs, fromBlob) ?? emptyDoc();
}

async function writeDoc(doc: RevisionsDoc): Promise<void> {
  const dir = getOrderDraftStorageDir();
  const blob = getOrderDraftBlobConfig();
  if (!dir && !blob) return;
  if (process.env.VERCEL === "1" && !blob) return;
  const body = JSON.stringify(doc);
  if (dir) {
    try {
      await fs.mkdir(dir, { recursive: true });
      const fp = indexFilePath(dir);
      const tmp = `${fp}.tmp`;
      await fs.writeFile(tmp, body, "utf8");
      await fs.rename(tmp, fp);
    } catch {
      /* non-fatal */
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
    } catch {
      /* non-fatal */
    }
  }
}

let cache: { at: number; doc: RevisionsDoc } | null = null;

function invalidate(): void {
  cache = null;
}

async function readCached(): Promise<RevisionsDoc> {
  const now = Date.now();
  if (cache && now - cache.at < 15_000) return cache.doc;
  const doc = await readDoc();
  cache = { at: now, doc };
  return doc;
}

export async function recordAiDraftRevision(input: {
  sessionId: string;
  field: string;
  draft: AiDraftFieldMeta;
}): Promise<SessionAiFieldRevisions> {
  const doc = await readDoc();
  const prev = doc.sessions[input.sessionId];
  const now = input.draft.ts;
  const next: SessionAiFieldRevisions = {
    sessionId: input.sessionId,
    aiDrafts: mergeAiDraftMaps(prev?.aiDrafts, { [input.field]: input.draft }),
    aiEdited: prev?.aiEdited ?? {},
    updatedAt: now,
  };
  doc.sessions[input.sessionId] = next;
  doc.updatedAt = now;
  await writeDoc(doc);
  invalidate();
  return next;
}

export async function recordAiEditedSnapshot(input: {
  sessionId: string;
  fields: Record<string, string | undefined>;
}): Promise<SessionAiFieldRevisions> {
  const doc = await readDoc();
  const prev = doc.sessions[input.sessionId];
  const now = new Date().toISOString();
  const snap = snapshotAiEditedFromFields(input.fields, prev?.aiDrafts, now);
  const next: SessionAiFieldRevisions = {
    sessionId: input.sessionId,
    aiDrafts: prev?.aiDrafts ?? {},
    aiEdited: mergeAiEditedMaps(prev?.aiEdited, snap),
    updatedAt: now,
  };
  doc.sessions[input.sessionId] = next;
  doc.updatedAt = now;
  await writeDoc(doc);
  invalidate();
  return next;
}

export async function getAiFieldRevisions(sessionId: string): Promise<SessionAiFieldRevisions | null> {
  const doc = await readCached();
  return doc.sessions[sessionId] ?? null;
}
