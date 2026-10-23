import "server-only";

import { computeFreeSourceSeed, type FreeSourceSeedParts } from "@/lib/admin-free-source-seed";
import {
  isSafeOrderDraftSessionId,
  patchOrderDraft,
  readOrderDraft,
  upsertOrderDraftAutoIngest,
} from "@/lib/admin-order-draft-store";
import type { OrderDraftWorkspaceBody } from "@/lib/admin-order-draft-types";
import {
  orderDraftWorkspaceToPersistBody,
  persistBodyToOrderDraftWorkspace,
} from "@/lib/admin-order-draft-workspace-merge";
import { createDefaultSourceBlocks, mergeSourceBlocksWithDefaults, type CsddFormFields } from "@/lib/admin-source-blocks";
import { startLtabLookup } from "@/lib/ltab-auto";

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

/** LTAB solis pēc CSDD (tikai `LTAB_AUTO_ENABLED=1` un LV numurzīme). Kļūda neaptur pasūtījumu. */
async function startLtabAfterSeed(
  sessionId: string,
  vin: string | null | undefined,
  csdd: CsddFormFields,
): Promise<void> {
  try {
    await startLtabLookup(sessionId, { trigger: "auto", orderVin: vin ?? "", csdd });
  } catch (e) {
    console.error("[paid-order-seed] ltab start failed", e instanceof Error ? e.message : "unknown");
  }
}

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
  const ingest = { at: new Date().toISOString(), parts };
  if (!seeded.changed) {
    await upsertOrderDraftAutoIngest(sessionId, ingest).catch(() => null);
    await startLtabAfterSeed(sessionId, seeded.resolvedVin || opts.vin, blocks.csdd);
    return { ok: true, patched: false, ...parts };
  }

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
  await upsertOrderDraftAutoIngest(sessionId, ingest).catch(() => null);
  if (!patched.ok) return { ok: false, patched: false, ...parts };
  await startLtabAfterSeed(sessionId, seeded.resolvedVin || opts.vin, blocks.csdd);
  return { ok: true, patched: true, ...parts };
}
