import "server-only";

import type { OrderDraftState } from "@/lib/admin-order-draft-types";
import { adminRichHtmlToPlainText } from "@/lib/admin-rich-comment-html";
import {
  extractVehicleReportFingerprint,
  formatVehicleFingerprintLabel,
  type VehicleReportFingerprint,
} from "@/lib/admin-vehicle-report-fingerprint";
import {
  mergeSourceBlocksWithDefaults,
  SOURCE_BLOCK_LABELS,
  type WorkspaceSourceBlocks,
} from "@/lib/admin-source-blocks";
import { workspaceFillScoreFromDraft } from "@/lib/admin-workspace-integrity";
import {
  formatAggregateCasePacksForGemini,
  fingerprintLearningKey,
  selectAggregateCasePacks,
} from "@/lib/provin-aggregate-case-rules";
import {
  getAuditLearningsForKeys,
  invalidateAuditLearningsCache,
  listAllAuditLearningKeys,
  upsertAuditAggregateLearning,
  type AuditAggregateLearningEntry,
} from "@/lib/admin-audit-learnings-store";

export const GEMINI_AGGREGATE_KNOWLEDGE_RULES = `PROVIN AGGREGĀTU ZINĀŠANAS (statiskā bāze + mācījumi no iepriekšējām atskaitēm):
- Kombinē zemāk esošās ražotāju/agregātu pakas ar AKTĪVĀ pasūtījuma datiem un (ja ir) vēsturisko auditu fragmentiem.
- Katru agregāta risku klasificē: **galvenais pirkuma risks** / **vidējs uzturēšanas risks** / **kontrolpunkts klātienē**.
- **1. Tehnisko risku analīze** — detalizēta agregātu forenzika; **2. Ieteikumi** — pārbaudes punkti; **3. Kopsavilkums** — kopaina bez garas tehniskās dublikācijas; **avotu/nobraukuma/negadījumu komentāri** — arī lieto šīs zināšanas, kur relevantas.
- Mācījumi no citām atskaitēm — tikai paraugi un forenzikas loģika; **nekopē** klienta VIN, km, datumus, EUR, pasūtījuma ID.
- Ja statiskā paka un mācījumi konfliktē ar aktīvā auto datiem — uzvar aktīvā pasūtījuma fakti.
- Pēc katras bagātīgas atskaites PROVIN saglabā anonimizētus mācījumus — uzskati tos par institucionālo atmiņu nākamajiem līdzīgiem agregātiem.`;

function redactLearningText(text: string): string {
  return text
    .replace(/\b[A-HJ-NPR-Z0-9]{17}\b/gi, "[VIN]")
    .replace(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi, "[e-pasts]")
    .replace(/(\+371\s?)?2[\d\s-]{6,12}/g, "[tālrunis]")
    .replace(/\bcs_[a-zA-Z0-9]+\b/g, "[pasūtījums]")
    .replace(/\b\d{5,7}\s*km\b/gi, "[km]")
    .replace(/\b\d{1,2}[./]\d{1,2}[./]\d{2,4}\b/g, "[datums]");
}

function clipLearningSnippet(text: string, max = 400): string {
  const t = redactLearningText(text.replace(/\s+/g, " ").trim());
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trim()}…`;
}

/** Īss „mācību” fragments — pirmās 1–2 teikuma daļas ar riska/EUR signāliem. */
function distillLesson(plain: string, tag: string, max = 360): string | null {
  const cleaned = plain.replace(/\s+/g, " ").trim();
  if (cleaned.length < 70) return null;
  const sentences = cleaned.split(/(?<=[.!?…])\s+/).filter((s) => s.trim().length > 25);
  const pick = sentences.slice(0, 2).join(" ").trim() || cleaned.slice(0, max);
  return clipLearningSnippet(`[${tag}] ${pick}`, max);
}

function extractLearningSnippetsFromDraft(draft: OrderDraftState): string[] {
  const ws = draft.workspace;
  if (!ws) return [];
  const out: string[] = [];
  const pushTagged = (tag: string, raw: string | undefined, minLen = 70) => {
    const plain = adminRichHtmlToPlainText(raw ?? "").trim();
    if (plain.length < minLen) return;
    const lesson = distillLesson(plain, tag);
    if (lesson) out.push(lesson);
  };

  pushTagged("Tehnika", ws.tehniskoRiskuAnalize, 60);
  pushTagged("Apskate", ws.apskatesPlāns, 60);
  pushTagged("Kopsavilkums", ws.iriss, 80);
  pushTagged("Nobraukums", draft.orderEdits.mileageComment, 70);
  pushTagged("Negadījumi", draft.orderEdits.internalComment, 70);
  pushTagged("Cena", ws.cenasAtbilstiba, 70);

  const blocks = mergeSourceBlocksWithDefaults(ws.sourceBlocks as WorkspaceSourceBlocks);
  const sourcePairs: Array<[string, string]> = [
    [SOURCE_BLOCK_LABELS.csdd, blocks.csdd.comments],
    [SOURCE_BLOCK_LABELS.autodna, blocks.autodna.comments],
    [SOURCE_BLOCK_LABELS.carvertical, blocks.carvertical.comments],
    [SOURCE_BLOCK_LABELS.auto_records, blocks.auto_records.comments],
    [SOURCE_BLOCK_LABELS.tjekbil, blocks.tjekbil.comments],
    [SOURCE_BLOCK_LABELS.mnt_ee, blocks.mnt_ee.comments],
    [SOURCE_BLOCK_LABELS.lkf_ee, blocks.lkf_ee.comments],
    [SOURCE_BLOCK_LABELS.carinfo, blocks.carinfo.comments],
    [SOURCE_BLOCK_LABELS.ltab, blocks.ltab.comments],
  ];
  for (const [label, comments] of sourcePairs) {
    pushTagged(`Avots:${label}`, comments, 90);
  }

  return [...new Set(out)].slice(0, 10);
}

export function draftQualifiesForAggregateLearning(draft: OrderDraftState): boolean {
  if (!draft.workspace) return false;
  const fill = workspaceFillScoreFromDraft(draft.workspace);
  const snippets = extractLearningSnippetsFromDraft(draft);
  return snippets.length >= 2 && (fill >= 5 || snippets.some((s) => s.length >= 120));
}

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
  return out.slice(0, 4);
}

export type AggregateKnowledgeContextInput = {
  sourceBlocks: WorkspaceSourceBlocks;
  vin?: string | null;
  manufactureYear?: number | null;
};

/** Statiskās paka + mācījumi no līdzīgiem agregātiem — Gemini ✨ kontekstam. */
export async function buildAggregateKnowledgeGeminiContext(
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

  const packs = selectAggregateCasePacks(fp);
  const packText = formatAggregateCasePacksForGemini(packs);
  const keys = await rankLearningKeysForFingerprint(fp);
  const learnings = await getAuditLearningsForKeys(keys);

  const parts: string[] = [
    GEMINI_AGGREGATE_KNOWLEDGE_RULES,
    `### Agregātu zināšanas šim auto (${formatVehicleFingerprintLabel(fp)})`,
    packText,
  ];

  if (learnings.length > 0) {
    parts.push("### Mācījumi no iepriekšējām PROVIN atskaitēm (anonimizēti, līdzīgs agregāts)");
    for (const e of learnings) {
      const body = e.snippets.map((s) => `- ${s}`).join("\n");
      parts.push(`#### ${e.label}\n${body}`);
    }
  }

  return parts.filter(Boolean).join("\n\n");
}

export { invalidateAuditLearningsCache };
