/**
 * Darba zonas integritātes rādītāji — kopīgi klientam un serverim (bez server-only).
 */
import type { OrderDraftWorkspaceBody } from "@/lib/admin-order-draft-types";
import {
  normalizeOrderWorkspacePersistBody,
  workspaceHydrationFillScore,
  type OrderWorkspacePersistBody,
} from "@/lib/admin-order-workspace-persist";
import { mergeSourceBlocksWithDefaults } from "@/lib/admin-source-blocks";

function toPersistBody(workspace: OrderDraftWorkspaceBody | OrderWorkspacePersistBody): OrderWorkspacePersistBody {
  if ("vehicleAiExtraction" in workspace && !("pdfVisibility" in workspace)) {
    return workspace as OrderWorkspacePersistBody;
  }
  const w = workspace as OrderDraftWorkspaceBody;
  return normalizeOrderWorkspacePersistBody({
    sourceBlocks: mergeSourceBlocksWithDefaults(w.sourceBlocks),
    iriss: w.iriss,
    apskatesPlāns: w.apskatesPlāns,
    cenasAtbilstiba: w.cenasAtbilstiba,
    previewConfirmed: w.previewConfirmed,
    vehicleAiExtraction: w.vehicleAiExtraction ?? null,
    vehicleAiExtractionMeta: w.vehicleAiExtractionMeta ?? null,
  });
}

/** Stabilā DJB2 heks virkne workspace canonical JSON. */
export function stableWorkspaceChecksum(
  workspace: OrderDraftWorkspaceBody | OrderWorkspacePersistBody,
): string {
  const normalized = toPersistBody(workspace);
  const canonical = JSON.stringify({
    sourceBlocks: normalized.sourceBlocks,
    iriss: normalized.iriss,
    apskatesPlāns: normalized.apskatesPlāns,
    cenasAtbilstiba: normalized.cenasAtbilstiba,
    previewConfirmed: normalized.previewConfirmed,
    vehicleAiExtraction: normalized.vehicleAiExtraction,
    vehicleAiExtractionMeta: normalized.vehicleAiExtractionMeta,
  });
  let h = 5381;
  for (let i = 0; i < canonical.length; i++) {
    h = ((h << 5) + h) ^ canonical.charCodeAt(i);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

export function workspaceFillScoreFromDraft(workspace: OrderDraftWorkspaceBody | null | undefined): number {
  if (!workspace) return 0;
  return workspaceHydrationFillScore(toPersistBody(workspace));
}

export type WorkspaceIntegrityExpectation = {
  revision: number;
  checksum: string;
  fillScore: number;
};

export type WorkspaceIntegrityVerifyResult =
  | { ok: true; revision: number; checksum: string; fillScore: number }
  | { ok: false; error: "persistence_verification_failed"; reason: string; expected: WorkspaceIntegrityExpectation; actual: Partial<WorkspaceIntegrityExpectation> };

/** Salīdzina read-back ar sagaidīto stāvokli pēc write. */
export function verifyWorkspaceIntegrity(
  workspace: OrderDraftWorkspaceBody | null | undefined,
  revision: number | undefined,
  expected: WorkspaceIntegrityExpectation,
): WorkspaceIntegrityVerifyResult {
  if (!workspace) {
    return {
      ok: false,
      error: "persistence_verification_failed",
      reason: "empty_readback",
      expected,
      actual: {},
    };
  }
  const actualChecksum = stableWorkspaceChecksum(workspace);
  const actualFill = workspaceFillScoreFromDraft(workspace);
  const actualRevision = revision ?? 0;
  const actual = { revision: actualRevision, checksum: actualChecksum, fillScore: actualFill };

  if (actualRevision < expected.revision) {
    return { ok: false, error: "persistence_verification_failed", reason: "revision_regressed", expected, actual };
  }
  if (actualChecksum !== expected.checksum) {
    return { ok: false, error: "persistence_verification_failed", reason: "checksum_mismatch", expected, actual };
  }
  if (actualFill + 1 < expected.fillScore) {
    return { ok: false, error: "persistence_verification_failed", reason: "fill_score_regressed", expected, actual };
  }
  return { ok: true, revision: actualRevision, checksum: actualChecksum, fillScore: actualFill };
}

/** Vai incoming ir būtiski tukšāks par baseline (bloķē overwrite bez force). */
export function isEmptyRegressiveOverwrite(
  incoming: OrderWorkspacePersistBody,
  baseline: OrderWorkspacePersistBody | null | undefined,
): boolean {
  if (!baseline) return false;
  const inScore = workspaceHydrationFillScore(normalizeOrderWorkspacePersistBody(incoming));
  const baseScore = workspaceHydrationFillScore(normalizeOrderWorkspacePersistBody(baseline));
  return inScore + 2 < baseScore;
}
