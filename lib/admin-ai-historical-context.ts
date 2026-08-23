import "server-only";

import { list } from "@vercel/blob";
import fs from "fs/promises";
import path from "path";
import type { OrderDraftState } from "@/lib/admin-order-draft-types";
import { adminRichHtmlToPlainText } from "@/lib/admin-rich-comment-html";
import {
  getOrderDraftBlobConfig,
  getOrderDraftStorageDir,
  isSafeOrderDraftSessionId,
  readOrderDraft,
} from "@/lib/admin-order-draft-store";
import { buildPreviouslyGeneratedSourceCommentsContext } from "@/lib/admin-source-comment-blocks";
import { mergeSourceBlocksWithDefaults, type WorkspaceSourceBlocks } from "@/lib/admin-source-blocks";
import {
  ADMIN_INCIDENTS_SUMMARY_LABEL,
  ADMIN_MILEAGE_HISTORY_COMMENT_LABEL,
} from "@/lib/admin-workspace-field-labels";
import { workspaceFillScoreFromDraft } from "@/lib/admin-workspace-integrity";
import {
  extractVehicleReportFingerprint,
  formatVehicleFingerprintLabel,
  scoreVehicleFingerprintSimilarity,
  type VehicleReportFingerprint,
} from "@/lib/admin-vehicle-report-fingerprint";
import { AI_HISTORICAL_REPORTS_CONTEXT_RULES } from "@/lib/source-summary-comment-format";

const CACHE_TTL_MS = Math.max(
  60_000,
  Number.parseInt(process.env.AI_HISTORICAL_REPORTS_CACHE_TTL_MS ?? "300000", 10) || 300_000,
);
const MAX_DRAFTS_TO_INDEX = Math.min(
  200,
  Math.max(10, Number.parseInt(process.env.AI_HISTORICAL_REPORTS_MAX_DRAFTS ?? "80", 10) || 80),
);
const MAX_MATCHES = Math.min(
  6,
  Math.max(1, Number.parseInt(process.env.AI_HISTORICAL_REPORTS_MAX_MATCHES ?? "4", 10) || 4),
);
const MIN_MATCH_SCORE = Math.max(
  12,
  Number.parseInt(process.env.AI_HISTORICAL_REPORTS_MIN_SCORE ?? "24", 10) || 24,
);
const SNIPPET_MAX = 480;

type HistoricalReportIndexEntry = {
  sessionId: string;
  fingerprint: VehicleReportFingerprint;
  fillScore: number;
  snippets: Array<{ label: string; text: string }>;
  updatedAtMs: number;
};

let indexCache: { at: number; entries: HistoricalReportIndexEntry[] } | null = null;

function historicalReportsEnabled(): boolean {
  const raw = (process.env.AI_HISTORICAL_REPORTS ?? "1").trim().toLowerCase();
  return !["0", "false", "no", "off", "disabled"].includes(raw);
}

function redactClientSpecificText(text: string): string {
  return text
    .replace(/\b[A-HJ-NPR-Z0-9]{17}\b/gi, "[VIN]")
    .replace(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi, "[e-pasts]")
    .replace(/(\+371\s?)?2[\d\s-]{6,12}/g, "[tālrunis]")
    .replace(/\bcs_[a-zA-Z0-9]+\b/g, "[pasūtījums]");
}

function clipSnippet(text: string, max = SNIPPET_MAX): string {
  const t = redactClientSpecificText(text.replace(/\s+/g, " ").trim());
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trim()}…`;
}

function pushSnippet(out: Array<{ label: string; text: string }>, label: string, raw: string | undefined): void {
  const plain = adminRichHtmlToPlainText(raw ?? "").trim();
  if (plain.length < 60) return;
  out.push({ label, text: clipSnippet(plain) });
}

function extractHistoricalSnippets(draft: OrderDraftState): Array<{ label: string; text: string }> {
  const snippets: Array<{ label: string; text: string }> = [];
  const ws = draft.workspace;
  if (!ws) return snippets;

  const blocks = mergeSourceBlocksWithDefaults(ws.sourceBlocks);
  const sourceComments = buildPreviouslyGeneratedSourceCommentsContext(null, blocks).trim();
  if (sourceComments) {
    snippets.push({ label: "Avotu komentāri", text: clipSnippet(sourceComments, 900) });
  }

  pushSnippet(snippets, "1. Tehnisko risku analīze", ws.tehniskoRiskuAnalize);
  pushSnippet(snippets, "2. Ieteikumi klātienes apskatei", ws.apskatesPlāns);
  pushSnippet(snippets, ADMIN_MILEAGE_HISTORY_COMMENT_LABEL, draft.orderEdits.mileageComment);
  pushSnippet(snippets, ADMIN_INCIDENTS_SUMMARY_LABEL, draft.orderEdits.internalComment);
  pushSnippet(snippets, "3. Kopsavilkums", ws.iriss);
  pushSnippet(snippets, "Cenas atbilstība", ws.cenasAtbilstiba);

  return snippets.slice(0, 8);
}

function draftQualifiesAsHistoricalReport(draft: OrderDraftState): boolean {
  if (!draft.workspace) return false;
  const fill = workspaceFillScoreFromDraft(draft.workspace);
  const snippets = extractHistoricalSnippets(draft);
  if (snippets.length === 0) return false;
  return fill >= 5 || snippets.some((s) => s.text.length >= 120);
}

function draftToIndexEntry(sessionId: string, draft: OrderDraftState): HistoricalReportIndexEntry | null {
  if (!draft.workspace || !draftQualifiesAsHistoricalReport(draft)) return null;
  const ws = draft.workspace;
  const manufactureYear = ws.vehicleAiExtraction?.vehicle_metadata?.manufacture_year ?? null;
  const vin = draft.orderEdits.vin?.trim() || ws.vehicleAiExtraction?.vehicle_metadata?.vin?.trim() || null;
  return {
    sessionId,
    fingerprint: extractVehicleReportFingerprint(ws.sourceBlocks as WorkspaceSourceBlocks, { vin, manufactureYear }),
    fillScore: workspaceFillScoreFromDraft(ws),
    snippets: extractHistoricalSnippets(draft),
    updatedAtMs: Date.parse(draft.updatedAt) || 0,
  };
}

type DraftIdHit = { id: string; mtimeMs: number };

async function listOrderDraftSessionIdsFromFs(dir: string): Promise<DraftIdHit[]> {
  let names: string[] = [];
  try {
    names = await fs.readdir(dir);
  } catch {
    return [];
  }
  const ids: DraftIdHit[] = [];
  for (const name of names) {
    if (!name.endsWith(".json")) continue;
    if (name.startsWith("_")) continue;
    const id = name.slice(0, -5);
    if (!isSafeOrderDraftSessionId(id)) continue;
    try {
      const st = await fs.stat(path.join(dir, name));
      ids.push({ id, mtimeMs: st.mtimeMs });
    } catch {
      ids.push({ id, mtimeMs: 0 });
    }
  }
  return ids;
}

async function listOrderDraftSessionIdsFromBlob(prefix: string, token: string): Promise<DraftIdHit[]> {
  const ids: DraftIdHit[] = [];
  let cursor: string | undefined;
  do {
    const page = await list({ prefix, token, cursor, limit: 1000, mode: "expanded" });
    for (const b of page.blobs) {
      if (!b.pathname.endsWith(".json")) continue;
      const id = b.pathname.slice(prefix.length, -".json".length);
      if (!isSafeOrderDraftSessionId(id)) continue;
      const uploaded = "uploadedAt" in b ? b.uploadedAt : undefined;
      const mtimeMs = uploaded ? new Date(uploaded as string | Date).getTime() : 0;
      ids.push({ id, mtimeMs: Number.isFinite(mtimeMs) ? mtimeMs : 0 });
    }
    cursor = page.hasMore && page.cursor ? page.cursor : undefined;
  } while (cursor);
  return ids;
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  async function worker() {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await fn(items[i]!);
    }
  }
  const n = Math.min(Math.max(1, limit), Math.max(1, items.length));
  if (items.length === 0) return results;
  await Promise.all(Array.from({ length: n }, () => worker()));
  return results;
}

async function listNewestOrderDraftSessionIds(limit: number): Promise<string[]> {
  const byId = new Map<string, number>();
  const remember = (hits: DraftIdHit[]) => {
    for (const hit of hits) {
      if (hit.id.startsWith("demo_order_")) continue;
      const prev = byId.get(hit.id) ?? 0;
      if (hit.mtimeMs >= prev) byId.set(hit.id, hit.mtimeMs);
    }
  };
  const dir = getOrderDraftStorageDir();
  if (dir) remember(await listOrderDraftSessionIdsFromFs(dir));
  const blob = getOrderDraftBlobConfig();
  if (blob) remember(await listOrderDraftSessionIdsFromBlob(blob.prefix, blob.token));
  return [...byId.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id]) => id);
}

async function buildHistoricalReportIndex(): Promise<HistoricalReportIndexEntry[]> {
  const now = Date.now();
  if (indexCache && now - indexCache.at < CACHE_TTL_MS) return indexCache.entries;

  const sortedIds = await listNewestOrderDraftSessionIds(MAX_DRAFTS_TO_INDEX);

  const drafts = await mapLimit(sortedIds, 8, (sessionId) => readOrderDraft(sessionId));
  const entries: HistoricalReportIndexEntry[] = [];
  for (let i = 0; i < sortedIds.length; i++) {
    const draft = drafts[i];
    const sessionId = sortedIds[i];
    if (!draft || !sessionId) continue;
    const entry = draftToIndexEntry(sessionId, draft);
    if (entry) entries.push(entry);
  }

  entries.sort((a, b) => b.updatedAtMs - a.updatedAtMs);
  indexCache = { at: now, entries };
  return entries;
}

export type AiHistoricalContextInput = {
  sessionId: string;
  sourceBlocks: WorkspaceSourceBlocks;
  vin?: string | null;
  manufactureYear?: number | null;
};

/** Vēsturisko auditu fragments AI promptam — līdzīgi agregāti, stils un ieteikumi. */
export async function buildHistoricalReportsAiContext(input: AiHistoricalContextInput): Promise<string> {
  if (!historicalReportsEnabled()) return "";

  const currentFp = extractVehicleReportFingerprint(input.sourceBlocks, {
    vin: input.vin,
    manufactureYear: input.manufactureYear,
  });

  const hasSignal =
    currentFp.makeModel.trim().length > 2 ||
    currentFp.engineCode.length > 0 ||
    currentFp.modelTokens.length > 0 ||
    currentFp.year != null;
  if (!hasSignal) return "";

  const index = await buildHistoricalReportIndex();
  const ranked = index
    .filter((e) => e.sessionId !== input.sessionId)
    .map((e) => ({ entry: e, score: scoreVehicleFingerprintSimilarity(currentFp, e.fingerprint) }))
    .filter((r) => r.score >= MIN_MATCH_SCORE)
    .sort((a, b) => b.score - a.score || b.entry.updatedAtMs - a.entry.updatedAtMs)
    .slice(0, MAX_MATCHES);

  if (ranked.length === 0) return "";

  const blocks: string[] = [
    AI_HISTORICAL_REPORTS_CONTEXT_RULES,
    `### Vēsturiskie PROVIN auditi ar līdzīgiem agregātiem (${formatVehicleFingerprintLabel(currentFp)})`,
  ];

  ranked.forEach(({ entry, score }, i) => {
    const head = `#### Atsauce ${i + 1} — ${formatVehicleFingerprintLabel(entry.fingerprint)} (atbilstība ${score})`;
    const body = entry.snippets.map((s) => `**${s.label}:** ${s.text}`).join("\n\n");
    blocks.push(`${head}\n${body}`);
  });

  return blocks.join("\n\n");
}

/** Invalidē kešu pēc jaunas atskaites saglabāšanas (opcionāli izsauc no draft store). */
export function invalidateHistoricalReportsIndexCache(): void {
  indexCache = null;
}
