import "server-only";

import {
  isSafeOrderDraftSessionId,
  patchOrderDraft,
  readOrderDraft,
} from "@/lib/admin-order-draft-store";
import {
  persistBodyToOrderDraftWorkspace,
  orderDraftWorkspaceToPersistBody,
} from "@/lib/admin-order-draft-workspace-merge";
import { createDefaultSourceBlocks, mergeSourceBlocksWithDefaults } from "@/lib/admin-source-blocks";
import { applyCsddTechDataToBlock, csddTechSeedNeeded } from "@/lib/csdd-tech-data-apply";
import { fetchCsddTechData } from "@/lib/csdd-tech-data";
import { isPlaceholderVin, isValidVinOrPlate, normalizeVin } from "@/lib/order-field-validation";
import type { OrderDraftWorkspaceBody } from "@/lib/admin-order-draft-types";

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

/**
 * Pēc apmaksas aizpilda CSDD bloku ar reģistra tehniskajiem datiem pēc klienta norādītā
 * VIN vai valsts numura. Ja reģistrā tāda nav, bloks paliek tukšs: izdomātus datus neliekam.
 */
export async function seedCsddTechDataOnPaidOrder(
  sessionId: string,
  vinOrPlate: string | null | undefined,
): Promise<{ ok: boolean; reason: string }> {
  if (!isSafeOrderDraftSessionId(sessionId)) return { ok: false, reason: "invalid_session" };

  const nr1 = normalizeVin(vinOrPlate ?? "");
  if (!nr1) return { ok: false, reason: "no_vin" };
  if (!isValidVinOrPlate(nr1) || isPlaceholderVin(nr1)) return { ok: false, reason: "skip" };

  const prev = await readOrderDraft(sessionId);
  const baseline = prev?.workspace ?? emptyWorkspaceBody();
  const blocks = mergeSourceBlocksWithDefaults(baseline.sourceBlocks);
  // Operators jau var būt ielīmējis CSDD datus; tad reģistra zvans tikai tērētu līguma kvotu.
  if (!csddTechSeedNeeded(blocks.csdd)) return { ok: false, reason: "skip" };

  const res = await fetchCsddTechData(nr1);
  if (!res.found) return { ok: false, reason: res.message };

  const nextCsdd = applyCsddTechDataToBlock(blocks.csdd, res.data, { nr1 });
  if (!nextCsdd) return { ok: false, reason: "skip" };

  const incoming = persistBodyToOrderDraftWorkspace(
    {
      ...orderDraftWorkspaceToPersistBody(baseline),
      sourceBlocks: { ...blocks, csdd: nextCsdd },
    },
    baseline.pdfVisibility,
    baseline.pdfBannerInclude,
    baseline.manualBanners,
  );

  const patched = await patchOrderDraft(sessionId, { workspace: incoming }, { force: true });
  if (!patched.ok) return { ok: false, reason: patched.error };
  return { ok: true, reason: "filled" };
}
