import "server-only";

import { isSafeOrderDraftSessionId, patchOrderDraft, readOrderDraft } from "@/lib/admin-order-draft-store";
import {
  orderDraftWorkspaceToPersistBody,
  persistBodyToOrderDraftWorkspace,
} from "@/lib/admin-order-draft-workspace-merge";
import type { OrderDraftWorkspaceBody } from "@/lib/admin-order-draft-types";
import { applyDenmarkSeedResult, denmarkSeedNeeded } from "@/lib/admin-denmark-registry-seed-apply";
import { createDefaultSourceBlocks, mergeSourceBlocksWithDefaults } from "@/lib/admin-source-blocks";
import { isPlaceholderVin, isValidVin, normalizeVin } from "@/lib/order-field-validation";
import { fetchVinSource } from "@/lib/vin-sources";

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
 * Pēc apmaksas ielasa Dānijas reģistru (tjekbil.dk: DMR, apskates, meklēšanā, RAPEX; nummerplade.net,
 * ja ir atslēga) pēc klienta VIN. Publisks JSON bez captcha, tāpēc drīkst iet no Vercel.
 * Numurzīme bez VIN netiek meklēta: Dānijas API prasa VIN.
 */
export async function seedDenmarkRegistryOnPaidOrder(
  sessionId: string,
  vinOrPlate: string | null | undefined,
): Promise<{ ok: boolean; reason: string }> {
  if (!isSafeOrderDraftSessionId(sessionId)) return { ok: false, reason: "invalid_session" };

  const vin = normalizeVin(vinOrPlate ?? "");
  if (!vin) return { ok: false, reason: "no_vin" };
  if (!isValidVin(vin) || isPlaceholderVin(vin)) return { ok: false, reason: "skip" };

  const prev = await readOrderDraft(sessionId);
  const baseline = prev?.workspace ?? emptyWorkspaceBody();
  const blocks = mergeSourceBlocksWithDefaults(baseline.sourceBlocks);
  if (!denmarkSeedNeeded(blocks.tjekbil)) return { ok: false, reason: "skip" };

  const result = await fetchVinSource("tjekbil", vin);
  const nextBlock = applyDenmarkSeedResult(blocks.tjekbil, result);
  if (!nextBlock) return { ok: false, reason: "skip" };

  const incoming = persistBodyToOrderDraftWorkspace(
    {
      ...orderDraftWorkspaceToPersistBody(baseline),
      sourceBlocks: { ...blocks, tjekbil: nextBlock },
    },
    baseline.pdfVisibility,
    baseline.pdfBannerInclude,
    baseline.manualBanners,
  );

  const patched = await patchOrderDraft(sessionId, { workspace: incoming }, { force: true });
  if (!patched.ok) return { ok: false, reason: patched.error };
  return { ok: true, reason: result.found ? "filled" : "not_found" };
}
