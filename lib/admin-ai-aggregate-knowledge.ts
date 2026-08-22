import "server-only";

import fs from "fs/promises";
import path from "path";
import type { OrderDraftState } from "@/lib/admin-order-draft-types";
import {
  draftQualifiesForAggregateLearning,
  extractLearningSnippetsFromDraft,
} from "@/lib/admin-audit-learning-extract";
import {
  extractVehicleReportFingerprint,
  formatVehicleFingerprintLabel,
  type VehicleReportFingerprint,
} from "@/lib/admin-vehicle-report-fingerprint";
import {
  mergeSourceBlocksWithDefaults,
  type WorkspaceSourceBlocks,
} from "@/lib/admin-source-blocks";
import {
  formatAggregateCasePacksForAi,
  fingerprintLearningKey,
  selectAggregateCasePacks,
} from "@/lib/provin-aggregate-case-rules";
import {
  getAuditLearningsForKeys,
  invalidateAuditLearningsCache,
  listAllAuditLearningKeys,
  readAllAuditLearningEntries,
  upsertAuditAggregateLearning,
  type AuditAggregateLearningEntry,
} from "@/lib/admin-audit-learnings-store";
import {
  buildPromotionCandidates,
  clipPromotionMarkdown,
  formatPromotionCandidatesMarkdown,
} from "@/lib/admin-audit-knowledge-promote";
import {
  getOrderDraftBlobConfig,
  getOrderDraftStorageDir,
  isSafeOrderDraftSessionId,
  readOrderDraft,
} from "@/lib/admin-order-draft-store";
import { list } from "@vercel/blob";

export { draftQualifiesForAggregateLearning, extractLearningSnippetsFromDraft };

export const AI_AGGREGATE_KNOWLEDGE_RULES = `PROVIN AGGREGĀTU ZINĀŠANAS (statiskā bāze + mācījumi no iepriekšējām atskaitēm):
- Kombinē zemāk esošās ražotāju/agregātu pakas ar AKTĪVĀ pasūtījuma datiem un (ja ir) vēsturisko auditu fragmentiem.
- Katru agregāta risku klasificē: **galvenais pirkuma risks** / **ierasta uzturēšanas izmaksa** / **pārbaudāms klātienē, nav pirkuma šķērslis**.
- **1. Tehnisko risku analīze** — detalizēta agregātu forenzika (nosacīts garums: tik sadaļu, cik ir konkrēta materiāla; 8–12 tikai ja katra sadaļa ir cits mezgls); **2. Ieteikumi** — pircēja soļi (redzēt/dzirdēt/izmērīt/vaicāt), ne risku spogulis; **3. Kopsavilkums** — kopaina bez garas tehniskās dublikācijas un BEZ cenu/EUR summām; **avotu/nobraukuma/negadījumu komentāri** — arī lieto šīs zināšanas, kur relevantas.
- Mācījumi no citām atskaitēm — tikai paraugi un forenzikas loģika; **nekopē** klienta VIN, km, datumus, EUR, pasūtījuma ID.
- Ja statiskā paka un mācījumi konfliktē ar aktīvā auto datiem — uzvar aktīvā pasūtījuma fakti.
- Pēc katras bagātīgas atskaites PROVIN saglabā anonimizētus mācījumus — uzskati tos par institucionālo atmiņu nākamajiem līdzīgiem agregātiem.`;

/** Tokenu budžets ✨ kontekstā (dārgais modelis). */
const AGGREGATE_CTX_MAX_PACKS = 3;
const AGGREGATE_CTX_MAX_LEARNING_KEYS = 3;
const AGGREGATE_CTX_MAX_SNIPPETS_PER_KEY = 4;
const AGGREGATE_CTX_MAX_CHARS = 7_500;

/** Pēc veiksmīgas atskaites saglabāšanas — papildina mācījumu indeksu (fire-and-forget). */
export async function recordAuditAggregateLearningFromDraft(draft: OrderDraftState): Promise<void> {
  if (!draftQualifiesForAggregateLearning(draft)) return;
  const ws = draft.workspace!;
  const vin = draft.orderEdits.vin?.trim() || null;
  const fp = extractVehicleReportFingerprint(ws.sourceBlocks as WorkspaceSourceBlocks, { vin });
  const key = fingerprintLearningKey(fp);
  const snippets = extractLearningSnippetsFromDraft(draft);
  if (snippets.length === 0) return;
  const entry: AuditAggregateLearningEntry = {
    key,
    label: formatVehicleFingerprintLabel(fp),
    updatedAt: new Date().toISOString(),
    snippets,
  };
  await upsertAuditAggregateLearning(entry);
}

async function listOrderDraftSessionIdsFromFs(dir: string): Promise<string[]> {
  let names: string[] = [];
  try {
    names = await fs.readdir(dir);
  } catch {
    return [];
  }
  const ids: string[] = [];
  for (const name of names) {
    if (!name.endsWith(".json") || name.startsWith("_")) continue;
    const id = name.slice(0, -5);
    if (isSafeOrderDraftSessionId(id)) ids.push(id);
  }
  return ids;
}

async function listOrderDraftSessionIdsFromBlob(prefix: string, token: string): Promise<string[]> {
  const ids: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await list({ prefix, token, cursor, limit: 1000, mode: "expanded" });
    for (const b of page.blobs) {
      if (!b.pathname.endsWith(".json")) continue;
      const id = b.pathname.slice(prefix.length, -".json".length);
      if (isSafeOrderDraftSessionId(id)) ids.push(id);
    }
    cursor = page.hasMore && page.cursor ? page.cursor : undefined;
  } while (cursor);
  return ids;
}

async function listAllOrderDraftSessionIdsForBackfill(): Promise<string[]> {
  const seen = new Set<string>();
  const dir = getOrderDraftStorageDir();
  if (dir) {
    for (const id of await listOrderDraftSessionIdsFromFs(dir)) seen.add(id);
  }
  const blob = getOrderDraftBlobConfig();
  if (blob) {
    for (const id of await listOrderDraftSessionIdsFromBlob(blob.prefix, blob.token)) seen.add(id);
  }
  return [...seen].filter((id) => !id.startsWith("demo_order_"));
}

export type AuditKnowledgeBackfillResult = {
  scanned: number;
  recorded: number;
  skipped: number;
  errors: number;
};

/** Lēts backfill — tikai lokālā ekstrakcija + Blob/FS write; **bez** Claude/Gemini API. */
export async function backfillAuditAggregateLearnings(opts?: {
  limit?: number;
}): Promise<AuditKnowledgeBackfillResult> {
  const limit = Math.min(500, Math.max(1, opts?.limit ?? 120));
  const ids = (await listAllOrderDraftSessionIdsForBackfill()).slice(0, limit);
  let recorded = 0;
  let skipped = 0;
  let errors = 0;
  for (const sessionId of ids) {
    try {
      const draft = await readOrderDraft(sessionId);
      if (!draft || !draftQualifiesForAggregateLearning(draft)) {
        skipped += 1;
        continue;
      }
      await recordAuditAggregateLearningFromDraft(draft);
      recorded += 1;
    } catch {
      errors += 1;
    }
  }
  return { scanned: ids.length, recorded, skipped, errors };
}

export type AuditKnowledgePromoteResult = {
  candidateCount: number;
  markdownChars: number;
  outputPath: string | null;
  markdown: string;
};

/** Bez LLM — raksta kompaktu MD Claude pārskatam (`.data/…`). */
export async function promoteAuditKnowledgeCandidates(opts?: {
  writeFile?: boolean;
  minSnippets?: number;
  maxCandidates?: number;
}): Promise<AuditKnowledgePromoteResult> {
  const entries = await readAllAuditLearningEntries();
  const candidates = buildPromotionCandidates(entries, {
    minSnippets: opts?.minSnippets ?? 3,
    maxCandidates: opts?.maxCandidates ?? 24,
  });
  const markdown = clipPromotionMarkdown(
    formatPromotionCandidatesMarkdown(candidates, {
      generatedAt: new Date().toISOString(),
      sourceEntryCount: entries.length,
    }),
  );

  let outputPath: string | null = null;
  if (opts?.writeFile !== false) {
    const dir = getOrderDraftStorageDir() ?? path.join(process.cwd(), ".data");
    await fs.mkdir(dir, { recursive: true });
    outputPath = path.join(dir, "audit-knowledge-candidates.md");
    await fs.writeFile(outputPath, markdown, "utf8");
  }

  return {
    candidateCount: candidates.length,
    markdownChars: markdown.length,
    outputPath,
    markdown,
  };
}

async function rankLearningKeysForFingerprint(fp: VehicleReportFingerprint): Promise<string[]> {
  const primary = fingerprintLearningKey(fp);
  const allKeys = await listAllAuditLearningKeys();
  if (allKeys.length === 0) return [];

  const out: string[] = [];
  if (allKeys.includes(primary)) out.push(primary);
  const make = fp.makeTokens[0] ?? "";
  const engine = fp.engineCode;
  for (const k of allKeys) {
    if (out.includes(k)) continue;
    if (engine && k.includes(engine)) out.push(k);
    else if (make && k.includes(make)) out.push(k);
  }
  return out.slice(0, AGGREGATE_CTX_MAX_LEARNING_KEYS);
}

export type AggregateKnowledgeContextInput = {
  sourceBlocks: WorkspaceSourceBlocks;
  vin?: string | null;
  manufactureYear?: number | null;
};

function clipAggregateContext(parts: string[], maxChars: number): string {
  const joined = parts.filter(Boolean).join("\n\n");
  if (joined.length <= maxChars) return joined;
  return `${joined.slice(0, maxChars - 1).trim()}…`;
}

/** Statiskās paka + mācījumi — ar stingru rakstzīmju limitu (dārgais ✨ modelis). */
export async function buildAggregateKnowledgeAiContext(
  input: AggregateKnowledgeContextInput,
): Promise<string> {
  const blocks = mergeSourceBlocksWithDefaults(input.sourceBlocks);
  const fp = extractVehicleReportFingerprint(blocks, {
    vin: input.vin,
    manufactureYear: input.manufactureYear,
  });

  const hasSignal =
    fp.makeModel.trim().length > 2 ||
    fp.engineCode.length > 0 ||
    fp.makeTokens.length > 0 ||
    fp.modelTokens.length > 0;
  if (!hasSignal) return "";

  const packs = selectAggregateCasePacks(fp, { maxPacks: AGGREGATE_CTX_MAX_PACKS });
  const packText = formatAggregateCasePacksForAi(packs);
  const keys = await rankLearningKeysForFingerprint(fp);
  const learnings = await getAuditLearningsForKeys(keys);

  const parts: string[] = [
    AI_AGGREGATE_KNOWLEDGE_RULES,
    `### Agregātu zināšanas šim auto (${formatVehicleFingerprintLabel(fp)})`,
    packText,
  ];

  if (learnings.length > 0) {
    parts.push("### Mācījumi no iepriekšējām PROVIN atskaitēm (anonimizēti, līdzīgs agregāts)");
    for (const e of learnings) {
      const body = e.snippets
        .slice(-AGGREGATE_CTX_MAX_SNIPPETS_PER_KEY)
        .map((s) => `- ${s}`)
        .join("\n");
      parts.push(`#### ${e.label}\n${body}`);
    }
  }

  return clipAggregateContext(parts, AGGREGATE_CTX_MAX_CHARS);
}

export { invalidateAuditLearningsCache };
