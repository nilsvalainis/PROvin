import "server-only";

import fs from "fs/promises";
import path from "path";
import { get, list } from "@vercel/blob";
import {
  extractOrderDraftTableSummary,
  type OrderDraftTableSummary,
} from "@/lib/admin-order-draft-summary-parse";
import {
  getOrderDraftStorageDir,
  isSafeOrderDraftSessionId,
  readOrderDraft,
} from "@/lib/admin-order-draft-store";

export type { OrderDraftTableSummary } from "@/lib/admin-order-draft-summary-parse";
export { extractOrderDraftTableSummary } from "@/lib/admin-order-draft-summary-parse";

const HEALTH_PROBE_BASENAME = "__provin_persistence_health_probe__.json";

function resolveOrderDraftBlob(): { token: string; prefix: string } | null {
  const rawPrefix = (process.env.ADMIN_ORDER_DRAFT_BLOB_PREFIX ?? "").trim();
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim() ?? "";
  if (!rawPrefix || !token) return null;
  const prefix = rawPrefix.endsWith("/") ? rawPrefix : `${rawPrefix}/`;
  return { token, prefix };
}

async function readSummaryJsonFromBlob(
  sessionId: string,
  blob: { token: string; prefix: string },
): Promise<OrderDraftTableSummary | null> {
  try {
    const res = await get(`${blob.prefix}${sessionId}.json`, {
      access: "private",
      token: blob.token,
      useCache: false,
    });
    if (!res || res.statusCode !== 200 || !res.stream) return null;
    const text = await new Response(res.stream).text();
    return extractOrderDraftTableSummary(JSON.parse(text) as unknown);
  } catch {
    return null;
  }
}

async function collectBlobDraftSessionIds(
  blob: { token: string; prefix: string },
  wanted: Set<string>,
): Promise<Set<string>> {
  const found = new Set<string>();
  let cursor: string | undefined;
  do {
    const page = await list({ prefix: blob.prefix, token: blob.token, cursor, limit: 1000 });
    for (const b of page.blobs) {
      if (!b.pathname.endsWith(".json")) continue;
      const base = path.basename(b.pathname);
      if (base === HEALTH_PROBE_BASENAME || base.startsWith("_")) continue;
      const sessionId = base.slice(0, -5);
      if (wanted.has(sessionId)) found.add(sessionId);
    }
    if (page.hasMore && !page.cursor) break;
    cursor = page.hasMore && page.cursor ? page.cursor : undefined;
  } while (cursor);
  return found;
}

async function collectFsDraftSessionIds(dir: string, wanted: Set<string>): Promise<Set<string>> {
  const found = new Set<string>();
  let names: string[] = [];
  try {
    names = await fs.readdir(dir);
  } catch {
    return found;
  }
  for (const name of names) {
    if (!name.endsWith(".json")) continue;
    const sessionId = name.slice(0, -5);
    if (wanted.has(sessionId) && isSafeOrderDraftSessionId(sessionId)) found.add(sessionId);
  }
  return found;
}

/**
 * Admin pasūtījumu tabulai — lasa tikai e-pastu/rēķinu laukus.
 * Blob: viens `list`, tad `get` tikai sesijām, kurām eksistē fails (nevis katram no 50 pasūtījumiem).
 */
export async function readOrderDraftTableSummaries(
  sessionIds: string[],
): Promise<Map<string, OrderDraftTableSummary>> {
  const wanted = new Set(sessionIds.filter(isSafeOrderDraftSessionId));
  const out = new Map<string, OrderDraftTableSummary>();
  if (wanted.size === 0) return out;

  const blob = resolveOrderDraftBlob();
  const dir = getOrderDraftStorageDir();
  const toRead = new Set<string>();

  if (blob) {
    const onBlob = await collectBlobDraftSessionIds(blob, wanted);
    for (const id of onBlob) toRead.add(id);
  }
  if (dir) {
    const onFs = await collectFsDraftSessionIds(dir, wanted);
    for (const id of onFs) toRead.add(id);
  }

  if (toRead.size === 0) return out;

  await Promise.all(
    [...toRead].map(async (sessionId) => {
      if (blob) {
        const fromBlob = await readSummaryJsonFromBlob(sessionId, blob);
        if (fromBlob) {
          out.set(sessionId, fromBlob);
          return;
        }
      }
      const draft = await readOrderDraft(sessionId);
      if (!draft) return;
      const summary = extractOrderDraftTableSummary({
        orderEdits: draft.orderEdits,
        invoicePdfUrl: draft.invoicePdfUrl,
      });
      if (summary) out.set(sessionId, summary);
    }),
  );

  return out;
}
