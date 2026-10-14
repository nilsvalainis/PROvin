import "server-only";

import fs from "fs/promises";
import path from "path";
import { get, list, put } from "@vercel/blob";
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

function historyRel(id: string, ts: number): string {
  return `${HISTORY_PREFIX}/${id}/${ts}.json`;
}

function parseHistoryTsFromPath(pathname: string): number | null {
  const name = pathname.split("/").pop() ?? "";
  if (!name.endsWith(".json")) return null;
  const ts = Number.parseInt(name.slice(0, -".json".length), 10);
  return Number.isFinite(ts) ? ts : null;
}

export async function listMessageTemplateHistory(id: string, limit = 24): Promise<HistoryEntry[]> {
  const st = storageEnabled();
  if (!st) return [];

  if (st.blob) {
    const prefix = `${st.blob.prefix}${HISTORY_PREFIX}/${id}/`;
    const collected: { ts: number; pathname: string }[] = [];
    let cursor: string | undefined;
    try {
      for (let page = 0; page < 20 && collected.length < limit * 3; page++) {
        const result = await list({ prefix, token: st.blob.token, cursor, limit: 1000 });
        for (const b of result.blobs) {
          const ts = parseHistoryTsFromPath(b.pathname);
          if (ts != null) collected.push({ ts, pathname: b.pathname });
        }
        if (!result.hasMore || !result.cursor) break;
        cursor = result.cursor;
      }
      collected.sort((a, b) => b.ts - a.ts);
      const top = collected.slice(0, limit);
      const out: HistoryEntry[] = [];
      for (const item of top) {
        try {
          const res = await get(item.pathname, { access: "private", token: st.blob.token, useCache: false });
          if (res?.statusCode !== 200 || !res.stream) continue;
          const raw = JSON.parse(await new Response(res.stream).text()) as MessageTemplateOverride;
          out.push({ ...raw, ts: item.ts });
        } catch {
          /* skip broken blob */
        }
      }
      return out;
    } catch {
      return [];
    }
  }

  try {
    const dir = path.join(st.dir!, HISTORY_PREFIX, id);
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

export async function readMessageTemplateHistoryEntry(id: string, ts: number): Promise<HistoryEntry | null> {
  if (!Number.isFinite(ts) || ts <= 0) return null;
  const st = storageEnabled();
  if (!st) return null;
  const rel = historyRel(id, ts);
  try {
    if (st.blob) {
      const res = await get(`${st.blob.prefix}${rel}`, {
        access: "private",
        token: st.blob.token,
        useCache: false,
      });
      if (res?.statusCode !== 200 || !res.stream) return null;
      const raw = JSON.parse(await new Response(res.stream).text()) as MessageTemplateOverride;
      return { ...raw, ts };
    }
    const fp = path.join(st.dir!, rel);
    const raw = JSON.parse(await fs.readFile(fp, "utf8")) as MessageTemplateOverride;
    return { ...raw, ts };
  } catch {
    return null;
  }
}
