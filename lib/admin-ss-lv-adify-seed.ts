import "server-only";

import { fetchAdifyListingHistory } from "@/lib/adify-listing-history";
import {
  applySsLvAdifyAutofill,
  shouldAutofillSsLvListing,
} from "@/lib/admin-ss-lv-adify-autofill";
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
import { fetchListingMarketSnapshot } from "@/lib/listing-scrape";
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

/** Pēc apmaksas — ja sludinājums ir ss.lv, aizpilda tirgus/sludinājuma vēsturi no Adify. */
export async function seedSsLvAdifyOnPaidOrder(
  sessionId: string,
  listingUrl: string | null | undefined,
): Promise<{ ok: boolean; reason: string }> {
  const url = listingUrl?.trim() ?? "";
  if (!isSafeOrderDraftSessionId(sessionId)) {
    return { ok: false, reason: "invalid_session" };
  }
  if (!url) return { ok: false, reason: "no_listing_url" };

  const prev = await readOrderDraft(sessionId);
  const baseline = prev?.workspace ?? emptyWorkspaceBody();
  const blocks = mergeSourceBlocksWithDefaults(baseline.sourceBlocks);
  if (!shouldAutofillSsLvListing(url, blocks.tirgus)) {
    return { ok: false, reason: "skip" };
  }

  const [snapshot, scrape] = await Promise.all([
    fetchAdifyListingHistory(url),
    fetchListingMarketSnapshot(url).catch(() => null),
  ]);
  const nextTirgus = applySsLvAdifyAutofill(blocks.tirgus, url, snapshot, scrape);
  if (!nextTirgus) return { ok: false, reason: "no_adify_data" };

  const incoming = persistBodyToOrderDraftWorkspace(
    {
      ...orderDraftWorkspaceToPersistBody(baseline),
      sourceBlocks: { ...blocks, tirgus: nextTirgus },
    },
    baseline.pdfVisibility,
    baseline.pdfBannerInclude,
    baseline.manualBanners,
  );

  const patched = await patchOrderDraft(
    sessionId,
    { orderEdits: { listingUrl: url }, workspace: incoming },
    { force: true },
  );
  if (!patched.ok) {
    return { ok: false, reason: patched.error };
  }
  return { ok: true, reason: "filled" };
}
