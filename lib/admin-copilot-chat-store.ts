import "server-only";

import fs from "fs/promises";
import os from "os";
import path from "path";
import { get, put } from "@vercel/blob";

import { COPILOT_SOURCE_KEYS, isCopilotSourceKey, type CopilotSourceKey } from "@/lib/admin-copilot-types";

/**
 * Copilot sarunas atmiņa uz servera. Atsevišķi no pasūtījuma melnraksta:
 * čats mainās pie katras ziņas un nedrīkst radīt melnraksta revīzijas.
 */

const DEFAULT_RELATIVE_DIR = ".data/admin-copilot-chats";
const DEFAULT_BLOB_SUBPREFIX = "copilot-chats/";

export const COPILOT_CHAT_MAX_MESSAGES = 120;
export const COPILOT_CHAT_MAX_CONTENT_CHARS = 12_000;

export type CopilotChatStoredMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  at: string;
};

export type CopilotChatDocument = {
  messages: CopilotChatStoredMessage[];
  allowedSources: CopilotSourceKey[];
  updatedAt: string;
};

type BlobConfig = { token: string; prefix: string };

function resolveBlob(): BlobConfig | null {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim() ?? "";
  if (!token) return null;
  const explicit = (process.env.ADMIN_COPILOT_CHAT_BLOB_PREFIX ?? "").trim();
  if (explicit) {
    return { token, prefix: explicit.endsWith("/") ? explicit : `${explicit}/` };
  }
  const draftPrefix = (process.env.ADMIN_ORDER_DRAFT_BLOB_PREFIX ?? "").trim();
  if (!draftPrefix) return null;
  const base = draftPrefix.endsWith("/") ? draftPrefix : `${draftPrefix}/`;
  return { token, prefix: `${base}${DEFAULT_BLOB_SUBPREFIX}` };
}

function resolveDir(): string | null {
  const raw = process.env.ADMIN_COPILOT_CHAT_DIR?.trim() ?? "";
  const off = ["0", "false", "no", "off", "disabled"];
  if (off.includes(raw.toLowerCase())) return null;
  if (raw) return path.resolve(raw);
  if (process.env.VERCEL === "1") return path.join(os.tmpdir(), "provin-admin-copilot-chats");
  return path.join(process.cwd(), DEFAULT_RELATIVE_DIR);
}

export function isCopilotChatStoreEnabled(): boolean {
  return resolveDir() !== null || resolveBlob() !== null;
}

/** Stripe `cs_*` / demo id — tikai droši failsistēmas nosaukumi. */
export function isSafeCopilotChatSessionId(id: string): boolean {
  if (!id || id.length > 200) return false;
  return /^[a-zA-Z0-9_]+$/.test(id);
}

function chatFilePath(dir: string, sessionId: string): string {
  return path.join(dir, `${sessionId}.json`);
}

function blobPathname(prefix: string, sessionId: string): string {
  return `${prefix}${sessionId}.json`;
}

function emptyDocument(): CopilotChatDocument {
  return { messages: [], allowedSources: [], updatedAt: new Date().toISOString() };
}

function normalizeMessage(raw: unknown): CopilotChatStoredMessage | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const role = o.role;
  if (role !== "user" && role !== "assistant" && role !== "system") return null;
  const content = typeof o.content === "string" ? o.content.slice(0, COPILOT_CHAT_MAX_CONTENT_CHARS) : "";
  if (!content.trim()) return null;
  return {
    id: typeof o.id === "string" && o.id ? o.id.slice(0, 64) : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role,
    content,
    at: typeof o.at === "string" && o.at ? o.at : new Date().toISOString(),
  };
}

export function normalizeCopilotChatDocument(raw: unknown): CopilotChatDocument {
  if (!raw || typeof raw !== "object") return emptyDocument();
  const o = raw as Record<string, unknown>;
  const messages: CopilotChatStoredMessage[] = [];
  if (Array.isArray(o.messages)) {
    for (const item of o.messages.slice(-COPILOT_CHAT_MAX_MESSAGES)) {
      const m = normalizeMessage(item);
      if (m) messages.push(m);
    }
  }
  const allowedSources: CopilotSourceKey[] = [];
  if (Array.isArray(o.allowedSources)) {
    for (const item of o.allowedSources) {
      if (typeof item === "string" && isCopilotSourceKey(item) && !allowedSources.includes(item)) {
        allowedSources.push(item);
      }
    }
  }
  return {
    messages,
    allowedSources: COPILOT_SOURCE_KEYS.filter((k) => allowedSources.includes(k)),
    updatedAt: typeof o.updatedAt === "string" && o.updatedAt ? o.updatedAt : new Date().toISOString(),
  };
}

export async function readCopilotChat(sessionId: string): Promise<CopilotChatDocument | null> {
  if (!isSafeCopilotChatSessionId(sessionId)) return null;

  const blob = resolveBlob();
  if (blob) {
    try {
      const res = await get(blobPathname(blob.prefix, sessionId), {
        access: "private",
        token: blob.token,
        useCache: false,
      });
      if (res && res.statusCode === 200 && res.stream) {
        const text = await new Response(res.stream).text();
        return normalizeCopilotChatDocument(JSON.parse(text) as unknown);
      }
    } catch {
      /* krītam atpakaļ uz failsistēmu */
    }
  }

  const dir = resolveDir();
  if (!dir) return null;
  try {
    const text = await fs.readFile(chatFilePath(dir, sessionId), "utf8");
    return normalizeCopilotChatDocument(JSON.parse(text) as unknown);
  } catch {
    return null;
  }
}

export async function writeCopilotChat(
  sessionId: string,
  doc: CopilotChatDocument,
): Promise<boolean> {
  if (!isSafeCopilotChatSessionId(sessionId)) return false;
  const normalized: CopilotChatDocument = {
    ...normalizeCopilotChatDocument(doc),
    updatedAt: new Date().toISOString(),
  };
  const body = JSON.stringify(normalized);
  let wrote = false;

  const blob = resolveBlob();
  if (blob) {
    try {
      await put(blobPathname(blob.prefix, sessionId), body, {
        access: "private",
        token: blob.token,
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: "application/json",
      });
      wrote = true;
    } catch {
      /* mēģinām failsistēmu */
    }
  }

  const dir = resolveDir();
  if (dir) {
    try {
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(chatFilePath(dir, sessionId), body, "utf8");
      wrote = true;
    } catch {
      /* nerakstāma vide — čats paliek tikai pārlūkā */
    }
  }

  return wrote;
}

/** Pievieno gājienus un nogriež vēsturi līdz limitam. */
export async function appendCopilotChatMessages(
  sessionId: string,
  incoming: Array<Pick<CopilotChatStoredMessage, "role" | "content"> & { id?: string }>,
  allowedSources?: CopilotSourceKey[],
): Promise<boolean> {
  if (!isCopilotChatStoreEnabled()) return false;
  const current = (await readCopilotChat(sessionId)) ?? emptyDocument();
  const now = new Date().toISOString();
  const added = incoming
    .map((m) => normalizeMessage({ ...m, at: now }))
    .filter((m): m is CopilotChatStoredMessage => m !== null);
  if (added.length === 0 && !allowedSources) return false;

  return writeCopilotChat(sessionId, {
    messages: [...current.messages, ...added].slice(-COPILOT_CHAT_MAX_MESSAGES),
    allowedSources: allowedSources ?? current.allowedSources,
    updatedAt: now,
  });
}

export async function clearCopilotChat(sessionId: string): Promise<boolean> {
  return writeCopilotChat(sessionId, emptyDocument());
}
