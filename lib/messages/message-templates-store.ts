import "server-only";

import fs from "fs/promises";
import path from "path";
import { get, put } from "@vercel/blob";
import { getOrderDraftBlobConfig, getOrderDraftStorageDir } from "@/lib/admin-order-draft-store";
import type { MessageTemplateOverride, MessageTemplatesDoc } from "@/lib/messages/types";

const REL = "message_templates/v1.json";
const HISTORY_PREFIX = "message_templates/history";

let cache: { doc: MessageTemplatesDoc | null; at: number } = { doc: null, at: 0 };
const CACHE_MS = 15_000;

function emptyDoc(): MessageTemplatesDoc {
  return { version: 1, overrides: {} };
}

function parseDoc(raw: unknown): MessageTemplatesDoc {
  if (!raw || typeof raw !== "object") return emptyDoc();
  const o = raw as Record<string, unknown>;
  const overrides =
    o.overrides && typeof o.overrides === "object" && !Array.isArray(o.overrides)
      ? (o.overrides as Record<string, MessageTemplateOverride>)
      : {};
  return { version: 1, overrides };
}

function storageEnabled(): { blob: ReturnType<typeof getOrderDraftBlobConfig>; dir: string | null } | null {
  const blob = getOrderDraftBlobConfig();
  const dir = getOrderDraftStorageDir();
  if (blob) return { blob, dir };
  if (dir && process.env.VERCEL !== "1") return { blob: null, dir };
  return null;
}

export async function readMessageTemplatesDoc(): Promise<MessageTemplatesDoc> {
  const now = Date.now();
  if (cache.doc && now - cache.at < CACHE_MS) return cache.doc;

  const st = storageEnabled();
  if (!st) {
    const empty = emptyDoc();
    cache = { doc: empty, at: now };
    return empty;
  }
  try {
    if (st.blob) {
      const res = await get(`${st.blob.prefix}${REL}`, {
        access: "private",
        token: st.blob.token,
        useCache: false,
      });
      if (res?.statusCode === 200 && res.stream) {
        const doc = parseDoc(JSON.parse(await new Response(res.stream).text()));
        cache = { doc, at: now };
        return doc;
      }
      const empty = emptyDoc();
      cache = { doc: empty, at: now };
      return empty;
    }
    const fp = path.join(st.dir!, REL);
    const doc = parseDoc(JSON.parse(await fs.readFile(fp, "utf8")));
    cache = { doc, at: now };
    return doc;
  } catch {
    const empty = emptyDoc();
    cache = { doc: empty, at: now };
    return empty;
  }
}

export function invalidateMessageTemplatesCache(): void {
  cache = { doc: null, at: 0 };
}

export async function writeMessageTemplatesDoc(doc: MessageTemplatesDoc): Promise<void> {
  const st = storageEnabled();
  if (!st) return;
  const body = JSON.stringify(doc);
  try {
    if (st.blob) {
      await put(`${st.blob.prefix}${REL}`, body, {
        access: "private",
        token: st.blob.token,
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: "application/json",
      });
    } else {
      const fp = path.join(st.dir!, REL);
      await fs.mkdir(path.dirname(fp), { recursive: true });
      await fs.writeFile(fp, body, "utf8");
    }
    invalidateMessageTemplatesCache();
  } catch (e) {
    console.warn("[message-templates] write failed", e instanceof Error ? e.message : e);
    throw e;
  }
}

export async function appendMessageTemplateHistory(
  id: string,
  snapshot: MessageTemplateOverride,
): Promise<void> {
  const st = storageEnabled();
  if (!st) return;
  const ts = Date.now();
  const rel = `${HISTORY_PREFIX}/${id}/${ts}.json`;
  const body = JSON.stringify(snapshot);
  try {
    if (st.blob) {
      await put(`${st.blob.prefix}${rel}`, body, {
        access: "private",
        token: st.blob.token,
        addRandomSuffix: false,
        allowOverwrite: false,
        contentType: "application/json",
      });
    } else {
      const fp = path.join(st.dir!, rel);
      await fs.mkdir(path.dirname(fp), { recursive: true });
      await fs.writeFile(fp, body, "utf8");
    }
  } catch (e) {
    console.warn("[message-templates] history write failed", e instanceof Error ? e.message : e);
  }
}

export type HistoryEntry = MessageTemplateOverride & { ts: number };

export async function listMessageTemplateHistory(id: string, limit = 12): Promise<HistoryEntry[]> {
  const st = storageEnabled();
  if (!st?.dir || st.blob) {
    // Vercel Blob: nav ērtas list — atgriežam tikai pēdējo no doc (UI rāda pēdējo saglabāto).
    const doc = await readMessageTemplatesDoc();
    const cur = doc.overrides[id];
    if (!cur) return [];
    const ts = Date.parse(cur.updatedAt);
    return [{ ...cur, ts: Number.isFinite(ts) ? ts : Date.now() }];
  }
  try {
    const dir = path.join(st.dir, HISTORY_PREFIX, id);
    const files = await fs.readdir(dir);
    const json = files.filter((f) => f.endsWith(".json")).sort().reverse().slice(0, limit);
    const out: HistoryEntry[] = [];
    for (const f of json) {
      const raw = JSON.parse(await fs.readFile(path.join(dir, f), "utf8")) as MessageTemplateOverride;
      const ts = Number.parseInt(f.replace(/\.json$/, ""), 10);
      out.push({ ...raw, ts: Number.isFinite(ts) ? ts : Date.now() });
    }
    return out;
  } catch {
    return [];
  }
}
