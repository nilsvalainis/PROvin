import "server-only";

/**
 * CheckCar.vin pilnās atskaites imports: pasūtījuma atrašana pēc VIN un `cc_vin` bloka ierakstīšana
 * melnrakstā (tas pats coalesce + force ceļš kā dīlera datu ķēdei). Foto augšupielādē esošais
 * `/api/admin/cc-vin-photo`, šeit tikai piesaista tos galerijas grupām.
 */

import { listAllDashboardDraftIndexEntries } from "@/lib/admin-dashboard-draft-index";
import { patchOrderDraft, readOrderDraft } from "@/lib/admin-order-draft-store";
import type { OrderDraftWorkspaceBody } from "@/lib/admin-order-draft-types";
import {
  orderDraftWorkspaceToPersistBody,
  persistBodyToOrderDraftWorkspace,
} from "@/lib/admin-order-draft-workspace-merge";
import { listAdminOrders } from "@/lib/admin-orders";
import { createDefaultSourceBlocks, mergeSourceBlocksWithDefaults } from "@/lib/admin-source-blocks";
import type { CcVinBlockState } from "@/lib/cc-vin-report";
import {
  autobidOriginalHint,
  pickLatestOrderForVin,
  type CheckcarAutobidHint,
} from "@/lib/checkcar-import-orders";
import { readVinMemory } from "@/lib/vin-memory-store";

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

/** Jaunākais pasūtījums ar šo VIN (Stripe/manuālais VIN vai melnrakstā labotais VIN). */
export async function findLatestOrderIdByVin(vin: string): Promise<string | null> {
  const { rows } = await listAdminOrders();
  const index = await listAllDashboardDraftIndexEntries().catch(() => []);
  return pickLatestOrderForVin(vin, rows, index);
}

/** Nolasa jaunāko melnrakstu, maina tikai `cc_vin` un ieraksta atpakaļ. */
export async function writeCcVinBlock(
  sessionId: string,
  mutate: (block: CcVinBlockState) => CcVinBlockState,
): Promise<{ ok: true; block: CcVinBlockState } | { ok: false; error: string }> {
  const prev = await readOrderDraft(sessionId);
  const baseline = prev?.workspace ?? emptyWorkspaceBody();
  const blocks = mergeSourceBlocksWithDefaults(baseline.sourceBlocks);
  const cc_vin = mutate(blocks.cc_vin);
  const incoming = persistBodyToOrderDraftWorkspace(
    { ...orderDraftWorkspaceToPersistBody(baseline), sourceBlocks: { ...blocks, cc_vin } },
    baseline.pdfVisibility,
    baseline.pdfBannerInclude,
    baseline.manualBanners,
  );
  const patched = await patchOrderDraft(sessionId, { workspace: incoming }, { force: true });
  if (!patched.ok) return { ok: false, error: patched.error };
  return { ok: true, block: cc_vin };
}

/** Vai Autobid arhīvā (VIN atmiņa) ir šis auto - oriģinālās bildes bez ūdenszīmēm. */
export async function readAutobidOriginalHint(vin: string): Promise<CheckcarAutobidHint | null> {
  const entry = await readVinMemory(vin).catch(() => null);
  return autobidOriginalHint(entry);
}
