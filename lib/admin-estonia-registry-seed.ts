import "server-only";

import { applyRegistrySeedResult, registrySeedNeeded } from "@/lib/admin-denmark-registry-seed-apply";
import { isSafeOrderDraftSessionId, patchOrderDraft, readOrderDraft } from "@/lib/admin-order-draft-store";
import type { OrderDraftWorkspaceBody } from "@/lib/admin-order-draft-types";
import {
  orderDraftWorkspaceToPersistBody,
  persistBodyToOrderDraftWorkspace,
} from "@/lib/admin-order-draft-workspace-merge";
import { createDefaultSourceBlocks, mergeSourceBlocksWithDefaults } from "@/lib/admin-source-blocks";
import { hasCaptchaSolverKey } from "@/lib/captcha-solver";
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
 * Pēc apmaksas ielasa Igaunijas reģistru (mnt.ee) un OCTA (lkf.ee) pēc VIN.
 * Vercel vidē vajag CAPSOLVER_API_KEY. Operatora ievadītais netiek pārrakstīts.
 */
export async function seedEstoniaRegistryOnPaidOrder(
  sessionId: string,
  vinOrPlate: string | null | undefined,
): Promise<{ ok: boolean; reason: string }> {
  if (!isSafeOrderDraftSessionId(sessionId)) return { ok: false, reason: "invalid_session" };
  if (!hasCaptchaSolverKey()) return { ok: false, reason: "no_solver" };

  const vin = normalizeVin(vinOrPlate ?? "");
  if (!vin) return { ok: false, reason: "no_vin" };
  if (!isValidVin(vin) || isPlaceholderVin(vin)) return { ok: false, reason: "skip" };

  const prev = await readOrderDraft(sessionId);
  const baseline = prev?.workspace ?? emptyWorkspaceBody();
  const blocks = mergeSourceBlocksWithDefaults(baseline.sourceBlocks);
  const needMnt = registrySeedNeeded(blocks.mnt_ee);
  const needLkf = registrySeedNeeded(blocks.lkf_ee);
  if (!needMnt && !needLkf) return { ok: false, reason: "skip" };

  let mnt = blocks.mnt_ee;
  let lkf = blocks.lkf_ee;
  if (needMnt) {
    const result = await fetchVinSource("mnt_ee", vin);
    mnt = applyRegistrySeedResult(mnt, result) ?? mnt;
  }
  if (needLkf) {
    const result = await fetchVinSource("lkf_ee", vin);
    lkf = applyRegistrySeedResult(lkf, result) ?? lkf;
  }

  const incoming = persistBodyToOrderDraftWorkspace(
    {
      ...orderDraftWorkspaceToPersistBody(baseline),
      sourceBlocks: { ...blocks, mnt_ee: mnt, lkf_ee: lkf },
    },
    baseline.pdfVisibility,
    baseline.pdfBannerInclude,
    baseline.manualBanners,
  );

  const patched = await patchOrderDraft(sessionId, { workspace: incoming }, { force: true });
  if (!patched.ok) return { ok: false, reason: patched.error };
  return { ok: true, reason: "filled" };
}
