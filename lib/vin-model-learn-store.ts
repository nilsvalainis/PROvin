import "server-only";

import { list, get, put } from "@vercel/blob";
import bundled from "@/data/vin-model-learned.json";
import { listAllDashboardDraftIndexEntries } from "@/lib/admin-dashboard-draft-index";
import { getOrderDraftBlobConfig } from "@/lib/admin-order-draft-store";
import { parseVinMemoryTable } from "@/lib/vin-memory";
import { learnVinModelCodes, type LearnPair, type LearnedTable } from "@/lib/vin-model-learn";

/**
 * Iknedēļas pašmācība: VIN atmiņa (izsoles, pasūtījumi) + pasūtījumu CSDD modeļi -> `vin_memory/_learned.json`.
 * Repo failā `data/vin-model-learned.json` paliek sākuma tabula; Blob versija to papildina.
 */

const LEARNED_REL = "vin_memory/_learned.json";
const CACHE_MS = 10 * 60 * 1000;
let cache: { at: number; table: LearnedTable } | null = null;

function parseTable(raw: unknown): LearnedTable {
  const t = (raw as { table?: unknown })?.table;
  return t && typeof t === "object" ? (t as LearnedTable) : {};
}

/** Blob tabula (ja ir) pārraksta repo tabulu tikai pa kodiem; kešs 10 min. */
export async function readLearnedTable(): Promise<LearnedTable> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.table;
  const base = parseTable(bundled);
  const blob = getOrderDraftBlobConfig();
  let merged = base;
  if (blob) {
    try {
      const res = await get(`${blob.prefix}${LEARNED_REL}`, { access: "private", token: blob.token, useCache: false });
      if (res?.statusCode === 200 && res.stream) {
        const live = parseTable(JSON.parse(await new Response(res.stream).text()));
        merged = { ...base };
        for (const [wmi, codes] of Object.entries(live)) merged[wmi] = { ...(merged[wmi] ?? {}), ...codes };
      }
    } catch {
      /* paliek repo tabula */
    }
  }
  cache = { at: Date.now(), table: merged };
  return merged;
}

/** Savāc pārus no VIN atmiņas un pasūtījumiem, iemācās, saglabā. */
export async function runVinModelLearn(): Promise<{ ok: boolean; pairs: number; codes: number }> {
  const blob = getOrderDraftBlobConfig();
  if (!blob) return { ok: false, pairs: 0, codes: 0 };
  const pairs: LearnPair[] = [];
  let cursor: string | undefined;
  do {
    const page = await list({ token: blob.token, prefix: `${blob.prefix}vin_memory/`, cursor, limit: 1000 });
    for (const b of page.blobs) {
      if (!/\/[A-HJ-NPR-Z0-9]{3}\.json$/.test(b.pathname)) continue;
      try {
        const res = await get(b.pathname, { access: "private", token: blob.token, useCache: false });
        if (!res?.stream) continue;
        const table = parseVinMemoryTable(JSON.parse(await new Response(res.stream).text()));
        for (const e of Object.values(table)) {
          const labelled = [...e.observations].reverse().find((o) => o.model);
          if (labelled?.model) pairs.push({ vin: e.vin, label: labelled.model });
        }
      } catch {
        /* bojāts fails - izlaižam */
      }
    }
    cursor = page.cursor;
  } while (cursor);
  for (const o of await listAllDashboardDraftIndexEntries()) {
    if (o.vin && o.makeModel) pairs.push({ vin: o.vin, label: o.makeModel });
  }
  const table = learnVinModelCodes(pairs);
  const codes = Object.values(table).reduce((n, t) => n + Object.keys(t).length, 0);
  await put(`${blob.prefix}${LEARNED_REL}`, JSON.stringify({ generatedAt: new Date().toISOString(), pairs: pairs.length, table }), {
    access: "private",
    token: blob.token,
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
  });
  cache = null;
  return { ok: true, pairs: pairs.length, codes };
}
