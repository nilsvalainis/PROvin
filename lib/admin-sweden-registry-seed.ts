import "server-only";

import { applyRegistrySeedResult, registrySeedNeeded } from "@/lib/admin-denmark-registry-seed-apply";
import { isSafeOrderDraftSessionId, patchOrderDraft, readOrderDraft } from "@/lib/admin-order-draft-store";
import type { OrderDraftWorkspaceBody } from "@/lib/admin-order-draft-types";
import {
  orderDraftWorkspaceToPersistBody,
  persistBodyToOrderDraftWorkspace,
} from "@/lib/admin-order-draft-workspace-merge";
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
 * Pēc apmaksas ielasa car.info (Zviedrija / Nordics) pēc VIN.
 * Vercel vidē Cloudflare Challenge vajag CAPSOLVER_API_KEY + CAPSOLVER_PROXY vai FIXIE_URL.
 * Operatora ievadītais netiek pārrakstīts.
 */
export async function seedSwedenRegistryOnPaidOrder(
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
  if (!registrySeedNeeded(blocks.carinfo)) return { ok: false, reason: "skip" };

  const result = await fetchVinSource("carinfo", vin);
  const nextBlock = applyRegistrySeedResult(blocks.carinfo, result);
  if (!nextBlock) return { ok: false, reason: "skip" };

  const incoming = persistBodyToOrderDraftWorkspace(
    {
      ...orderDraftWorkspaceToPersistBody(baseline),
      sourceBlocks: { ...blocks, carinfo: nextBlock },
    },
    baseline.pdfVisibility,
    baseline.pdfBannerInclude,
    baseline.manualBanners,
  );

  const patched = await patchOrderDraft(sessionId, { workspace: incoming }, { force: true });
  if (!patched.ok) return { ok: false, reason: patched.error };
  return { ok: true, reason: result.found ? "filled" : "not_found" };
}
