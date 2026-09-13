import "server-only";

import fs from "node:fs/promises";
import path from "node:path";
import { get, put } from "@vercel/blob";
import {
  B2B_INVITE_TTL_MS,
  isB2bInviteOpen,
  isSafeB2bInviteToken,
  newB2bInviteToken,
  parseB2bInviteRecord,
  type B2bPartnerInviteRecord,
} from "@/lib/b2b-partner-invite";

const RELATIVE_DIR = ".data/b2b-partner-invites";
const FILENAME = "index.json";
const BLOB_PATHNAME = "b2b-partners/invites.json";

type InviteDoc = {
  version: 1;
  updatedAt: string;
  invites: B2bPartnerInviteRecord[];
};

function emptyDoc(): InviteDoc {
  return { version: 1, updatedAt: new Date().toISOString(), invites: [] };
}

function parseDoc(raw: string): InviteDoc {
  try {
    const p = JSON.parse(raw) as Partial<InviteDoc>;
    const invites: B2bPartnerInviteRecord[] = [];
    if (Array.isArray(p.invites)) {
      for (const item of p.invites) {
        const row = parseB2bInviteRecord(item);
        if (row) invites.push(row);
      }
    }
    return {
      version: 1,
      updatedAt:
        typeof p.updatedAt === "string" && p.updatedAt.trim() ? p.updatedAt.trim() : new Date().toISOString(),
      invites,
    };
  } catch {
    return emptyDoc();
  }
}

function blobToken(): string | null {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim() ?? "";
  return token || null;
}

function filesystemPath(): string {
  return path.join(process.cwd(), RELATIVE_DIR, FILENAME);
}

async function readFromBlob(token: string): Promise<InviteDoc | null> {
  try {
    const res = await get(BLOB_PATHNAME, {
      access: "private",
      token,
      useCache: false,
    });
    if (!res || res.statusCode !== 200 || !res.stream) return null;
    const text = await new Response(res.stream).text();
    return parseDoc(text);
  } catch {
    return null;
  }
}

async function writeToBlob(token: string, doc: InviteDoc): Promise<void> {
  await put(BLOB_PATHNAME, JSON.stringify(doc), {
    access: "private",
    token,
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
  });
}

async function readFromFilesystem(): Promise<InviteDoc | null> {
  try {
    const raw = await fs.readFile(filesystemPath(), "utf8");
    return parseDoc(raw);
  } catch {
    return null;
  }
}

async function writeToFilesystem(doc: InviteDoc): Promise<void> {
  const fp = filesystemPath();
  await fs.mkdir(path.dirname(fp), { recursive: true });
  const tmp = `${fp}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(doc), "utf8");
  await fs.rename(tmp, fp);
}

async function readDoc(): Promise<InviteDoc> {
  const token = blobToken();
  if (token) {
    const fromBlob = await readFromBlob(token);
    if (fromBlob) return fromBlob;
  }
  const fromFs = await readFromFilesystem();
  return fromFs ?? emptyDoc();
}

async function writeDoc(doc: InviteDoc): Promise<void> {
  const next = { ...doc, updatedAt: new Date().toISOString() };
  const token = blobToken();
  if (token) {
    await writeToBlob(token, next);
    try {
      await writeToFilesystem(next);
    } catch {
      /* ignore */
    }
    return;
  }
  await writeToFilesystem(next);
}

let writeChain: Promise<unknown> = Promise.resolve();

function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = writeChain.then(fn, fn);
  writeChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export async function listOpenB2bInvites(): Promise<B2bPartnerInviteRecord[]> {
  const doc = await readDoc();
  return doc.invites.filter((row) => isB2bInviteOpen(row));
}

export async function createB2bInvite(): Promise<B2bPartnerInviteRecord> {
  return withLock(async () => {
    const doc = await readDoc();
    const now = Date.now();
    const record: B2bPartnerInviteRecord = {
      token: newB2bInviteToken(),
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + B2B_INVITE_TTL_MS).toISOString(),
      usedAt: null,
      usedPartnerId: null,
    };
    doc.invites.push(record);
    await writeDoc(doc);
    return record;
  });
}

export async function getOpenB2bInvite(token: string): Promise<B2bPartnerInviteRecord | null> {
  if (!isSafeB2bInviteToken(token)) return null;
  const doc = await readDoc();
  const row = doc.invites.find((item) => item.token === token.trim()) ?? null;
  if (!row || !isB2bInviteOpen(row)) return null;
  return row;
}

export async function consumeB2bInvite(
  token: string,
  partnerId: string,
): Promise<boolean> {
  return withLock(async () => {
    const doc = await readDoc();
    const idx = doc.invites.findIndex((item) => item.token === token.trim());
    if (idx < 0) return false;
    const prev = doc.invites[idx]!;
    if (!isB2bInviteOpen(prev)) return false;
    doc.invites[idx] = {
      ...prev,
      usedAt: new Date().toISOString(),
      usedPartnerId: partnerId,
    };
    await writeDoc(doc);
    return true;
  });
}
