/**
 * TRAINING_V2 orķestrācija: kandidāti no nosūtītām atskaitēm, AI konteksts no apstiprinātajiem.
 */
import type { OrderDraftState } from "@/lib/admin-order-draft-types";
import {
  claimsToCandidateItems,
  extractClaimsFromPlain,
  plainFromHtml,
} from "@/lib/admin-audit-knowledge-claim-extract";
import {
  formatKnowledgeItemsForAi,
  itemsForAiContext,
} from "@/lib/admin-audit-knowledge-items-logic";
import {
  getKnowledgeUsage,
  readKnowledgeItemsDoc,
  recordKnowledgeUsage,
  saveCandidateKnowledgeItems,
} from "@/lib/admin-audit-knowledge-items-store";
import { recordAiEditedSnapshot } from "@/lib/admin-ai-field-revisions-store";
import {
  extractVehicleReportFingerprint,
  formatVehicleFingerprintLabel,
} from "@/lib/admin-vehicle-report-fingerprint";
import { engineFamilyLearningKeys } from "@/lib/admin-audit-learning-keys";
import {
  mergeSourceBlocksWithDefaults,
  type WorkspaceSourceBlocks,
} from "@/lib/admin-source-blocks";
import { workspaceFillScoreFromDraft } from "@/lib/admin-workspace-integrity";
import { fingerprintLearningKey } from "@/lib/provin-aggregate-case-rules";
import type { KnowledgeItem } from "@/lib/admin-audit-knowledge-items-types";

export function aggregateKeyFromDraft(draft: OrderDraftState): string {
  const ws = draft.workspace;
  if (!ws) return "";
  const vin = draft.orderEdits.vin?.trim() || null;
  const fp = extractVehicleReportFingerprint(ws.sourceBlocks as WorkspaceSourceBlocks, { vin });
  const code = fp.engineCode.trim();
  if (code) return code;
  return fingerprintLearningKey(fp) || formatVehicleFingerprintLabel(fp);
}

export function draftIsSentToClient(draft: OrderDraftState): boolean {
  return Boolean(draft.clientReportReadyAt?.trim());
}

export function draftFactsArePartial(draft: OrderDraftState): boolean {
  if (!draft.workspace) return true;
  return workspaceFillScoreFromDraft(draft.workspace) < 5;
}

export async function recordTrainingV2FromDraftForSession(
  sessionId: string,
  draft: OrderDraftState,
): Promise<KnowledgeItem[]> {
  const ws = draft.workspace;
  if (!ws) return [];

  await recordAiEditedSnapshot({
    sessionId,
    fields: {
      technical_risks: plainFromHtml(ws.tehniskoRiskuAnalize),
      inspection: plainFromHtml(ws.apskatesPlāns),
      summary: plainFromHtml(ws.iriss),
      price: plainFromHtml(ws.cenasAtbilstiba),
      mileage: draft.orderEdits.mileageComment,
      incidents: draft.orderEdits.internalComment,
    },
  }).catch(() => undefined);

  if (!draftIsSentToClient(draft) || draftFactsArePartial(draft)) return [];

  const aggregate = aggregateKeyFromDraft(draft);
  if (!aggregate) return [];

  const tech = plainFromHtml(ws.tehniskoRiskuAnalize);
  const claims = extractClaimsFromPlain(tech, aggregate);
  if (claims.length === 0) return [];
  const items = claimsToCandidateItems({ aggregate, claims, sessionId });
  return saveCandidateKnowledgeItems(items);
}

export async function buildTrainingV2KnowledgeContext(input: {
  sourceBlocks: WorkspaceSourceBlocks;
  vin?: string | null;
  manufactureYear?: number | null;
  sessionId?: string | null;
}): Promise<string> {
  const blocks = mergeSourceBlocksWithDefaults(input.sourceBlocks);
  const fp = extractVehicleReportFingerprint(blocks, {
    vin: input.vin,
    manufactureYear: input.manufactureYear,
  });
  const aggregates = [
    fp.engineCode.trim(),
    ...engineFamilyLearningKeys(fp.engineCode).map((k) => k.replace(/^ENGINE\|/, "")),
    fingerprintLearningKey(fp),
  ].filter(Boolean);
  if (aggregates.length === 0) return "";

  const doc = await readKnowledgeItemsDoc();
  const { approved, rejected } = itemsForAiContext(doc, aggregates);
  const text = formatKnowledgeItemsForAi(approved, rejected);
  if (input.sessionId?.trim()) {
    await recordKnowledgeUsage({
      sessionId: input.sessionId.trim(),
      at: new Date().toISOString(),
      approved: approved.map((i) => ({ id: i.id, aggregate: i.aggregate, claim: i.claim })),
      rejected: rejected.map((i) => ({ id: i.id, aggregate: i.aggregate, claim: i.claim })),
      packLabels: aggregates.slice(0, 8),
    }).catch(() => undefined);
  }
  return text;
}

export async function trainingV2UsageForSession(sessionId: string) {
  return getKnowledgeUsage(sessionId);
}
