import "server-only";

import { computeFreeSourceSeed, type FreeSourceSeedParts } from "@/lib/admin-free-source-seed";
import { isSafeOrderDraftSessionId, patchOrderDraft, readOrderDraft } from "@/lib/admin-order-draft-store";
import type { OrderDraftWorkspaceBody } from "@/lib/admin-order-draft-types";
import {
  orderDraftWorkspaceToPersistBody,
  persistBodyToOrderDraftWorkspace,
} from "@/lib/admin-order-draft-workspace-merge";
import { createDefaultSourceBlocks, mergeSourceBlocksWithDefaults } from "@/lib/admin-source-blocks";

function emptyWorkspaceBody(): OrderDraftWorkspaceBody {
  return {
    sourceBlocks: createDefaultSourceBlocks(),
    iriss: "",
    apskatesPlāns: "",
    tehniskoRiskuAnalize: "",
    cenasAtbilstiba: "",
    previewConfirmed: false,
  };
}

export type PaidOrderAutoSeedParts = FreeSourceSeedParts;

export type PaidOrderAutoSeedResult = {
  ok: boolean;
  patched: boolean;
} & PaidOrderAutoSeedParts;

/**
 * Pēc apmaksas vienā piegājienā ielasa sludinājuma vēsturi, CSDD un Dānijas / Igaunijas / Zviedrijas
 * reģistrus (ja dati pieejami). Zvani iet paralēli; melnraksts tiek rakstīts vienreiz, lai
 * nezaudētu laukus un iekļautos webhook `maxDuration` (300 s). Operatora ievadītais netiek pārrakstīts.
 */
export async function seedPaidOrderAutoSources(
  sessionId: string,
  opts: { vin?: string | null; listingUrl?: string | null },
): Promise<PaidOrderAutoSeedResult> {
  if (!isSafeOrderDraftSessionId(sessionId)) {
    return { ok: false, patched: false };
  }

  const listingUrl = opts.listingUrl?.trim() ?? "";
  const prev = await readOrderDraft(sessionId);
  const baseline = prev?.workspace ?? emptyWorkspaceBody();
  const seeded = await computeFreeSourceSeed(mergeSourceBlocksWithDefaults(baseline.sourceBlocks), opts);
  const parts: PaidOrderAutoSeedParts = seeded.parts;
  const blocks = seeded.blocks;
  const listingFilled = seeded.listingFilled;
  if (!seeded.changed) return { ok: true, patched: false, ...parts };

  const incoming = persistBodyToOrderDraftWorkspace(
    {
      ...orderDraftWorkspaceToPersistBody(baseline),
      sourceBlocks: blocks,
    },
    baseline.pdfVisibility,
    baseline.pdfBannerInclude,
    baseline.manualBanners,
  );

  const patched = await patchOrderDraft(
    sessionId,
    listingFilled ? { orderEdits: { listingUrl }, workspace: incoming } : { workspace: incoming },
    { force: true },
  );
  if (!patched.ok) return { ok: false, patched: false, ...parts };
  return { ok: true, patched: true, ...parts };
}
