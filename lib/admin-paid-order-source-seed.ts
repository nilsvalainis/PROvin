import "server-only";

import { applySsLvAdifyAutofill, shouldAutofillSsLvListing } from "@/lib/admin-ss-lv-adify-autofill";
import {
  applyNordicRegistryFetches,
  registrySeedNeeded,
  type NordicRegistryFetchBundle,
  type NordicRegistrySeedKey,
} from "@/lib/admin-denmark-registry-seed-apply";
import { isSafeOrderDraftSessionId, patchOrderDraft, readOrderDraft } from "@/lib/admin-order-draft-store";
import type { OrderDraftWorkspaceBody } from "@/lib/admin-order-draft-types";
import {
  orderDraftWorkspaceToPersistBody,
  persistBodyToOrderDraftWorkspace,
} from "@/lib/admin-order-draft-workspace-merge";
import { createDefaultSourceBlocks, mergeSourceBlocksWithDefaults } from "@/lib/admin-source-blocks";
import { hasCaptchaSolverKey } from "@/lib/captcha-solver";
import { applyCsddTechDataToBlock, csddTechSeedNeeded } from "@/lib/csdd-tech-data-apply";
import { fetchCsddTechData } from "@/lib/csdd-tech-data";
import { fetchListingPriceHistory } from "@/lib/listing-price-history";
import { fetchListingAiSnapshot, formatListingSnapshotForPasteField } from "@/lib/listing-scrape";
import { isPlaceholderVin, isValidVin, isValidVinOrPlate, normalizeVin } from "@/lib/order-field-validation";
import { fetchVinSource } from "@/lib/vin-sources";
import type { VinSourceFetchResult } from "@/lib/vin-sources/types";

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

export type PaidOrderAutoSeedParts = {
  listing?: string;
  csdd?: string;
  tjekbil?: string;
  mnt_ee?: string;
  lkf_ee?: string;
  carinfo?: string;
};

export type PaidOrderAutoSeedResult = {
  ok: boolean;
  patched: boolean;
} & PaidOrderAutoSeedParts;

function nordicReason(result: VinSourceFetchResult | undefined, needed: boolean, noSolver = false): string | undefined {
  if (!needed) return "skip";
  if (noSolver) return "no_solver";
  if (!result) return "error";
  return result.found ? "filled" : "not_found";
}

async function settle<T>(label: string, job: Promise<T>): Promise<T | null> {
  try {
    return await job;
  } catch (err) {
    console.error(`[paid-order-auto-seed] ${label}:`, err);
    return null;
  }
}

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
  const nr1 = normalizeVin(opts.vin ?? "");
  const nordicVin = nr1 && isValidVin(nr1) && !isPlaceholderVin(nr1) ? nr1 : "";
  const csddNr = nr1 && isValidVinOrPlate(nr1) && !isPlaceholderVin(nr1) ? nr1 : "";

  const prev = await readOrderDraft(sessionId);
  const baseline = prev?.workspace ?? emptyWorkspaceBody();
  let blocks = mergeSourceBlocksWithDefaults(baseline.sourceBlocks);

  const listingPasteEmpty = !String(blocks.listing_analysis.listingPasteRaw ?? "").trim();
  const doListing =
    listingUrl.length > 0 &&
    (shouldAutofillSsLvListing(listingUrl, blocks.tirgus) || listingPasteEmpty);
  const doCsdd = Boolean(csddNr) && csddTechSeedNeeded(blocks.csdd);
  const solver = hasCaptchaSolverKey();
  const need: Record<NordicRegistrySeedKey, boolean> = {
    tjekbil: Boolean(nordicVin) && registrySeedNeeded(blocks.tjekbil),
    mnt_ee: Boolean(nordicVin) && registrySeedNeeded(blocks.mnt_ee),
    lkf_ee: Boolean(nordicVin) && registrySeedNeeded(blocks.lkf_ee),
    carinfo: Boolean(nordicVin) && registrySeedNeeded(blocks.carinfo),
  };
  const doMnt = need.mnt_ee && solver;
  const doLkf = need.lkf_ee && solver;

  const parts: PaidOrderAutoSeedParts = {};
  if (!listingUrl) parts.listing = "no_listing_url";
  else if (!doListing) parts.listing = "skip";
  if (!csddNr) parts.csdd = nr1 ? "skip" : "no_vin";
  else if (!doCsdd) parts.csdd = "skip";
  if (!nordicVin) {
    parts.tjekbil = nr1 ? "skip" : "no_vin";
    parts.mnt_ee = nr1 ? "skip" : "no_vin";
    parts.lkf_ee = nr1 ? "skip" : "no_vin";
    parts.carinfo = nr1 ? "skip" : "no_vin";
  }

  if (!doListing && !doCsdd && !need.tjekbil && !doMnt && !doLkf && !need.carinfo) {
    if (need.mnt_ee && !solver) parts.mnt_ee = "no_solver";
    if (need.lkf_ee && !solver) parts.lkf_ee = "no_solver";
    return { ok: true, patched: false, ...parts };
  }

  const [listingPair, csddRes, tjekbil, mnt, lkf, carinfo] = await Promise.all([
    doListing
      ? settle(
          "listing",
          Promise.all([fetchListingPriceHistory(listingUrl), fetchListingAiSnapshot(listingUrl).catch(() => null)]),
        )
      : Promise.resolve(null),
    doCsdd ? settle("csdd", fetchCsddTechData(csddNr)) : Promise.resolve(null),
    need.tjekbil ? settle("tjekbil", fetchVinSource("tjekbil", nordicVin)) : Promise.resolve(null),
    doMnt ? settle("mnt_ee", fetchVinSource("mnt_ee", nordicVin)) : Promise.resolve(null),
    doLkf ? settle("lkf_ee", fetchVinSource("lkf_ee", nordicVin)) : Promise.resolve(null),
    need.carinfo ? settle("carinfo", fetchVinSource("carinfo", nordicVin)) : Promise.resolve(null),
  ]);

  let listingFilled = false;
  if (doListing) {
    if (!listingPair) {
      parts.listing = "error";
    } else {
      const scrape = listingPair[1];
      const nextTirgus = shouldAutofillSsLvListing(listingUrl, blocks.tirgus)
        ? applySsLvAdifyAutofill(blocks.tirgus, listingUrl, listingPair[0], scrape)
        : null;
      if (nextTirgus) {
        blocks = { ...blocks, tirgus: nextTirgus };
        listingFilled = true;
        parts.listing = "filled";
      }
      const pasteText = scrape ? formatListingSnapshotForPasteField(scrape) : "";
      if (listingPasteEmpty && pasteText) {
        blocks = {
          ...blocks,
          listing_analysis: { ...blocks.listing_analysis, listingPasteRaw: pasteText },
        };
        listingFilled = true;
        if (parts.listing !== "filled") parts.listing = "paste";
      } else if (!nextTirgus && parts.listing !== "filled") {
        parts.listing = "no_adify_data";
      }
    }
  }

  if (doCsdd) {
    if (!csddRes) {
      parts.csdd = "error";
    } else if (!csddRes.found) {
      parts.csdd = csddRes.message || "not_found";
    } else {
      const nextCsdd = applyCsddTechDataToBlock(blocks.csdd, csddRes.data, { nr1: csddNr });
      if (nextCsdd) {
        blocks = { ...blocks, csdd: nextCsdd };
        parts.csdd = "filled";
      } else {
        parts.csdd = "skip";
      }
    }
  }

  const nordicResults: NordicRegistryFetchBundle = {
    tjekbil: tjekbil ?? undefined,
    mnt_ee: mnt ?? undefined,
    lkf_ee: lkf ?? undefined,
    carinfo: carinfo ?? undefined,
  };
  const nordic = applyNordicRegistryFetches(blocks, nordicResults);
  blocks = nordic.blocks;

  if (nordicVin) {
    parts.tjekbil = nordicReason(tjekbil ?? undefined, need.tjekbil);
    parts.mnt_ee = nordicReason(mnt ?? undefined, need.mnt_ee, need.mnt_ee && !solver);
    parts.lkf_ee = nordicReason(lkf ?? undefined, need.lkf_ee, need.lkf_ee && !solver);
    parts.carinfo = nordicReason(carinfo ?? undefined, need.carinfo);
  }

  const changed = listingFilled || parts.csdd === "filled" || nordic.applied.length > 0;
  if (!changed) return { ok: true, patched: false, ...parts };

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
